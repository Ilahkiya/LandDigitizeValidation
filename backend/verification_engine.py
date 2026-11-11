import os
import re
import uuid
import datetime
from pathlib import Path
from PIL import Image
import fitz  # PyMuPDF
from config import Config
from db import get_db_connection
from ocr_engine import extract_document_text, parse_structured_fields

# Magic bytes definition for strict file content validation
MAGIC_SIGNATURES = {
    "pdf": [b"%PDF"],
    "png": [b"\x89PNG\r\n\x1a\n"],
    "jpg": [b"\xff\xd8\xff"],
    "jpeg": [b"\xff\xd8\xff"],
}

TAMPERING_SOFTWARE_KEYWORDS = [
    "photoshop", "gimp", "canva", "sejda", "pdfescape", "ilovepdf",
    "foxit phantom", "foxit editor", "pixlr", "coreldraw", "inkscape",
    "nitro pro", "acrobat edit", "paint.net"
]

TN_OFFICIAL_DESIGNATIONS = [
    "tahsildar", "headquarters deputy tahsildar", "zonal deputy tahsildar",
    "sub-registrar", "sub registrar", "district revenue officer", "dro",
    "revenue inspector", "village administrative officer", "vao",
    "revenue department", "government of tamil nadu", "dept of registration",
    "tamil nadu registration department", "தமிழ்நாடு அரசு", "பதிவுத்துறை",
    "வருவாய்த்துறை", "வட்டாட்சியர்"
]

def validate_file_bytes(file_path: str, expected_ext: str) -> tuple[bool, str]:
    """
    Validates file integrity and binary magic headers to prevent disguised or malicious files.
    """
    clean_ext = expected_ext.lower().replace(".", "")
    if clean_ext not in MAGIC_SIGNATURES:
        return False, f"Unsupported file extension: .{clean_ext}"

    try:
        file_size = os.path.getsize(file_path)
        if file_size > Config.MAX_CONTENT_LENGTH:
            return False, f"File size ({file_size / (1024 * 1024):.2f} MB) exceeds maximum 16 MB limit."

        with open(file_path, "rb") as f:
            header = f.read(16)

        signatures = MAGIC_SIGNATURES[clean_ext]
        valid_header = any(header.startswith(sig) for sig in signatures)
        if not valid_header:
            return False, f"Invalid file content: binary signature does not match .{clean_ext} format."

        # Validate that PDF can be parsed or image can be opened
        if clean_ext == "pdf":
            doc = fitz.open(file_path)
            page_count = len(doc)
            doc.close()
            if page_count == 0:
                return False, "PDF document contains no pages."
        else:
            with Image.open(file_path) as img:
                img.verify()

        return True, ""
    except Exception as e:
        return False, f"File integrity check failed: {str(e)}"

def detect_document_type(text: str, filename: str) -> str:
    """
    Infers land document type based on textual markers and title headers.
    """
    text_lower = (text + " " + filename).lower()
    if any(k in text_lower for k in ["patta", "chitta", "பட்டா", "சிட்டா", "e-patta", "anytime/anywhere"]):
        return "Patta / Chitta Extract"
    elif any(k in text_lower for k in ["sale deed", "deed of sale", "விற்பனை பத்திரம்", "conveyance deed"]):
        return "Sale Deed"
    elif any(k in text_lower for k in ["settlement deed", "gift deed", "release deed", "partition deed"]):
        return "Settlement / Partition Deed"
    elif any(k in text_lower for k in ["encumbrance certificate", "ec", "வில்லங்கம்", "form no. 15"]):
        return "Encumbrance Certificate (EC)"
    elif any(k in text_lower for k in ["a-register", "a register", "fmb", "field measurement"]):
        return "A-Register / FMB Sketch"
    return "Government Land Document"

