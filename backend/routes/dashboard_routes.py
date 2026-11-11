from flask import Blueprint, jsonify
from auth import login_required, get_current_user
from db import get_db_connection

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")

@dashboard_bp.route("/stats", methods=["GET"])
@login_required
def get_dashboard_stats():
    user = get_current_user()
    conn = get_db_connection()
    cursor = conn.cursor()

    is_admin = (user["role"] == "admin")
    is_reviewer = (user["role"] == "reviewer")

    if is_admin:
        # System-wide metrics
        cursor.execute("SELECT COUNT(*) FROM land_records;")
        total_records = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM documents;")
        total_documents = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM land_records WHERE validation_status IN ('Needs Review', 'Incomplete', 'Conflict Detected');")
        records_requiring_review = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM agreement_drafts;")
        saved_agreements = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM users;")
        total_users = cursor.fetchone()[0]

        shared_count = 0
    elif is_reviewer:
        # Reviewer metrics
        cursor.execute("""
            SELECT COUNT(*) FROM agreement_shares
            WHERE status = 'active' AND (shared_with_email = ? OR shared_with_user_id = ?);
        """, (user["email"].lower(), user["id"]))
        shared_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM reviewer_comments WHERE user_id = ?;", (user["id"],))
        comment_count = cursor.fetchone()[0]

        total_records = 0
        total_documents = 0
        records_requiring_review = 0
        saved_agreements = 0
        total_users = 0
    else:
        # Standard Property Owner metrics
        cursor.execute("SELECT COUNT(*) FROM land_records WHERE user_id = ?;", (user["id"],))
        total_records = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM documents WHERE user_id = ?;", (user["id"],))
        total_documents = cursor.fetchone()[0]

        cursor.execute("""
            SELECT COUNT(*) FROM land_records
            WHERE user_id = ? AND validation_status IN ('Needs Review', 'Incomplete', 'Conflict Detected');
        """, (user["id"],))
        records_requiring_review = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM agreement_drafts WHERE user_id = ?;", (user["id"],))
        saved_agreements = cursor.fetchone()[0]

        total_users = 0
        shared_count = 0

    # Recent activity logs from real audit_logs
    if is_admin:
        cursor.execute("""
            SELECT a.id, a.action, a.target_type, a.target_id, a.created_at, u.full_name as actor_name
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC LIMIT 8;
        """)
    else:
        cursor.execute("""
            SELECT a.id, a.action, a.target_type, a.target_id, a.created_at, u.full_name as actor_name
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.user_id = ?
            ORDER BY a.created_at DESC LIMIT 8;
        """, (user["id"],))

    recent_activity = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return jsonify({
        "stats": {
            "total_records": total_records,
            "total_documents": total_documents,
            "records_requiring_review": records_requiring_review,
            "saved_agreements": saved_agreements,
            "shared_agreements": shared_count,
            "total_users": total_users
        },
        "recent_activity": recent_activity
    })
