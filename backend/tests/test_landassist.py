import io
import json
import pytest
import tempfile
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from werkzeug.security import check_password_hash
from config import Config
from app import create_app
from db import get_db_connection, init_db
from validation_engine import validate_land_record
from agreement_engine import generate_agreement_draft
from pdf_generator import generate_agreement_pdf

@pytest.fixture
def test_app():
    temp_dir = tempfile.mkdtemp()
    test_db = os.path.join(temp_dir, "test_landassist.db")
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

    # Cleanup
    if os.path.exists(test_db):
        try:
            os.remove(test_db)
        except Exception:
            pass

@pytest.fixture
def client(test_app):
    return test_app.test_client()

def test_auth_registration_and_hashing(client):
    # 1. Register new user
    res = client.post("/api/auth/register", json={
        "email": "testowner@example.com",
        "password": "Password123!",
        "full_name": "Test Property Owner",
        "role": "owner"
    })
    assert res.status_code == 201
    data = res.get_json()
    assert data["user"]["email"] == "testowner@example.com"
    assert data["user"]["role"] == "owner"

    # 2. Verify password is saved as hash and not plain text
    conn = get_db_connection()
    user = conn.execute("SELECT password_hash FROM users WHERE email = 'testowner@example.com';").fetchone()
    conn.close()
    assert user is not None
    assert user["password_hash"] != "Password123!"
    assert check_password_hash(user["password_hash"], "Password123!")

def test_auth_login_logout_and_protection(client):
    # Try accessing protected endpoint without login
    unauth_res = client.get("/api/records")
    assert unauth_res.status_code == 401

    # Login with seeded owner credentials
    login_res = client.post("/api/auth/login", json={
        "email": "owner@landassist.local",
        "password": "OwnerPass123!"
    })
    assert login_res.status_code == 200
    assert login_res.get_json()["user"]["role"] == "owner"

    # Now accessing records succeeds
    records_res = client.get("/api/records")
    assert records_res.status_code == 200

    # Logout
    logout_res = client.post("/api/auth/logout")
    assert logout_res.status_code == 200

    # Access is protected again
    after_logout_res = client.get("/api/records")
    assert after_logout_res.status_code == 401

def test_unauthorized_record_access_prevention(client):
    # Login as reviewer
    client.post("/api/auth/login", json={
        "email": "reviewer@landassist.local",
        "password": "ReviewerPass123!"
    })

    # Record #1 belongs to owner, not reviewer
    res = client.get("/api/records/1")
    assert res.status_code == 403
    assert "Access forbidden" in res.get_json()["error"]

def test_land_record_validation_missing_fields():
    # Record with missing required fields
    record = {
        "owner_name": "",
        "district": "",
        "taluk": "",
        "village": "",
        "land_area": "",
        "document_reference": ""
    }
    result = validate_land_record(record)
    assert result["status"] in {"Incomplete", "Needs Review"}
    assert result["total_issues"] >= 4
    field_names = [issue["field"] for issue in result["issues"]]
    assert "owner_name" in field_names
    assert "district" in field_names
    assert "land_area" in field_names

def test_land_record_validation_negative_area():
    record = {
        "owner_name": "Valid Owner",
        "survey_number": "100",
        "subdivision_number": "1",
        "district": "Coimbatore",
        "taluk": "North",
        "village": "Saravanampatti",
        "land_area": -500.0,
        "land_unit": "sq.ft",
        "document_reference": "REF-TEST-001"
    }
    result = validate_land_record(record)
    assert any(i["field"] == "land_area" and "negative" in i["problem"].lower() for i in result["issues"])
    assert result["status"] in {"Incomplete", "Needs Review"}

def test_land_record_validation_duplicate_ref(test_app):
    with test_app.app_context():
        # DOC-SAMPLE-2024-001 is already present in seed data
        record = {
            "owner_name": "New Owner",
            "survey_number": "999",
            "subdivision_number": "1",
            "district": "Madurai",
            "taluk": "South",
            "village": "NewVillage",
            "land_area": 1200.0,
            "land_unit": "sq.ft",
            "document_reference": "DOC-SAMPLE-2024-001"
        }
        result = validate_land_record(record)
        assert result["status"] == "Conflict Detected"
        assert any("duplicate" in i["problem"].lower() for i in result["issues"])

def test_agreement_generator_and_template_fallback():
    prop = {
        "survey_number": "150",
        "subdivision_number": "2B",
        "patta_number": "PAT-5500",
        "village": "Peelamedu",
        "taluk": "Coimbatore East",
        "district": "Coimbatore",
        "land_area": "1800",
        "land_unit": "sq.ft",
        "document_reference": "DOC-TEST-5500"
    }
    first_party = {"name": "S. Murugan", "address": "12 Cross Cut Rd, Coimbatore", "role": "Vendor"}
    second_party = {"name": "R. Anand", "address": "45 Trichy Rd, Coimbatore", "role": "Purchaser"}
    terms = {"amount": "30,00,000", "advance_deposit": "3,00,000", "duration": "60 days", "possession_date": "2026-12-01"}

    draft = generate_agreement_draft("sale", prop, first_party, second_party, terms)
    assert draft["success"] is True
    assert "AGREEMENT FOR SALE" in draft["content"]
    assert "S. Murugan" in draft["content"]
    assert "R. Anand" in draft["content"]
    assert "Peelamedu" in draft["content"]
    assert "DISCLAIMER" in draft["content"]

def test_agreement_pdf_generation():
    title = "Test Agreement Draft"
    content = "THIS IS A TEST AGREEMENT.\n\nBETWEEN: Party A AND Party B.\n\nDISCLAIMER: For testing purposes."
    pdf_buffer = generate_agreement_pdf(title, content, "sale", agreement_id=99)
    assert pdf_buffer is not None
    pdf_bytes = pdf_buffer.getvalue()
    assert len(pdf_bytes) > 500
    assert pdf_bytes.startswith(b"%PDF")

def test_agreement_sharing_and_reviewer_access(client):
    # 1. Login as owner
    client.post("/api/auth/login", json={
        "email": "owner@landassist.local",
        "password": "OwnerPass123!"
    })

    # Share agreement #1 with reviewer
    share_res = client.post("/api/agreements/1/share", json={
        "email": "reviewer@landassist.local"
    })
    assert share_res.status_code == 200

    # 2. Login as reviewer
    client.post("/api/auth/login", json={
        "email": "reviewer@landassist.local",
        "password": "ReviewerPass123!"
    })

    # Reviewer can now view agreement #1
    view_res = client.get("/api/agreements/1")
    assert view_res.status_code == 200
    assert view_res.get_json()["agreement"]["id"] == 1

    # Reviewer can add a comment
    comment_res = client.post("/api/agreements/1/comments", json={
        "comment_text": "Clause 3 needs clarification on payment schedule.",
        "section_ref": "Clause 3"
    })
    assert comment_res.status_code == 201
    assert "comment" in comment_res.get_json()

    # Reviewer can download PDF
    pdf_res = client.get("/api/agreements/1/pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["Content-Type"] == "application/pdf"
