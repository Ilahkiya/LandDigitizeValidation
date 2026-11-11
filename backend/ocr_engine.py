import os
import re
import fitz  # PyMuPDF
from PIL import Image
import pytesseract
from config import Config

# Configure tesseract executable if path is supplied
if Config.TESSERACT_CMD and os.path.exists(Config.TESSERACT_CMD):
    pytesseract.pytesseract.tesseract_cmd = Config.TESSERACT_CMD

def extract_text_from_pdf(file_path: str) -> dict:
    """
    Extracts text from PDF using PyMuPDF (digital text layer)
    and falls back to Tesseract OCR for scanned pages if needed.
    """
    doc = None
    extracted_pages = []
    has_scanned_pages = False
    ocr_attempted = False
    ocr_available = True

    try:
        doc = fitz.open(file_path)
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            page_text = page.get_text()

            # If page text is minimal, page might be a scanned image
            if not page_text or len(page_text.strip()) < 30:
                has_scanned_pages = True
                ocr_attempted = True
                try:
                    pix = page.get_pixmap(dpi=200)
                    img_bytes = pix.tobytes("png")
                    from io import BytesIO
                    pil_img = Image.open(BytesIO(img_bytes))
                    page_text = pytesseract.image_to_string(pil_img)
                except Exception as ocr_err:
                    ocr_available = False
                    page_text = f"[Scanned page {page_idx + 1}: OCR processing unavailable on server - {str(ocr_err)}]"

            extracted_pages.append(page_text)

        full_text = "\n\n--- Page Break ---\n\n".join(extracted_pages)
        return {
            "success": True,
            "text": full_text.strip(),
            "method": "PyMuPDF with Tesseract OCR fallback" if has_scanned_pages else "PyMuPDF Direct Text Extraction",
            "has_scanned_pages": has_scanned_pages,
            "ocr_available": ocr_available
        }
    except Exception as e:
        return {
            "success": False,
            "text": "",
            "error": f"Failed to extract text from PDF: {str(e)}",
            "method": "PyMuPDF"
        }
    finally:
        if doc:
            doc.close()

def extract_text_from_image(file_path: str) -> dict:
    """
    Extracts text from raster image (PNG, JPG, JPEG) using Tesseract OCR.
    """
    try:
        image = Image.open(file_path)
        text = pytesseract.image_to_string(image)
        return {
            "success": True,
            "text": text.strip(),
            "method": "Tesseract OCR",
            "ocr_available": True
        }
    except pytesseract.TesseractNotFoundError:
        return {
            "success": False,
            "text": "",
            "error": "Tesseract OCR binary is not installed in system PATH. Please configure TESSERACT_CMD or manually enter record fields.",
            "method": "Tesseract OCR",
            "ocr_available": False
        }
    except Exception as e:
        return {
            "success": False,
            "text": "",
            "error": f"OCR extraction error: {str(e)}",
            "method": "Tesseract OCR",
            "ocr_available": False
        }

def extract_document_text(file_path: str) -> dict:
    """
    Dispatcher based on file extension.
    """
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        return extract_text_from_pdf(file_path)
    elif ext in {".png", ".jpg", ".jpeg"}:
        return extract_text_from_image(file_path)
    else:
        return {
            "success": False,
            "text": "",
            "error": f"Unsupported file extension: {ext}",
            "method": "Unknown"
        }