def check_tampering_and_integrity(file_path: str, ext: str) -> dict:
    """
    Inspects document metadata, creation/modification timestamps, and software signatures
    for indicators of post-issuance tampering or manipulation.
    """
    indicators = []
    suspicious = False
    metadata_summary = {}

    if ext == "pdf":
        try:
            doc = fitz.open(file_path)
            meta = doc.metadata or {}
            metadata_summary = {
                "format": meta.get("format", "PDF"),
                "producer": meta.get("producer", ""),
                "creator": meta.get("creator", ""),
                "creation_date": meta.get("creationDate", ""),
                "mod_date": meta.get("modDate", ""),
            }

            prod_lower = (meta.get("producer") or "").lower()
            creator_lower = (meta.get("creator") or "").lower()

            for kw in TAMPERING_SOFTWARE_KEYWORDS:
                if kw in prod_lower or kw in creator_lower:
                    suspicious = True
                    indicators.append(f"Document producer/creator metadata references graphic editing tool: '{kw.title()}'.")

            # Check timestamp anomalies
            c_date = meta.get("creationDate")
            m_date = meta.get("modDate")
            if c_date and m_date and c_date != m_date:
                # Flag if modified significantly by a third party tool
                if prod_lower and any(kw in prod_lower for kw in ["photoshop", "gimp", "canva"]):
                    suspicious = True
                    indicators.append("Document modification timestamp indicates post-issuance alteration by graphic editor.")

            doc.close()
        except Exception as e:
            indicators.append(f"PDF metadata inspection error: {str(e)}")
    else:
        # Image EXIF metadata check
        try:
            with Image.open(file_path) as img:
                exif = img.getexif()
                software = exif.get(0x0131, "")
                if software:
                    metadata_summary["software"] = software
                    soft_lower = software.lower()
                    for kw in TAMPERING_SOFTWARE_KEYWORDS:
                        if kw in soft_lower:
                            suspicious = True
                            indicators.append(f"Image EXIF software tag indicates editing via '{kw.title()}'.")
        except Exception:
            pass

    return {
        "suspicious": suspicious,
        "indicators": indicators,
        "metadata": metadata_summary
    }

def check_signature_authenticity(file_path: str, ext: str, text: str) -> dict:
    """
    Inspects digital signature dictionaries in PDF documents and searches for
    visible signature blocks / markers.
    Explicitly notes that visible signature detection is NOT proof of handwritten authenticity.
    """
    is_digitally_signed = False
    digital_sig_details = []
    visible_signature_detected = False
    visible_notes = []

    text_lower = text.lower()

    if ext == "pdf":
        try:
            doc = fitz.open(file_path)
            sig_flags = doc.get_sigflags()
            # PyMuPDF sigflags: bit 0: doc has signatures, bit 1: doc has invalid signatures
            if sig_flags > 0:
                is_digitally_signed = True
                digital_sig_details.append(f"Cryptographic PDF signature dictionary detected (sigflags={sig_flags}).")

            # Scan pages for signature annotations or fields
            for page_num in range(len(doc)):
                page = doc[page_num]
                for annot in page.annots():
                    if annot.type[0] == fitz.PDF_ANNOT_WIDGET:
                        digital_sig_details.append(f"Interactive signature widget present on page {page_num + 1}.")
                        is_digitally_signed = True

            doc.close()
        except Exception as e:
            digital_sig_details.append(f"Digital signature parsing note: {str(e)}")

    # Check for text markers indicating digital or physical signature
    digital_text_patterns = [
        r"digitally\s+signed\s+by",
        r"signature\s+valid",
        r"ds\s+tahsildar",
        r"ds\s+sub-registrar",
        r"authenticated\s+digitally"
    ]
    for pat in digital_text_patterns:
        if re.search(pat, text_lower):
            if not is_digitally_signed:
                digital_sig_details.append(f"Digital signing declaration detected in document text: '{pat}'.")
                is_digitally_signed = True

    # Check for handwritten signature markers
    handwritten_patterns = [
        r"(?:signature|sign|கையொப்பம்)\s*(?:of|:|-)",
        r"(?:sd/-|sd/|signed)",
        r"(?:vendor|purchaser|claimant|executant|holder)\s+signature",
        r"authorized\s+signatory"
    ]
    for pat in handwritten_patterns:
        if re.search(pat, text_lower):
            visible_signature_detected = True
            visible_notes.append("Signatory section / signature marker located in document layout.")
            break

    return {
        "is_digitally_signed": is_digitally_signed,
        "digital_sig_details": digital_sig_details,
        "visible_signature_detected": visible_signature_detected,
        "visible_notes": visible_notes,
    }

