import io
import json
import os
import sys
import tempfile
from pathlib import Path
import pytest
from PIL import Image
import fitz

# Ensure backend in path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import Config
from app import create_app
from db import init_db, get_db_connection
from verification_engine import (
    validate_file_bytes,
    verify_document,
    check_aadhaar_privacy,
    check_tampering_and_integrity
)

@pytest.fixture
def test_app():
    temp_dir = tempfile.mkdtemp()
    test_db = os.path.join(temp_dir, "test_verification.db")
    test_uploads = os.path.join(temp_dir, "test_uploads")

    class TestConfig(Config):
        TESTING = True
        DATABASE_PATH = test_db
        UPLOAD_FOLDER = test_uploads
        SECRET_KEY = "test-secret-key"

    app = create_app(TestConfig)
    with app.app_context():
        init_db()

    yield app

    if os.path.exists(test_db):
        try:
            os.remove(test_db)
        except Exception:
            pass

@pytest.fixture
def client(test_app):
    return test_app.test_client()

def create_sample_pdf(filepath: str, text: str, producer: str = "Government Printing Office"):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 72), text, fontsize=11)
    doc.set_metadata({"producer": producer, "creator": "Official Revenue Portal"})
    doc.save(filepath)
    doc.close()

def create_sample_image(filepath: str, format="PNG"):
    img = Image.new("RGB", (400, 200), color=(255, 255, 255))
    img.save(filepath, format=format)

def test_file_magic_bytes_validation(tmp_path):
    # 1. Valid PDF
    valid_pdf = tmp_path / "valid.pdf"
    create_sample_pdf(str(valid_pdf), "Patta Document Test")
    is_valid, msg = validate_file_bytes(str(valid_pdf), "pdf")
    assert is_valid is True
    assert msg == ""

    # 2. Fake PDF (text file renamed to .pdf)
    fake_pdf = tmp_path / "fake.pdf"
    fake_pdf.write_text("This is plain text pretending to be PDF.")
    is_valid, msg = validate_file_bytes(str(fake_pdf), "pdf")
    assert is_valid is False
    assert "binary signature does not match" in msg

    # 3. Valid PNG image
    valid_png = tmp_path / "valid.png"
    create_sample_image(str(valid_png), format="PNG")
    is_valid, msg = validate_file_bytes(str(valid_png), "png")
    assert is_valid is True

    # 4. Valid JPG image
    valid_jpg = tmp_path / "valid.jpg"
    create_sample_image(str(valid_jpg), format="JPEG")
    is_valid, msg = validate_file_bytes(str(valid_jpg), "jpg")
    assert is_valid is True

    # 5. Unsupported extension
    unsupported = tmp_path / "test.txt"
    unsupported.write_text("Hello World")
    is_valid, msg = validate_file_bytes(str(unsupported), "txt")
    assert is_valid is False
    assert "Unsupported file extension" in msg

def test_aadhaar_masking_privacy():
    # 1. Unmasked Aadhaar presence
    text_unmasked = "Owner Aadhaar Number: 5412 8901 2345 registered with revenue."
    res = check_aadhaar_privacy(text_unmasked)
    assert res["has_aadhaar"] is True
    assert res["unmasked_found"] is True
    # Masked output must never reveal first 8 digits
    assert res["masked_sample"] == "XXXX-XXXX-2345"
    assert "5412" not in res["masked_sample"]

    # 2. Already masked Aadhaar
    text_masked = "Aadhaar: XXXX-XXXX-9876 verified by nodal officer."
    res2 = check_aadhaar_privacy(text_masked)
    assert res2["has_aadhaar"] is True
    assert res2["is_properly_masked"] is True
    assert res2["masked_sample"] == "XXXX-XXXX-9876"

    # 3. No Aadhaar present
    text_none = "Patta No: 4412 in Saravanampatti village."
    res3 = check_aadhaar_privacy(text_none)
    assert res3["has_aadhaar"] is False

def test_tampering_software_detection(tmp_path):
    tampered_pdf = tmp_path / "tampered.pdf"
    create_sample_pdf(str(tampered_pdf), "Altered Land Deed", producer="Adobe Photoshop CC 2023")
    res = check_tampering_and_integrity(str(tampered_pdf), "pdf")
    assert res["suspicious"] is True
    assert any("Photoshop" in ind for ind in res["indicators"])

    clean_pdf = tmp_path / "clean.pdf"
    create_sample_pdf(str(clean_pdf), "Clean Government Extract", producer="Tamil Nadu Revenue Portal PDFGen")
    res_clean = check_tampering_and_integrity(str(clean_pdf), "pdf")
    assert res_clean["suspicious"] is False