def parse_structured_fields(raw_text: str) -> dict:
    """
    Parses key Tamil Nadu land record fields from raw text using patterns.
    Never fabricates values. Flags missing fields with found=False and 'Needs manual entry'.
    """
    fields = {
        "owner_name": {"value": "", "found": False, "source": "Not detected"},
        "patta_number": {"value": "", "found": False, "source": "Not detected"},
        "survey_number": {"value": "", "found": False, "source": "Not detected"},
        "subdivision_number": {"value": "", "found": False, "source": "Not detected"},
        "district": {"value": "", "found": False, "source": "Not detected"},
        "taluk": {"value": "", "found": False, "source": "Not detected"},
        "village": {"value": "", "found": False, "source": "Not detected"},
        "land_area": {"value": "", "found": False, "source": "Not detected"},
        "land_unit": {"value": "sq.ft", "found": True, "source": "Default selection"},
        "document_reference": {"value": "", "found": False, "source": "Not detected"}
    }

    if not raw_text:
        return fields

    # Owner Name patterns
    owner_match = re.search(r"(?:Owner(?:\s+Name)?|Pattadhar(?:\s*\([^\)]*\))?(?:\s+Name)?|பெயர்|Name\s+of\s+Owner)\s*[:\-\=]\s*([A-Za-z\. ]{3,40})", raw_text, re.IGNORECASE)
    if owner_match:
        val = owner_match.group(1).strip()
        if len(val) >= 2:
            fields["owner_name"] = {"value": val, "found": True, "source": "OCR/Text Extraction"}

    # Patta Number patterns
    patta_match = re.search(r"(?:Patta\s*(?:No|Number)?|பட்டா\s*எண்)\s*[:\-\=]?\s*([A-Za-z0-9\-\/]+)", raw_text, re.IGNORECASE)
    if patta_match:
        fields["patta_number"] = {"value": patta_match.group(1).strip(), "found": True, "source": "OCR/Text Extraction"}

    # Survey Number & Subdivision patterns
    # e.g. "Survey No: 142/3A" or "S.No: 142" "Subdivision: 3A"
    survey_combined = re.search(r"(?:Survey\s*(?:No|Number)?|S\.No|புல\s*எண்)\s*[:\-\=]?\s*(\d+)(?:[\/-]([A-Za-z0-9]+))?", raw_text, re.IGNORECASE)
    if survey_combined:
        fields["survey_number"] = {"value": survey_combined.group(1).strip(), "found": True, "source": "OCR/Text Extraction"}
        if survey_combined.group(2):
            fields["subdivision_number"] = {"value": survey_combined.group(2).strip(), "found": True, "source": "OCR/Text Extraction"}

    # Separate subdivision if not caught above
    if not fields["subdivision_number"]["found"]:
        subdiv_match = re.search(r"(?:Sub-?division|Subdivision\s*No|உட்பிரிவு)\s*[:\-\=]?\s*([A-Za-z0-9]+)", raw_text, re.IGNORECASE)
        if subdiv_match:
            fields["subdivision_number"] = {"value": subdiv_match.group(1).strip(), "found": True, "source": "OCR/Text Extraction"}

    # District patterns
    dist_match = re.search(r"(?:District|மாவட்டம்)\s*[:\-\=]?\s*([A-Za-z ]{3,25})", raw_text, re.IGNORECASE)
    if dist_match:
        fields["district"] = {"value": dist_match.group(1).strip(), "found": True, "source": "OCR/Text Extraction"}

    # Taluk patterns
    taluk_match = re.search(r"(?:Taluk|வட்டம்)\s*[:\-\=]?\s*([A-Za-z ]{3,25})", raw_text, re.IGNORECASE)
    if taluk_match:
        fields["taluk"] = {"value": taluk_match.group(1).strip(), "found": True, "source": "OCR/Text Extraction"}

    # Village patterns
    village_match = re.search(r"(?:Village|கிராமம்)\s*[:\-\=]?\s*([A-Za-z ]{3,30})", raw_text, re.IGNORECASE)
    if village_match:
        fields["village"] = {"value": village_match.group(1).strip(), "found": True, "source": "OCR/Text Extraction"}

    # Land Area & Unit patterns
    # e.g. "Area: 2400 sq.ft" or "Extent: 5.5 cents"
    area_match = re.search(r"(?:Area|Extent|Total\s+Extent|பரப்பளவு)\s*[:\-\=]?\s*(\d+(?:\.\d+)?)\s*(sq\.?\s*ft|cents?|acres?|hectares?|sq\.?\s*m(?:eters?)?)?", raw_text, re.IGNORECASE)
    if area_match:
        fields["land_area"] = {"value": area_match.group(1).strip(), "found": True, "source": "OCR/Text Extraction"}
        if area_match.group(2):
            unit_raw = area_match.group(2).lower().replace(" ", "")
            if "cent" in unit_raw:
                fields["land_unit"] = {"value": "cents", "found": True, "source": "OCR/Text Extraction"}
            elif "acre" in unit_raw:
                fields["land_unit"] = {"value": "acres", "found": True, "source": "OCR/Text Extraction"}
            elif "sq" in unit_raw:
                fields["land_unit"] = {"value": "sq.ft", "found": True, "source": "OCR/Text Extraction"}

    # Document Reference / Registration No
    doc_match = re.search(r"(?:Document\s+Reference|Doc(?:ument)?\s*(?:Ref(?:erence)?|No|Number)?|Deed\s*(?:No|Number)?|Registration\s*No)\s*[:\-\=]\s*([A-Za-z0-9\-\/]{4,30})", raw_text, re.IGNORECASE)
    if doc_match:
        fields["document_reference"] = {"value": doc_match.group(1).strip(), "found": True, "source": "OCR/Text Extraction"}

    return fields
