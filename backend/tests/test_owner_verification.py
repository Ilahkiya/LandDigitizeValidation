import io
import json
import pytest
import tempfile
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import Config
from app import create_app
from db import get_db_connection, init_db
from otp_service import (
    validate_aadhaar, mask_aadhaar,
    validate_pan, mask_pan,
    validate_mobile, normalize_mobile,
    hash_identity, send_mobile_otp, verify_mobile_otp
)

@pytest.fixture
def test_app():
    temp_dir = tempfile.mkdtemp()
    test_db = os.path.join(temp_dir, 'test_owner_verif.db')
    test_uploads = os.path.join(temp_dir, 'test_uploads')

    class TestConfig(Config):
        TESTING = True
        DATABASE_PATH = test_db
        UPLOAD_FOLDER = test_uploads
        SECRET_KEY = 'test-secret-key-salt-98341'
        SMS_GATEWAY_DEV_MODE = True

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

@pytest.fixture
def owner_client(client):
    client.post('/api/auth/login', json={
        'email': 'owner@landassist.local',
        'password': 'OwnerPass123!'
    })
    return client

def test_aadhaar_validation_and_masking():
    # Valid Aadhaar
    is_valid, cleaned, err = validate_aadhaar("9876 5432 1098")
    assert is_valid is True
    assert cleaned == "987654321098"
    assert mask_aadhaar(cleaned) == "•••• •••• 1098"

    # Hashed identity must not reveal original digits
    h = hash_identity(cleaned)
    assert len(h) == 64
    assert "987654321098" not in h

    # Invalid: non-numeric
    is_valid, _, err = validate_aadhaar("9876543210AB")
    assert is_valid is False

    # Invalid: wrong length
    is_valid, _, err = validate_aadhaar("123456789")
    assert is_valid is False

    # Invalid: repetitive digits
    is_valid, _, err = validate_aadhaar("111111111111")
    assert is_valid is False

def test_pan_validation_and_masking():
    # Valid PAN
    is_valid, cleaned, err = validate_pan("abcde1234f")
    assert is_valid is True
    assert cleaned == "ABCDE1234F"
    assert mask_pan(cleaned) == "ABCDE••••F"

    # Invalid PAN format
    is_valid, _, err = validate_pan("12345ABCDE")
    assert is_valid is False

    is_valid, _, err = validate_pan("ABCDE123")
    assert is_valid is False

def test_mobile_validation_and_normalization():
    # 10-digit Indian mobile
    is_valid, norm, err = validate_mobile("9876543210")
    assert is_valid is True
    assert norm == "+919876543210"

    # Formatted Indian mobile
    is_valid, norm, err = validate_mobile("+91 98765-43210")
    assert is_valid is True
    assert norm == "+919876543210"

    # Invalid mobile
    is_valid, _, err = validate_mobile("123")
    assert is_valid is False

def test_otp_generation_and_expiry(test_app):
    with test_app.app_context():
        mobile = "+919111222333"
        success, res, code = send_mobile_otp(mobile)
        assert success is True
        assert code == 200
        assert res["status"] == "OTP Sent"
        assert "dev_otp" in res
        otp_generated = res["dev_otp"]
        assert len(otp_generated) == 6

        # Verify OTP
        v_success, v_res, v_code = verify_mobile_otp(mobile, otp_generated)
        assert v_success is True
        assert v_code == 200
        assert v_res["status"] == "Verified"

def test_otp_attempt_limits(test_app):
    with test_app.app_context():
        mobile = "+919222333444"
        success, res, _ = send_mobile_otp(mobile)
        assert success is True

        # Incorrect attempt 1
        s, r, c = verify_mobile_otp(mobile, "000000")
        assert s is False
        assert r["attempts_remaining"] == 2

        # Incorrect attempt 2
        s, r, c = verify_mobile_otp(mobile, "111111")
        assert s is False
        assert r["attempts_remaining"] == 1

        # Incorrect attempt 3
        s, r, c = verify_mobile_otp(mobile, "222222")
        assert s is False
        assert r["attempts_remaining"] == 0

        # Further attempts fail
        s, r, c = verify_mobile_otp(mobile, res["dev_otp"])
        assert s is False