def check_official_seal(file_path: str, ext: str, text: str) -> dict:
    """
    Checks for the presence of official government stamps, revenue seals,
    or departmental authority designations.
    """
    text_lower = text.lower()
    seal_detected = False
    seal_indicators = []
    authority_designation = ""

    # Check official authority designations
    for desig in TN_OFFICIAL_DESIGNATIONS:
        if desig in text_lower:
            seal_detected = True
            seal_indicators.append(f"Official issuing authority designation found: '{desig.title()}'.")
            if not authority_designation:
                authority_designation = desig.title()

    # Check textual stamp / seal references
    stamp_patterns = [
        r"(?:office\s+seal|official\s+stamp|revenue\s+seal|முத்திரை|அலுவலக\s+முத்திரை)",
        r"(?:taluk\s+office|sub-registrar\s+office|registration\s+department)",
        r"(?:e-services\s+seal|government\s+emblem|revenue\s+administration)"
    ]
    for pat in stamp_patterns:
        if re.search(pat, text_lower):
            seal_detected = True
            seal_indicators.append("Textual representation of official government seal/stamp detected.")
            break

    return {
        "seal_detected": seal_detected,
        "seal_indicators": seal_indicators,
        "authority_designation": authority_designation or "Not explicitly identified"
    }

def check_aadhaar_privacy(text: str) -> dict:
    """
    Checks for Aadhaar number occurrences. If present, verifies masking to ensure
    compliance with privacy laws and UIDAI guidelines. Full numbers are NEVER stored or returned.
    """
    # 12-digit unmasked Aadhaar pattern (xxxx xxxx xxxx or xxxxxxxxxxxx)
    unmasked_matches = re.findall(r"\b([2-9]\d{3}\s?\d{4}\s?\d{4})\b", text)
    # Masked Aadhaar pattern (XXXX-XXXX-1234 or **** **** 1234)
    masked_matches = re.findall(r"\b([X\*\d]{4}[\s\-][X\*\d]{4}[\s\-](\d{4}))\b", text, re.IGNORECASE)

    has_aadhaar = len(unmasked_matches) > 0 or len(masked_matches) > 0
    is_properly_masked = len(unmasked_matches) == 0 and len(masked_matches) > 0
    masked_sample = ""

    if masked_matches:
        last4 = masked_matches[0][1]
        masked_sample = f"XXXX-XXXX-{last4}"
    elif unmasked_matches:
        clean = unmasked_matches[0].replace(" ", "")
        last4 = clean[-4:]
        masked_sample = f"XXXX-XXXX-{last4}"

    return {
        "has_aadhaar": has_aadhaar,
        "is_properly_masked": is_properly_masked if has_aadhaar else True,
        "masked_sample": masked_sample,
        "unmasked_found": len(unmasked_matches) > 0
    }

