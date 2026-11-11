import time
import secrets
from functools import wraps
from flask import session, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from db import get_db_connection

# In-memory rate limiting for login attempts
# Format: {identifier: {"count": int, "blocked_until": float}}
_login_attempts = {}

MAX_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 300  # 5 minutes

def check_login_rate_limit(identifier: str) -> bool:
    """Returns True if the identifier is allowed, False if throttled."""
    now = time.time()
    record = _login_attempts.get(identifier)
    if not record:
        return True
    if record.get("blocked_until", 0) > now:
        return False
    return True

def record_failed_login(identifier: str):
    now = time.time()
    record = _login_attempts.setdefault(identifier, {"count": 0, "blocked_until": 0})
    record["count"] += 1
    if record["count"] >= MAX_ATTEMPTS:
        record["blocked_until"] = now + LOCKOUT_DURATION_SECONDS

def reset_login_attempts(identifier: str):
    if identifier in _login_attempts:
        del _login_attempts[identifier]

def hash_password(password: str) -> str:
    return generate_password_hash(password, method="scrypt")

def verify_password(hash_value: str, password: str) -> bool:
    return check_password_hash(hash_value, password)

def get_current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    conn = get_db_connection()
    user = conn.execute("SELECT id, email, full_name, role, is_active FROM users WHERE id = ?;", (user_id,)).fetchone()
    conn.close()
    if user and user["is_active"]:
        return dict(user)
    return None

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required. Please sign in to continue."}), 401
        return f(*args, **kwargs)
    return decorated_function

def role_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({"error": "Authentication required."}), 401
            if user["role"] not in allowed_roles:
                return jsonify({"error": "Access forbidden: insufficient permissions for this operation."}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def get_or_create_csrf_token():
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(24)
    return session["csrf_token"]

def validate_csrf(token: str) -> bool:
    session_token = session.get("csrf_token")
    if not session_token or not token:
        return False
    return secrets.compare_digest(session_token, token)
