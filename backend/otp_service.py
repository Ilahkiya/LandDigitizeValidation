import os
import re
import hmac
import hashlib
import secrets
import string
import datetime
from flask import current_app
from config import Config
from db import get_db_connection

def hash_identity(val: str) -> str:
    """Hashes sensitive identification numbers using SHA-256 and app secret."""
    if not val:
        return ""
    secret = Config.SECRET_KEY.encode("utf-8")
    data = val.strip().encode("utf-8")
    return hmac.new(secret, data, hashlib.sha256).hexdigest()

def validate_aadhaar(val: str):
    """
    Validates a 12-digit Indian Aadhaar number.
    Returns: (is_valid: bool, cleaned: str, error: str)
    """
    if not val:
        return True, "", ""
    cleaned = re.sub(r"[\s\-]", "", str(val).strip())
    if not cleaned.isdigit():
        return False, cleaned, "Aadhaar number must contain only numeric digits."
    if len(cleaned) != 12:
        return False, cleaned, f"Aadhaar number must be exactly 12 digits (found {len(cleaned)})."
    if cleaned in {str(d) * 12 for d in range(10)}:
        return False, cleaned, "Aadhaar number cannot consist of repetitive identical digits."
    return True, cleaned, ""

def mask_aadhaar(val: str) -> str:
    """Masks 12-digit Aadhaar to: •••• •••• 1234"""
    if not val:
        return ""
    cleaned = re.sub(r"[\s\-]", "", str(val).strip())
    if len(cleaned) >= 4:
        last4 = cleaned[-4:]
        return f"•••• •••• {last4}"
    return "•••• •••• ••••"

def validate_pan(val: str):
    """
    Validates a 10-character Indian Permanent Account Number (PAN).
    Format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)
    Returns: (is_valid: bool, cleaned: str, error: str)
    """
    if not val:
        return True, "", ""
    cleaned = str(val).strip().upper()
    pan_regex = r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
    if not re.match(pan_regex, cleaned):
        return False, cleaned, "PAN format is invalid. Must follow pattern: 5 uppercase letters, 4 digits, 1 letter (e.g. ABCDE1234F)."
    return True, cleaned, ""

def mask_pan(val: str) -> str:
    """Masks 10-char PAN to: ABCDE••••F"""
    if not val:
        return ""
    cleaned = str(val).strip().upper()
    if len(cleaned) == 10:
        return f"{cleaned[:5]}••••{cleaned[-1]}"
    elif len(cleaned) >= 5:
        return f"{cleaned[:2]}••••••{cleaned[-1]}"
    return "••••••••••"

def normalize_mobile(val: str) -> str:
    """Normalizes mobile number with country code. Default +91 for 10-digit Indian numbers."""
    if not val:
        return ""
    cleaned = re.sub(r"[\s\-\(\)]", "", str(val).strip())
    if cleaned.startswith("+"):
        return cleaned
    if cleaned.startswith("0") and len(cleaned) == 11:
        return "+91" + cleaned[1:]
    if len(cleaned) == 10 and cleaned.isdigit():
        return "+91" + cleaned
    return cleaned

def validate_mobile(val: str):
    """Validates international or Indian mobile number."""
    if not val:
        return False, "", "Mobile number is required."
    normalized = normalize_mobile(val)
    if not re.match(r"^\+[1-9]\d{9,14}$", normalized):
        return False, normalized, "Invalid mobile number format. Please provide a valid mobile number with country code (e.g. +91 9876543210)."
    return True, normalized, ""

def _hash_otp(mobile: str, otp: str) -> str:
    data = f"{mobile}:{otp}:{Config.SECRET_KEY}".encode("utf-8")
    return hashlib.sha256(data).hexdigest()