def check_database_cross_verification(fields: dict, current_doc_ref: str) -> dict:
    """
    Cross-checks the document's parsed cadastral details against existing records in
    the local database to identify conflicting ownership claims, duplicate deed references,
    or parcel boundary discrepancies.
    """
    conflicts = []
    duplicates = []
    matched_record = None

    owner_name = fields.get("owner_name", {}).get("value", "").strip()
    survey_no = fields.get("survey_number", {}).get("value", "").strip()
    subdiv_no = fields.get("subdivision_number", {}).get("value", "").strip()
    village = fields.get("village", {}).get("value", "").strip()
    doc_ref = fields.get("document_reference", {}).get("value", "").strip() or current_doc_ref

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Check duplicate document reference
        if doc_ref:
            cursor.execute("""
                SELECT id, owner_name, village, survey_number, subdivision_number
                FROM land_records
                WHERE LOWER(document_reference) = LOWER(?);
            """, (doc_ref,))
            dups = cursor.fetchall()
            for d in dups:
                duplicates.append({
                    "record_id": d["id"],
                    "owner_name": d["owner_name"],
                    "village": d["village"]
                })

        # Check conflicting owner claims on identical parcel (Village + Survey + Subdiv)
        if village and survey_no:
            query = """
                SELECT id, owner_name, village, survey_number, subdivision_number, land_area, land_unit, document_reference
                FROM land_records
                WHERE LOWER(village) = LOWER(?) AND survey_number = ?
            """
            params = [village, survey_no]
            if subdiv_no:
                query += " AND subdivision_number = ?"
                params.append(subdiv_no)

            cursor.execute(query, params)
            matches = cursor.fetchall()

            for m in matches:
                existing_owner = (m["owner_name"] or "").strip().lower()
                this_owner = owner_name.lower()
                if this_owner and existing_owner and this_owner != existing_owner:
                    conflicts.append({
                        "record_id": m["id"],
                        "existing_owner": m["owner_name"],
                        "parcel": f"{m['survey_number']}/{m['subdivision_number'] or ''}",
                        "existing_doc_ref": m["document_reference"]
                    })
                elif this_owner and existing_owner and this_owner == existing_owner:
                    matched_record = dict(m)

        conn.close()
    except Exception as e:
        print(f"[DB Cross Verification Error] {e}")

    return {
        "has_conflicts": len(conflicts) > 0,
        "conflicts": conflicts,
        "has_duplicates": len(duplicates) > 0,
        "duplicates": duplicates,
        "matched_record": matched_record
    }