def test_verify_document_engine_checks(test_app, tmp_path):
    with test_app.app_context():
        doc_text = """
        GOVERNMENT OF TAMIL NADU - REVENUE DEPARTMENT
        Tahsildar, Coimbatore North Taluk
        Patta / Chitta Extract - e-Services Portal
        
        Patta No: 5420
        Owner Name: Rajesh Kumar
        District: Coimbatore
        Taluk: Coimbatore North
        Village: Saravanampatti
        Survey No: 142/3A
        Extent: 2400 sq.ft
        Doc Ref: PATTA-2024-5420
        
        Sd/- Tahsildar
        Official Seal of Coimbatore North Taluk Office
        """
        pdf_path = tmp_path / "patta_valid.pdf"
        create_sample_pdf(str(pdf_path), doc_text)

        report = verify_document(str(pdf_path), "patta_valid.pdf", user_id=1)

        # Check report format
        assert "verification_ref" in report
        assert report["verification_ref"].startswith("VRF-")
        assert len(report["checks"]) == 8

        # Check 1: Completeness
        chk1 = next(c for c in report["checks"] if c["id"] == 1)
        assert chk1["status"] == "PASSED"

        # Check 2: Owner consistency
        chk2 = next(c for c in report["checks"] if c["id"] == 2)
        assert chk2["status"] == "PASSED"

        # Check 3: Survey & Extent
        chk3 = next(c for c in report["checks"] if c["id"] == 3)
        assert chk3["status"] == "PASSED"

        # Check 6: Official Seal
        chk6 = next(c for c in report["checks"] if c["id"] == 6)
        assert chk6["status"] == "PASSED"
        assert "Tahsildar" in chk6["details"]["authority"]

        # Check 7: Document integrity
        chk7 = next(c for c in report["checks"] if c["id"] == 7)
        assert chk7["status"] == "PASSED"

        # Check 8: Government record verification - MUST BE NOT VERIFIED with statutory notice
        chk8 = next(c for c in report["checks"] if c["id"] == 8)
        assert chk8["status"] == "NOT VERIFIED"
        assert "Official government verification unavailable — manual verification required." in chk8["summary"]

        # Overall status must NOT claim approved by government
        assert report["overall_status"] == "PENDING MANUAL VERIFICATION"
        assert "Official government verification unavailable" in report["government_verification"]["notice"]

def test_verify_document_endpoint_api(client, tmp_path):
    # 1. Login as owner
    client.post("/api/auth/login", json={
        "email": "owner@landassist.local",
        "password": "OwnerPass123!"
    })

    # 2. Upload valid PDF for verification
    doc_text = """
    GOVERNMENT OF TAMIL NADU
    Sub-Registrar Office, Peelamedu
    Deed of Sale No: 1204/2024
    Owner Name: M. Rajesh
    District: Coimbatore
    Taluk: Coimbatore South
    Village: Ramanathapuram
    Survey No: 88/2
    Extent: 1800 sq.ft
    Doc Ref: DEED-2024-1204
    Authorized Signatory: Sub-Registrar
    """
    sample_pdf = tmp_path / "sample_deed.pdf"
    create_sample_pdf(str(sample_pdf), doc_text)

    with open(sample_pdf, "rb") as f:
        res = client.post("/api/documents/verify", data={"file": (f, "sample_deed.pdf")}, content_type="multipart/form-data")

    assert res.status_code == 200
    data = res.get_json()
    assert "verification" in data
    assert "document" in data
    doc_id = data["document"]["id"]
    verification = data["verification"]
    assert verification["overall_status"] in {"PENDING MANUAL VERIFICATION", "FLAGGED FOR REVIEW"}
    assert len(verification["checks"]) == 8

    # 3. Retrieve stored verification record
    get_res = client.get(f"/api/documents/{doc_id}/verification")
    assert get_res.status_code == 200
    saved_v = get_res.get_json()
    assert saved_v["verification_ref"] == verification["verification_ref"]

def test_verify_document_endpoint_rejections(client, tmp_path):
    client.post("/api/auth/login", json={
        "email": "owner@landassist.local",
        "password": "OwnerPass123!"
    })

    # 1. Unsupported file extension (.exe)
    bad_file = tmp_path / "malicious.exe"
    bad_file.write_bytes(b"MZ\x90\x00BinaryContent")
    with open(bad_file, "rb") as f:
        res = client.post("/api/documents/verify", data={"file": (f, "malicious.exe")}, content_type="multipart/form-data")
    assert res.status_code == 400
    assert "Unsupported file format" in res.get_json()["error"]

    # 2. Fake PDF (invalid binary content)
    fake_pdf = tmp_path / "corrupt.pdf"
    fake_pdf.write_bytes(b"NOT_A_PDF_HEADER_1234")
    with open(fake_pdf, "rb") as f:
        res = client.post("/api/documents/verify", data={"file": (f, "corrupt.pdf")}, content_type="multipart/form-data")
    assert res.status_code == 400
    assert "validation failed" in res.get_json()["error"].lower()

    # 3. Missing file payload
    res_empty = client.post("/api/documents/verify", data={}, content_type="multipart/form-data")
    assert res_empty.status_code == 400

def test_verify_conflicting_owner_detection(test_app, tmp_path):
    with test_app.app_context():
        # Saravanampatti 142/3A is registered to Rajesh Kumar in seed data
        # Uploading with owner K. Subramaniam must trigger a conflict
        doc_text = """
        GOVERNMENT OF TAMIL NADU
        Village: Saravanampatti
        Survey No: 142/3A
        District: Coimbatore
        Taluk: Coimbatore North
        Extent: 2400 sq.ft
        Owner Name: K. Subramaniam
        Document Reference: DOC-CONF-001
        """
        conf_pdf = tmp_path / "conflict_doc.pdf"
        create_sample_pdf(str(conf_pdf), doc_text)

        report = verify_document(str(conf_pdf), "conflict_doc.pdf", user_id=1)
        chk2 = next(c for c in report["checks"] if c["id"] == 2)
        assert chk2["status"] == "FAILED"
        assert "Conflicting title ownership detected" in chk2["summary"]
        assert report["overall_status"] == "FLAGGED FOR REVIEW"