def send_mobile_otp(raw_mobile: str):
    is_valid, mobile, err = validate_mobile(raw_mobile)
    if not is_valid:
        return False, {"error": err}, 400

    conn = get_db_connection()
    cursor = conn.cursor()

    now = datetime.datetime.now(datetime.timezone.utc)
    cursor.execute("""
        SELECT id, last_sent_at, resend_count, created_at, verified_at
        FROM mobile_otps
        WHERE mobile = ?
        ORDER BY id DESC LIMIT 1;
    """, (mobile,))
    last_record = cursor.fetchone()

    cooldown_seconds = 60
    if last_record:
        try:
            last_sent = datetime.datetime.fromisoformat(last_record["last_sent_at"].replace("Z", ""))
            elapsed = (now - last_sent).total_seconds()
            if elapsed < cooldown_seconds:
                wait_time = int(cooldown_seconds - elapsed)
                conn.close()
                return False, {
                    "error": f"Please wait {wait_time} second(s) before requesting another OTP.",
                    "cooldown_remaining": wait_time
                }, 429
        except Exception:
            pass

    one_hour_ago = (now - datetime.timedelta(hours=1)).isoformat()
    cursor.execute("""
        SELECT COUNT(*) as cnt FROM mobile_otps
        WHERE mobile = ? AND created_at >= ?;
    """, (mobile, one_hour_ago))
    hour_count = cursor.fetchone()["cnt"]
    if hour_count >= 5:
        conn.close()
        return False, {
            "error": "Maximum hourly OTP request limit reached. Please try again after 1 hour."
        }, 429

    otp_code = "".join(secrets.choice(string.digits) for _ in range(6))
    otp_hash = _hash_otp(mobile, otp_code)
    expires_at = (now + datetime.timedelta(minutes=5)).isoformat()

    cursor.execute("""
        INSERT INTO mobile_otps (mobile, otp_hash, expires_at, attempts_left, resend_count, last_sent_at)
        VALUES (?, ?, ?, 3, ?, ?);
    """, (mobile, otp_hash, expires_at, hour_count + 1, now.isoformat()))
    conn.commit()
    conn.close()

    sid = Config.TWILIO_ACCOUNT_SID
    token = Config.TWILIO_AUTH_TOKEN
    from_phone = Config.TWILIO_PHONE_NUMBER

    is_testing = False
    try:
        is_testing = bool(current_app.config.get("TESTING"))
    except Exception:
        pass

    if sid and token and from_phone:
        try:
            import urllib.request
            import urllib.parse
            import base64

            twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
            post_data = urllib.parse.urlencode({
                "To": mobile,
                "From": from_phone,
                "Body": f"[LandAssist] Your Land Parcel Registration verification code is: {otp_code}. Valid for 5 minutes. Do not share this OTP."
            }).encode("utf-8")

            req = urllib.request.Request(twilio_url, data=post_data, method="POST")
            auth_header = base64.b64encode(f"{sid}:{token}".encode("utf-8")).decode("ascii")
            req.add_header("Authorization", f"Basic {auth_header}")
            req.add_header("Content-Type", "application/x-www-form-urlencoded")

            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status in {200, 201}:
                    return True, {
                        "message": f"Verification OTP sent via SMS to {mobile}.",
                        "mobile": mobile,
                        "status": "OTP Sent",
                        "expires_in_seconds": 300,
                        "cooldown_seconds": 60
                    }, 200
        except Exception as sms_err:
            print(f"[SMS Gateway Error] Failed to send SMS via Twilio: {sms_err}")
            return False, {
                "error": f"Failed to dispatch SMS through SMS provider: {str(sms_err)}",
                "status": "Verification Failed"
            }, 502

    if Config.SMS_GATEWAY_DEV_MODE or is_testing:
        print("\n=======================================================")
        print("[DEVELOPMENT SMS GATEWAY]")
        print(f"Mobile Number : {mobile}")
        print(f"Generated OTP : {otp_code}")
        print(f"Expires In    : 5 minutes ({expires_at} UTC)")
        print("=======================================================\n")

        return True, {
            "message": "Verification code generated (Development Mode active). Code logged to server console.",
            "mobile": mobile,
            "status": "OTP Sent",
            "expires_in_seconds": 300,
            "cooldown_seconds": 60,
            "dev_mode": True,
            "dev_otp": otp_code
        }, 200

    return False, {
        "error": "SMS OTP Gateway is not configured. Please configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in the backend environment to send live SMS OTPs.",
        "status": "Not Configured"
    }, 503

def verify_mobile_otp(raw_mobile: str, otp_code: str):
    is_valid, mobile, err = validate_mobile(raw_mobile)
    if not is_valid:
        return False, {"error": err}, 400

    submitted_otp = re.sub(r"\s", "", str(otp_code or ""))
    if not submitted_otp.isdigit() or len(submitted_otp) != 6:
        return False, {"error": "Verification code must be exactly 6 numeric digits."}, 400

    conn = get_db_connection()
    cursor = conn.cursor()

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    cursor.execute("""
        SELECT id, otp_hash, expires_at, attempts_left, verified_at
        FROM mobile_otps
        WHERE mobile = ? AND verified_at IS NULL
        ORDER BY id DESC LIMIT 1;
    """, (mobile,))
    record = cursor.fetchone()

    if not record:
        conn.close()
        return False, {
            "error": "No active OTP found for this mobile number or OTP has already been verified. Please request a new OTP."
        }, 400

    otp_id = record["id"]
    attempts_left = record["attempts_left"]
    expires_at = record["expires_at"]

    if now > expires_at:
        cursor.execute("UPDATE mobile_otps SET attempts_left = 0 WHERE id = ?;", (otp_id,))
        conn.commit()
        conn.close()
        return False, {
            "error": "The verification code has expired (5-minute limit). Please request a new OTP."
        }, 400

    if attempts_left <= 0:
        conn.close()
        return False, {
            "error": "Maximum verification attempts exceeded. Please request a fresh OTP."
        }, 400

    expected_hash = record["otp_hash"]
    submitted_hash = _hash_otp(mobile, submitted_otp)

    if hmac.compare_digest(expected_hash, submitted_hash):
        verification_token = hmac.new(
            Config.SECRET_KEY.encode("utf-8"),
            f"{mobile}:verified:{now}".encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        cursor.execute("""
            UPDATE mobile_otps
            SET verified_at = ?, attempts_left = 0
            WHERE id = ?;
        """, (now, otp_id))
        conn.commit()
        conn.close()

        return True, {
            "message": f"Mobile number {mobile} verified successfully.",
            "mobile": mobile,
            "status": "Verified",
            "verification_token": verification_token
        }, 200
    else:
        new_attempts = attempts_left - 1
        cursor.execute("UPDATE mobile_otps SET attempts_left = ? WHERE id = ?;", (new_attempts, otp_id))
        conn.commit()
        conn.close()

        if new_attempts > 0:
            return False, {
                "error": f"Incorrect verification code. You have {new_attempts} attempt(s) remaining.",
                "attempts_remaining": new_attempts
            }, 400
        else:
            return False, {
                "error": "Incorrect verification code. Maximum attempts reached. Please request a new OTP.",
                "attempts_remaining": 0
            }, 400
