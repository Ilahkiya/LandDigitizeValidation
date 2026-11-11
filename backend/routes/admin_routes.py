import os
import shutil
from flask import Blueprint, request, jsonify
from auth import login_required, role_required, get_current_user
from audit import log_audit_event
from db import get_db_connection
from config import Config

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

@admin_bp.route("/users", methods=["GET"])
@login_required
@role_required("admin")
def list_users():
    conn = get_db_connection()
    users = conn.execute("""
        SELECT id, email, full_name, role, is_active, created_at, last_login,
               (SELECT COUNT(*) FROM land_records WHERE user_id = users.id) as record_count,
               (SELECT COUNT(*) FROM documents WHERE user_id = users.id) as doc_count,
               (SELECT COUNT(*) FROM agreement_drafts WHERE user_id = users.id) as draft_count
        FROM users
        ORDER BY created_at DESC;
    """).fetchall()
    conn.close()

    return jsonify({"users": [dict(u) for u in users]})

@admin_bp.route("/users/<int:target_user_id>", methods=["PUT"])
@login_required
@role_required("admin")
def update_user(target_user_id: int):
    admin_user = get_current_user()
    data = request.get_json() or {}
    new_role = data.get("role")
    is_active = data.get("is_active")

    conn = get_db_connection()
    target = conn.execute("SELECT * FROM users WHERE id = ?;", (target_user_id,)).fetchone()
    if not target:
        conn.close()
        return jsonify({"error": "Target user not found."}), 404

    # Prevent admin from deactivating themselves
    if target["id"] == admin_user["id"] and is_active is False:
        conn.close()
        return jsonify({"error": "Cannot deactivate your own administrator account."}), 400

    updates = []
    params = []

    if new_role and new_role in {"owner", "reviewer", "admin"}:
        updates.append("role = ?")
        params.append(new_role)

    if is_active is not None:
        updates.append("is_active = ?")
        params.append(1 if is_active else 0)

    if updates:
        params.append(target_user_id)
        conn.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?;", params)
        conn.commit()

    conn.close()

    log_audit_event(admin_user["id"], "ADMIN_USER_MODIFIED", target_type="user", target_id=target_user_id, details={
        "new_role": new_role,
        "is_active": is_active
    })

    return jsonify({"message": "User account updated successfully."})

@admin_bp.route("/audit-logs", methods=["GET"])
@login_required
@role_required("admin")
def list_audit_logs():
    limit = min(int(request.args.get("limit", 50)), 100)
    action_filter = request.args.get("action", "").strip()

    conn = get_db_connection()
    query = """
        SELECT al.id, al.action, al.target_type, al.target_id, al.details,
               al.ip_address, al.created_at, u.email as actor_email, u.full_name as actor_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE 1=1
    """
    params = []
    if action_filter:
        query += " AND al.action = ?"
        params.append(action_filter)

    query += " ORDER BY al.created_at DESC LIMIT ?;"
    params.append(limit)

    logs = conn.execute(query, params).fetchall()
    conn.close()

    return jsonify({"logs": [dict(l) for l in logs]})

@admin_bp.route("/system-status", methods=["GET"])
@login_required
@role_required("admin")
def system_status():
    tesseract_available = shutil.which("tesseract") is not None or (Config.TESSERACT_CMD and os.path.exists(Config.TESSERACT_CMD))
    openai_configured = bool(Config.OPENAI_API_KEY and Config.OPENAI_API_KEY.startswith("sk-"))

    # SQLite file size
    db_size = os.path.getsize(Config.DATABASE_PATH) if os.path.exists(Config.DATABASE_PATH) else 0

    return jsonify({
        "status": "healthy",
        "ocr_engine": {
            "pymupdf": "Available (Direct PDF vector/text engine)",
            "tesseract_ocr": "Ready" if tesseract_available else "Not configured in PATH (Image fallback mode active)"
        },
        "ai_engine": {
            "mode": "OpenAI API Active" if openai_configured else "Standard Template Generator Active"
        },
        "database": {
            "engine": "SQLite 3",
            "size_bytes": db_size
        },
        "storage": {
            "upload_folder": Config.UPLOAD_FOLDER
        }
    })