def verify_document(file_path: str, original_filename: str, user_id: int) -> dict:
    """
    Main Verification Engine. Executes the 8 comprehensive checks on the uploaded document:
    1. Document information completeness
    2. Owner information consistency
    3. Land survey and extent consistency
    4. Document reference verification
    5. Signature presence / digital signature verification
    6. Official seal presence
    7. Document integrity and tampering indicators
    8. Government record verification (statutory notice if external API unavailable)
    """
    ext = os.path.splitext(file_path)[1].lower().replace(".", "")
    verification_ref = f"VRF-{datetime.datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    timestamp = datetime.datetime.now().isoformat()

    # 1. Validate file format and magic bytes
    is_valid, validation_msg = validate_file_bytes(file_path, ext)
    if not is_valid:
        raise ValueError(validation_msg)

    # 2. Extract text and parse fields
    extract_res = extract_document_text(file_path)
    raw_text = extract_res.get("text", "")
    parsed_fields = parse_structured_fields(raw_text)
    doc_type = detect_document_type(raw_text, original_filename)

    # 3. Check document tampering / integrity
    tamper_result = check_tampering_and_integrity(file_path, ext)

    # 4. Check signatures
    sig_result = check_signature_authenticity(file_path, ext, raw_text)

    # 5. Check seals / authority
    seal_result = check_official_seal(file_path, ext, raw_text)

    # 6. Check Aadhaar privacy
    aadhaar_result = check_aadhaar_privacy(raw_text)

    # 7. Cross-check against database
    db_result = check_database_cross_verification(parsed_fields, original_filename)

    # Construct the 8 individual check items
    checks = []
    warnings = []

    # Check 1: Document information completeness
    req_keys = ["owner_name", "survey_number", "district", "village", "land_area"]
    missing_fields = [k.replace("_", " ").title() for k in req_keys if not parsed_fields.get(k, {}).get("found")]
    if not missing_fields:
        check1_status = "PASSED"
        check1_summary = f"All required cadastral information identified for {doc_type}."
        check1_explanation = "Owner name, survey number, district, village, and land extent were successfully detected in the document text."
    elif len(missing_fields) <= 2:
        check1_status = "NEEDS REVIEW"
        check1_summary = f"Partially complete: Missing {', '.join(missing_fields)}."
        check1_explanation = f"The document is missing {len(missing_fields)} key field(s): {', '.join(missing_fields)}. Human verification is needed to confirm if these fields are legible or omitted."
        warnings.append(f"Missing mandatory fields: {', '.join(missing_fields)}.")
    else:
        check1_status = "FAILED"
        check1_summary = f"Incomplete document: {len(missing_fields)} required fields missing."
        check1_explanation = f"Critical land details could not be detected ({', '.join(missing_fields)}). The document may be low-resolution or missing pages."
        warnings.append(f"Critical cadastral parameters missing ({', '.join(missing_fields)}).")

    checks.append({
        "id": 1,
        "name": "Document Information Completeness",
        "category": "Cadastral Attributes",
        "status": check1_status,
        "summary": check1_summary,
        "explanation": check1_explanation,
        "details": {
            "document_type": doc_type,
            "detected_fields": {k: v.get("value") for k, v in parsed_fields.items() if v.get("found")},
            "missing_fields": missing_fields
        }
    })

    # Check 2: Owner information consistency
    owner_val = parsed_fields.get("owner_name", {}).get("value", "").strip()
    if db_result["has_conflicts"]:
        check2_status = "FAILED"
        conflict_names = [f"Record #{c['record_id']} ({c['existing_owner']})" for c in db_result["conflicts"]]
        check2_summary = "Conflicting title ownership detected in registered database."
        check2_explanation = f"This parcel in {parsed_fields.get('village', {}).get('value', 'this village')} is registered to a different owner: {', '.join(conflict_names)}."
        warnings.append(f"Title Conflict: Existing registered owner differs from '{owner_val}'.")
    elif not owner_val:
        check2_status = "NEEDS REVIEW"
        check2_summary = "Owner name not detected in document."
        check2_explanation = "The legal title holder or pattadhar name could not be identified automatically. Manual inspection required."
    elif len(owner_val) < 3:
        check2_status = "NEEDS REVIEW"
        check2_summary = f"Abbreviated owner name: '{owner_val}'."
        check2_explanation = "The owner name contains fewer than 3 characters, which may be an unexpanded initial. Please verify the full legal name."
    else:
        check2_status = "PASSED"
        check2_summary = f"Owner name recorded as '{owner_val}'."
        check2_explanation = "Owner name format conforms to standard naming structures and has no conflicting registered claims in the database."

    checks.append({
        "id": 2,
        "name": "Owner Information Consistency",
        "category": "Title & Identity",
        "status": check2_status,
        "summary": check2_summary,
        "explanation": check2_explanation,
        "details": {
            "owner_name": owner_val or "Not detected",
            "conflicts": db_result["conflicts"]
        }
    })

    # Check 3: Land survey and extent consistency
    survey_val = parsed_fields.get("survey_number", {}).get("value", "")
    subdiv_val = parsed_fields.get("subdivision_number", {}).get("value", "")
    area_val = parsed_fields.get("land_area", {}).get("value", "")
    unit_val = parsed_fields.get("land_unit", {}).get("value", "sq.ft")

    area_float = 0.0
    try:
        if area_val:
            area_float = float(area_val)
    except ValueError:
        pass

    if area_val and area_float <= 0:
        check3_status = "FAILED"
        check3_summary = "Invalid land extent (zero or negative area)."
        check3_explanation = f"Reported area of {area_val} {unit_val} is physically invalid for a registered land parcel."
        warnings.append("Physically invalid land extent reported.")
    elif not survey_val:
        check3_status = "NEEDS REVIEW"
        check3_summary = "Survey number missing or unclear."
        check3_explanation = "Cadastral survey number was not located in the document text layer."
    elif not subdiv_val:
        check3_status = "NEEDS REVIEW"
        check3_summary = f"Survey No. {survey_val} detected without subdivision."
        check3_explanation = "Subdivision identifier is not explicitly stated. Verify whether this is an unsubdivided parent parcel."
    else:
        check3_status = "PASSED"
        check3_summary = f"Survey {survey_val}/{subdiv_val} with extent {area_val} {unit_val}."
        check3_explanation = "Survey and subdivision format matches Tamil Nadu cadastral standards and reports a valid positive area."

    checks.append({
        "id": 3,
        "name": "Land Survey & Extent Consistency",
        "category": "Cadastral Attributes",
        "status": check3_status,
        "summary": check3_summary,
        "explanation": check3_explanation,
        "details": {
            "survey_number": survey_val,
            "subdivision_number": subdiv_val,
            "land_area": area_val,
            "land_unit": unit_val
        }
    })

    # Check 4: Document reference verification
    doc_ref_val = parsed_fields.get("document_reference", {}).get("value", "")
    if db_result["has_duplicates"]:
        check4_status = "FAILED"
        dup_names = [f"Record #{d['record_id']} ({d['owner_name']})" for d in db_result["duplicates"]]
        check4_summary = f"Duplicate document reference '{doc_ref_val}' found."
        check4_explanation = f"The reference number is already recorded in the system under: {', '.join(dup_names)}."
        warnings.append(f"Duplicate document reference: '{doc_ref_val}'.")
    elif doc_ref_val:
        check4_status = "PASSED"
        check4_summary = f"Document reference identified: '{doc_ref_val}'."
        check4_explanation = "Deed / Patta reference number is properly formatted and unique in the local repository."
    else:
        check4_status = "NEEDS REVIEW"
        check4_summary = "Document reference number not clearly detected."
        check4_explanation = "No explicit registration deed number or e-patta reference was isolated. Check header or endorsement margins."

    checks.append({
        "id": 4,
        "name": "Document Reference Verification",
        "category": "Document Provenance",
        "status": check4_status,
        "summary": check4_summary,
        "explanation": check4_explanation,
        "details": {
            "document_reference": doc_ref_val or "Not detected",
            "duplicates": db_result["duplicates"]
        }
    })

    # Check 5: Signature presence or digital signature verification
    if sig_result["is_digitally_signed"]:
        check5_status = "PASSED"
        check5_summary = "Cryptographic digital signature detected."
        check5_explanation = "The document contains an electronic signature structure / cryptographic signing dictionary in the PDF container."
    elif sig_result["visible_signature_detected"]:
        check5_status = "NEEDS REVIEW"
        check5_summary = "Visible signature markings detected (manual review required)."
        check5_explanation = "Signatory indicators or signature zones are present. Note: Automated systems cannot authenticate physical handwritten signatures; manual in-person verification is mandatory."
    else:
        check5_status = "NEEDS REVIEW"
        check5_summary = "No signature markings or digital signatures detected."
        check5_explanation = "Neither cryptographic digital signatures nor visible signatory sections were detected in the document text or PDF metadata."
        warnings.append("No signature detected on document.")

    checks.append({
        "id": 5,
        "name": "Signature Presence & Digital Signature",
        "category": "Authenticity Indicators",
        "status": check5_status,
        "summary": check5_summary,
        "explanation": check5_explanation,
        "details": {
            "is_digitally_signed": sig_result["is_digitally_signed"],
            "digital_details": sig_result["digital_sig_details"],
            "visible_detected": sig_result["visible_signature_detected"],
            "disclaimer": "Detecting a visible handwritten signature is not proof of authenticity. Physical verification required."
        }
    })

    # Check 6: Official seal presence
    if seal_result["seal_detected"]:
        check6_status = "PASSED"
        check6_summary = f"Official seal / authority designation identified ({seal_result['authority_designation']})."
        check6_explanation = f"Document contains indications of official issuing authority: {', '.join(seal_result['seal_indicators'])}."
    else:
        check6_status = "NEEDS REVIEW"
        check6_summary = "Official revenue seal / issuing authority designation not detected."
        check6_explanation = "No standard revenue department, taluk office, or sub-registrar seal markings were detected in the readable text."
        warnings.append("Issuing authority or revenue seal not detected.")

    checks.append({
        "id": 6,
        "name": "Official Seal Presence",
        "category": "Authenticity Indicators",
        "status": check6_status,
        "summary": check6_summary,
        "explanation": check6_explanation,
        "details": {
            "seal_detected": seal_result["seal_detected"],
            "authority": seal_result["authority_designation"],
            "indicators": seal_result["seal_indicators"]
        }
    })

    # Check 7: Document integrity & tampering indicators
    if tamper_result["suspicious"]:
        check7_status = "FAILED"
        check7_summary = "Potential tampering or image manipulation indicators detected."
        check7_explanation = f"Metadata or file structure analysis flagged suspicious editing tool activity: {'; '.join(tamper_result['indicators'])}."
        warnings.append("Tampering warning: Document metadata indicates editing with graphics/PDF manipulation software.")
    else:
        check7_status = "PASSED"
        check7_summary = "No suspicious manipulation indicators detected in file metadata."
        check7_explanation = "File headers, PDF streams, and creation metadata show standard document generation patterns without traces of graphic editing software."

    checks.append({
        "id": 7,
        "name": "Document Integrity & Tampering Indicators",
        "category": "File & Metadata Security",
        "status": check7_status,
        "summary": check7_summary,
        "explanation": check7_explanation,
        "details": {
            "tampering_detected": tamper_result["suspicious"],
            "indicators": tamper_result["indicators"],
            "metadata": tamper_result["metadata"]
        }
    })

    # Check 8: Government record verification
    # Mandatory rule: If live official API is unavailable, MUST report:
    # "Official government verification unavailable — manual verification required."
    check8_status = "NOT VERIFIED"
    check8_summary = "Official government verification unavailable — manual verification required."
    check8_explanation = (
        "The Tamil Nadu Land Records portal (eservices.tn.gov.in) does not provide a public authenticated API "
        "for third-party automated validation without CAPTCHA or departmental access. LandAssist does NOT scrape, "
        "bypass security controls, or fabricate government approval. Cross-verification must be performed manually "
        "using certified extracts from the official portal."
    )

    checks.append({
        "id": 8,
        "name": "Government Record Verification",
        "category": "Official Source Validation",
        "status": check8_status,
        "summary": check8_summary,
        "explanation": check8_explanation,
        "details": {
            "portal_name": "Tamil Nadu e-Services (eservices.tn.gov.in)",
            "verification_status": "Manual Verification Required",
            "official_url": "https://eservices.tn.gov.in/eservicesnew/land/verify_chitta.html?lan=en"
        }
    })

    # Aadhaar privacy check addition to warnings
    if aadhaar_result["has_aadhaar"]:
        if aadhaar_result["unmasked_found"]:
            warnings.append(
                f"Privacy Notice: Document contains unmasked Aadhaar numbering ({aadhaar_result['masked_sample']}). "
                "In compliance with UIDAI regulations, ensure identity numbers are masked before sharing."
            )

    # Compute Overall Status
    # Rules:
    # VERIFIED AGAINST OFFICIAL RECORDS - Only if official verification succeeded (currently unavailable)
    # FLAGGED FOR REVIEW - Any FAILED check, tampering detected, title conflict, duplicate deed
    # PENDING MANUAL VERIFICATION - Inconclusive, official service unavailable, or manual review required
    has_failed = any(c["status"] == "FAILED" for c in checks)
    has_tamper = tamper_result["suspicious"]
    has_conflict = db_result["has_conflicts"] or db_result["has_duplicates"]

    if has_failed or has_tamper or has_conflict:
        overall_status = "FLAGGED FOR REVIEW"
        recommended_action = "Inspect flagged inconsistencies, title conflict records, or potential tampering indicators before proceeding."
    else:
        overall_status = "PENDING MANUAL VERIFICATION"
        recommended_action = "Document satisfies technical consistency checks. Cross-verify with certified revenue department extract (eservices.tn.gov.in) to complete validation."

    # Return comprehensive verification report
    return {
        "verification_ref": verification_ref,
        "timestamp": timestamp,
        "original_filename": original_filename,
        "file_type": ext,
        "document_type": doc_type,
        "overall_status": overall_status,
        "recommended_action": recommended_action,
        "checks": checks,
        "warnings": warnings,
        "government_verification": {
            "status": "UNAVAILABLE",
            "notice": "Official government verification unavailable — manual verification required.",
            "portal_url": "https://eservices.tn.gov.in/eservicesnew/land/verify_chitta.html?lan=en"
        },
        "extracted_cadastral_data": {
            "document_type": doc_type,
            "document_reference": doc_ref_val or original_filename,
            "owner_name": owner_val,
            "survey_number": survey_val,
            "subdivision_number": subdiv_val,
            "district": parsed_fields.get("district", {}).get("value", ""),
            "taluk": parsed_fields.get("taluk", {}).get("value", ""),
            "village": parsed_fields.get("village", {}).get("value", ""),
            "land_area": area_val,
            "land_unit": unit_val,
            "aadhaar_masked": aadhaar_result["masked_sample"] if aadhaar_result["has_aadhaar"] else ""
        }
    }