def test_otp_resend_cooldown(test_app):
    with test_app.app_context():
        mobile = "+919333444555"
        success1, _, code1 = send_mobile_otp(mobile)
        assert success1 is True

        # Immediate second request triggers cooldown
        success2, res2, code2 = send_mobile_otp(mobile)
        assert success2 is False
        assert code2 == 429
        assert "cooldown_remaining" in res2

def test_sms_gateway_unconfigured_error(test_app):
    with test_app.app_context():
        # Temporarily disable DEV mode and clear Twilio configs
        test_app.config["SMS_GATEWAY_DEV_MODE"] = False
        Config.SMS_GATEWAY_DEV_MODE = False
        Config.TWILIO_ACCOUNT_SID = ""
        Config.TWILIO_AUTH_TOKEN = ""
        Config.TWILIO_PHONE_NUMBER = ""
        test_app.config["TESTING"] = False

        mobile = "+919444555666"
        success, res, code = send_mobile_otp(mobile)
        assert success is False
        assert code == 503
        assert "SMS OTP Gateway is not configured" in res["error"]

        # Restore dev mode
        Config.SMS_GATEWAY_DEV_MODE = True
        test_app.config["TESTING"] = True

def test_photo_upload_endpoint(owner_client):
    # Test valid image
    fake_png = io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4")
    res = owner_client.post('/api/records/owner-photo', data={
        'photo': (fake_png, 'passport.png')
    }, content_type='multipart/form-data')

    assert res.status_code == 201
    data = res.get_json()
    assert data["photo_id"] > 0
    assert "photo_url" in data

    # Test invalid extension
    fake_txt = io.BytesIO(b"hello world")
    bad_res = owner_client.post('/api/records/owner-photo', data={
        'photo': (fake_txt, 'file.txt')
    }, content_type='multipart/form-data')
    assert bad_res.status_code == 400

def test_parcel_registration_with_owner_details(owner_client, test_app):
    # First verify a mobile number in the backend
    mobile = "+919876543210"
    with test_app.app_context():
        _, s_res, _ = send_mobile_otp(mobile)
        _, v_res, _ = verify_mobile_otp(mobile, s_res["dev_otp"])
        assert v_res["status"] == "Verified"

    # Register parcel with owner identity
    parcel_payload = {
        "owner_name": "Dr. K. Annamalai",
        "previous_owner_name": "S. Velusamy",
        "ownership_type": "Sole Ownership",
        "owner_address": "45, Trichy Main Road, Coimbatore",
        "aadhaar_number": "5432 1098 7654",
        "pan_number": "ABCDE1234F",
        "owner_mobile": mobile,
        "mobile_verification_status": "Verified",
        "owner_mobile_verified": 1,
        "document_type": "Patta",
        "document_reference": "PAT-2026-CBE-9912",
        "registration_date": "2026-01-15",
        "patta_number": "PAT-88120",
        "district": "Coimbatore",
        "taluk": "Coimbatore North",
        "village": "Saravanampatti",
        "survey_number": "412",
        "subdivision_number": "3B",
        "land_area": 2400.0,
        "land_unit": "sq.ft",
        "boundary_north": "Survey No 412/3A",
        "boundary_south": "20ft Panchayat Road",
        "boundary_east": "Plot No 4",
        "boundary_west": "Survey No 411",
        "adjacent_survey_numbers": "411, 412/3A",
        "access_road_details": "20ft paved road connecting to Sathy Road"
    }

    create_res = owner_client.post('/api/records', json=parcel_payload)
    assert create_res.status_code == 201
    create_data = create_res.get_json()
    rec_id = create_data["record_id"]

    # Fetch record and verify masked values and verification status
    get_res = owner_client.get(f'/api/records/{rec_id}')
    assert get_res.status_code == 200
    rec = get_res.get_json()["record"]

    # Sensitive values must be masked
    assert rec["aadhaar_masked"] == "•••• •••• 7654"
    assert rec["pan_masked"] == "ABCDE••••F"
    assert rec["owner_mobile"] == mobile
    assert rec["mobile_verification_status"] == "Verified"
    assert rec["owner_mobile_verified"] == 1

    # Plaintext numbers MUST NOT be in record dictionary
    assert "aadhaar_number" not in rec or rec.get("aadhaar_number") is None
    assert "pan_number" not in rec or rec.get("pan_number") is None
