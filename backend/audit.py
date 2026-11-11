import json
from flask import request
from db import get_db_connection

def log_audit_event(user_id, action, target_type=None, target_id=None, details=None):
    """
    Records security audit events without storing sensitive information like
    passwords, tokens, or raw document content.
    """
    try:
        ip_addr = request.remote_addr if request else "127.0.0.1"
    except Exception:
        ip_addr = "127.0.0.1"

    sanitized_details = None
    if isinstance(details, dict):
        # Scrub any potentially sensitive keys
        safe_copy = {k: v for k, v in details.items() if k.lower() not in {"password", "token", "secret", "key", "content"}}
        sanitized_details = json.dumps(safe_copy)
    elif isinstance(details, str):
        sanitized_details = details

    try:
        conn = get_db_connection()
        conn.execute("""
            INSERT INTO audit_logs (user_id, action, target_type, target_id, details, ip_address)
            VALUES (?, ?, ?, ?, ?, ?);
        """, (user_id, action, target_type, target_id, sanitized_details, ip_addr))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Audit Log Error] Failed to log audit event: {e}")
