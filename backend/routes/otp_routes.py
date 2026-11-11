from flask import Blueprint, request, jsonify
from auth import login_required
from otp_service import send_mobile_otp, verify_mobile_otp, validate_mobile, get_db_connection

otp_bp = Blueprint("otp", __name__, url_prefix="/api/otp")

@otp_bp.route("/send", methods=["POST"])
@login_required
def send_otp():
    data = request.get_json() or {}
    mobile = data.get("mobile", "").strip()

    if not mobile:
        return jsonify({"error": "Mobile number is required to send verification OTP."}), 400

    success, payload, status_code = send_mobile_otp(mobile)
    return jsonify(payload), status_code

@otp_bp.route("/verify", methods=["POST"])
@login_required
def verify_otp():
    data = request.get_json() or {}
    mobile = data.get("mobile", "").strip()
    otp_code = data.get("otp", "").strip()

    if not mobile or not otp_code:
        return jsonify({"error": "Both mobile number and verification code are required."}), 400

    success, payload, status_code = verify_mobile_otp(mobile, otp_code)
    return jsonify(payload), status_code

@otp_bp.route("/status", methods=["GET"])
@login_required
def check_status():
    mobile = request.args.get("mobile", "").strip()
    is_valid, norm_mobile, err = validate_mobile(mobile)
    if not is_valid:
        return jsonify({"error": err}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT verified_at FROM mobile_otps
        WHERE mobile = ? AND verified_at IS NOT NULL
        ORDER BY id DESC LIMIT 1;
    """, (norm_mobile,))
    row = cursor.fetchone()
    conn.close()

    is_verified = bool(row)
    return jsonify({
        "mobile": norm_mobile,
        "is_verified": is_verified,
        "status": "Verified" if is_verified else "Not Verified",
        "verified_at": row["verified_at"] if row else None
    })
