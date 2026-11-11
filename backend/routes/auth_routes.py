from flask import Blueprint, request, jsonify, session
from auth import (
    hash_password, verify_password, get_current_user,
    login_required, check_login_rate_limit, record_failed_login,
    reset_login_attempts, get_or_create_csrf_token, validate_csrf
)
from audit import log_audit_event
from db import get_db_connection

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/csrf-token", methods=["GET"])
def csrf_token():
    token = get_or_create_csrf_token()
    return jsonify({"csrf_token": token})

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()
    role = (data.get("role") or "owner").strip().lower()

    if not email or "@" not in email:
        return jsonify({"error": "A valid email address is required."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters in length."}), 400
    if not full_name:
        return jsonify({"error": "Full name is required."}), 400
    if role not in {"owner", "reviewer"}:
        # Admins cannot self-register as admin
        role = "owner"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?;", (email,))
    if cursor.fetchone():
        conn.close()
        return jsonify({"error": "An account with this email already exists."}), 409

    pwd_hash = hash_password(password)
    cursor.execute("""
        INSERT INTO users (email, password_hash, full_name, role)
        VALUES (?, ?, ?, ?);
    """, (email, pwd_hash, full_name, role))
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()

    # Automatically sign in new user
    session.clear()
    session["user_id"] = user_id
    get_or_create_csrf_token()

    log_audit_event(user_id, "USER_REGISTERED", target_type="user", target_id=user_id, details={"email": email, "role": role})

    return jsonify({
        "message": "Registration successful.",
        "user": {
            "id": user_id,
            "email": email,
            "full_name": full_name,
            "role": role
        }
    }), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    client_ip = request.remote_addr or "127.0.0.1"

    # Throttle verification
    throttle_key = f"{client_ip}:{email}"
    if not check_login_rate_limit(throttle_key):
        return jsonify({"error": "Too many failed attempts. Temporary lockout active. Please wait 5 minutes."}), 429

    if not email or not password:
        return jsonify({"error": "Please provide both email and password."}), 400

    conn = get_db_connection()
    user = conn.execute("SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE email = ?;", (email,)).fetchone()

    if not user or not verify_password(user["password_hash"], password):
        record_failed_login(throttle_key)
        conn.close()
        log_audit_event(None, "LOGIN_FAILED", details={"attempted_email": email})
        return jsonify({"error": "Invalid email or password credentials."}), 401

    if not user["is_active"]:
        conn.close()
        return jsonify({"error": "Your account has been deactivated. Please contact an administrator."}), 403

    # Reset failed attempts
    reset_login_attempts(throttle_key)

    # Establish session
    session.clear()
    session["user_id"] = user["id"]
    csrf = get_or_create_csrf_token()

    conn.execute("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?;", (user["id"],))
    conn.commit()
    conn.close()

    log_audit_event(user["id"], "LOGIN_SUCCESS", target_type="user", target_id=user["id"])

    return jsonify({
        "message": "Authentication successful.",
        "csrf_token": csrf,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"]
        }
    })

@auth_bp.route("/logout", methods=["POST"])
def logout():
    user_id = session.get("user_id")
    if user_id:
        log_audit_event(user_id, "USER_LOGOUT", target_type="user", target_id=user_id)
    session.clear()
    return jsonify({"message": "Successfully signed out."})

@auth_bp.route("/me", methods=["GET"])
def me():
    user = get_current_user()
    if not user:
        return jsonify({"authenticated": False}), 200
    csrf = get_or_create_csrf_token()
    return jsonify({
        "authenticated": True,
        "csrf_token": csrf,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"]
        }
    })

@auth_bp.route("/change-password", methods=["POST"])
@login_required
def change_password():
    user = get_current_user()
    data = request.get_json() or {}
    old_pwd = data.get("old_password") or ""
    new_pwd = data.get("new_password") or ""

    if len(new_pwd) < 8:
        return jsonify({"error": "New password must be at least 8 characters long."}), 400

    conn = get_db_connection()
    row = conn.execute("SELECT password_hash FROM users WHERE id = ?;", (user["id"],)).fetchone()
    if not row or not verify_password(row["password_hash"], old_pwd):
        conn.close()
        return jsonify({"error": "Current password verification failed."}), 400

    new_hash = hash_password(new_pwd)
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?;", (new_hash, user["id"]))
    conn.commit()
    conn.close()

    log_audit_event(user["id"], "PASSWORD_CHANGED", target_type="user", target_id=user["id"])
    return jsonify({"message": "Password updated successfully."})
