import json
import secrets
from flask import Blueprint, request, jsonify, send_file
from auth import login_required, get_current_user
from audit import log_audit_event
from db import get_db_connection
from agreement_engine import generate_agreement_draft
from pdf_generator import generate_agreement_pdf

agreement_bp = Blueprint("agreements", __name__, url_prefix="/api/agreements")

def check_agreement_access(agreement_id: int, user: dict, require_edit: bool = False):
    """
    Checks if the user is owner, admin, or authorized shared reviewer.
    Returns (allowed: bool, agreement_row, is_owner_or_admin: bool)
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM agreement_drafts WHERE id = ?;", (agreement_id,))
    agreement = cursor.fetchone()

    if not agreement:
        conn.close()
        return False, None, False

    is_owner = (agreement["user_id"] == user["id"])
    is_admin = (user["role"] == "admin")

    if is_owner or is_admin:
        conn.close()
        return True, agreement, True

    # If user is a reviewer, check agreement_shares
    cursor.execute("""
        SELECT * FROM agreement_shares
        WHERE agreement_id = ? AND status = 'active'
          AND (shared_with_email = ? OR shared_with_user_id = ?);
    """, (agreement_id, user["email"].lower(), user["id"]))
    share = cursor.fetchone()
    conn.close()

    if share:
        if require_edit and not is_owner and not is_admin:
            # Reviewers cannot overwrite the primary agreement text unless allowed
            return False, agreement, False
        return True, agreement, False

    return False, None, False

@agreement_bp.route("/generate", methods=["POST"])
@login_required
def generate_draft():
    user = get_current_user()
    if user["role"] not in {"owner", "admin"}:
        return jsonify({"error": "Only property owners or administrators can generate agreements."}), 403

    data = request.get_json() or {}
    agreement_type = (data.get("agreement_type") or "sale").lower()
    if agreement_type not in {"sale", "rental", "lease"}:
        return jsonify({"error": "Agreement type must be 'sale', 'rental', or 'lease'."}), 400

    property_details = data.get("property_details") or {}
    record_id = data.get("record_id")

    # If record_id is supplied, verify access and fill property details
    if record_id:
        conn = get_db_connection()
        rec = conn.execute("SELECT * FROM land_records WHERE id = ?;", (record_id,)).fetchone()
        conn.close()
        if rec and (user["role"] == "admin" or rec["user_id"] == user["id"]):
            property_details.setdefault("survey_number", rec["survey_number"])
            property_details.setdefault("subdivision_number", rec["subdivision_number"])
            property_details.setdefault("patta_number", rec["patta_number"])
            property_details.setdefault("district", rec["district"])
            property_details.setdefault("taluk", rec["taluk"])
            property_details.setdefault("village", rec["village"])
            property_details.setdefault("land_area", rec["land_area"])
            property_details.setdefault("land_unit", rec["land_unit"])
            property_details.setdefault("document_reference", rec["document_reference"])

    first_party = data.get("first_party") or {}
    second_party = data.get("second_party") or {}
    terms = data.get("terms") or {}

    draft_result = generate_agreement_draft(agreement_type, property_details, first_party, second_party, terms)

    # Persist draft to SQLite
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO agreement_drafts (
            user_id, agreement_type, title, content, record_id,
            party_first_details_json, party_second_details_json, agreement_terms_json,
            generation_mode, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft');
    """, (
        user["id"],
        agreement_type,
        draft_result["title"],
        draft_result["content"],
        record_id,
        json.dumps(first_party),
        json.dumps(second_party),
        json.dumps(terms),
        draft_result["generation_mode"]
    ))
    conn.commit()
    draft_id = cursor.lastrowid

    # Create initial revision
    cursor.execute("""
        INSERT INTO agreement_revisions (agreement_id, revision_number, content, updated_by, notes)
        VALUES (?, 1, ?, ?, 'Initial generated draft');
    """, (draft_id, draft_result["content"], user["id"]))
    conn.commit()
    conn.close()

    log_audit_event(user["id"], "AGREEMENT_DRAFT_GENERATED", target_type="agreement", target_id=draft_id, details={
        "type": agreement_type,
        "mode": draft_result["generation_mode"]
    })

    return jsonify({
        "message": "Agreement draft generated successfully.",
        "agreement_id": draft_id,
        "title": draft_result["title"],
        "content": draft_result["content"],
        "generation_mode": draft_result["generation_mode"],
        "disclaimer": draft_result["disclaimer"]
    }), 201

@agreement_bp.route("", methods=["GET"])
@login_required
def list_agreements():
    user = get_current_user()
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT a.id, a.agreement_type, a.title, a.status, a.generation_mode,
               a.created_at, a.updated_at, a.record_id,
               lr.village, lr.survey_number,
               (SELECT COUNT(*) FROM reviewer_comments rc WHERE rc.agreement_id = a.id) as comment_count,
               (SELECT COUNT(*) FROM agreement_shares s WHERE s.agreement_id = a.id AND s.status = 'active') as share_count
        FROM agreement_drafts a
        LEFT JOIN land_records lr ON a.record_id = lr.id
        WHERE 1=1
    """
    params = []

    if user["role"] != "admin":
        query += " AND a.user_id = ?"
        params.append(user["id"])

    query += " ORDER BY a.updated_at DESC;"

    cursor.execute(query, params)
    agreements = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return jsonify({"agreements": agreements, "total": len(agreements)})

@agreement_bp.route("/shared-with-me", methods=["GET"])
@login_required
def list_shared_with_me():
    user = get_current_user()
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT a.id, a.agreement_type, a.title, a.status, a.generation_mode,
               a.created_at, a.updated_at, s.created_at as shared_at,
               u.full_name as owner_name, u.email as owner_email,
               (SELECT COUNT(*) FROM reviewer_comments rc WHERE rc.agreement_id = a.id) as comment_count
        FROM agreement_shares s
        JOIN agreement_drafts a ON s.agreement_id = a.id
        JOIN users u ON a.user_id = u.id
        WHERE s.status = 'active'
          AND (s.shared_with_email = ? OR s.shared_with_user_id = ?)
        ORDER BY s.created_at DESC;
    """, (user["email"].lower(), user["id"]))

    shared = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return jsonify({"agreements": shared, "total": len(shared)})

@agreement_bp.route("/<int:agreement_id>", methods=["GET"])
@login_required
def get_agreement(agreement_id: int):
    user = get_current_user()
    allowed, agreement, is_owner_or_admin = check_agreement_access(agreement_id, user)

    if not allowed or not agreement:
        return jsonify({"error": "Agreement not found or access unauthorized."}), 403

    conn = get_db_connection()
    cursor = conn.cursor()

    # Revisions
    cursor.execute("""
        SELECT ar.id, ar.revision_number, ar.notes, ar.created_at, u.full_name as author_name
        FROM agreement_revisions ar
        JOIN users u ON ar.updated_by = u.id
        WHERE ar.agreement_id = ?
        ORDER BY ar.revision_number DESC;
    """, (agreement_id,))
    revisions = [dict(r) for r in cursor.fetchall()]

    # Comments
    cursor.execute("""
        SELECT rc.id, rc.comment_text, rc.section_ref, rc.created_at,
               u.full_name as author_name, u.role as author_role
        FROM reviewer_comments rc
        JOIN users u ON rc.user_id = u.id
        WHERE rc.agreement_id = ?
        ORDER BY rc.created_at ASC;
    """, (agreement_id,))
    comments = [dict(r) for r in cursor.fetchall()]

    # Shares (only owner/admin sees all shares)
    shares = []
    if is_owner_or_admin:
        cursor.execute("""
            SELECT id, shared_with_email, status, created_at
            FROM agreement_shares
            WHERE agreement_id = ?;
        """, (agreement_id,))
        shares = [dict(r) for r in cursor.fetchall()]

    conn.close()

    result = dict(agreement)
    result["is_owner"] = is_owner_or_admin
    result["revisions"] = revisions
    result["comments"] = comments
    result["shares"] = shares

    return jsonify({"agreement": result})

@agreement_bp.route("/<int:agreement_id>", methods=["PUT"])
@login_required
def update_agreement(agreement_id: int):
    user = get_current_user()
    allowed, agreement, is_owner = check_agreement_access(agreement_id, user, require_edit=True)

    if not allowed or not is_owner:
        return jsonify({"error": "Permission denied: only document owners or administrators can edit the draft."}), 403

    data = request.get_json() or {}
    title = data.get("title", agreement["title"]).strip()
    content = data.get("content", agreement["content"])
    status = data.get("status", agreement["status"])
    notes = data.get("notes", "Edited via web editor")

    conn = get_db_connection()
    cursor = conn.cursor()

    # Get max revision
    cursor.execute("SELECT COALESCE(MAX(revision_number), 0) + 1 FROM agreement_revisions WHERE agreement_id = ?;", (agreement_id,))
    next_rev = cursor.fetchone()[0]

    cursor.execute("""
        UPDATE agreement_drafts
        SET title = ?, content = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?;
    """, (title, content, status, agreement_id))

    cursor.execute("""
        INSERT INTO agreement_revisions (agreement_id, revision_number, content, updated_by, notes)
        VALUES (?, ?, ?, ?, ?);
    """, (agreement_id, next_rev, content, user["id"], notes))

    conn.commit()
    conn.close()

    log_audit_event(user["id"], "AGREEMENT_DRAFT_UPDATED", target_type="agreement", target_id=agreement_id, details={
        "revision": next_rev,
        "status": status
    })

    return jsonify({
        "message": "Agreement updated successfully.",
        "revision_number": next_rev
    })

@agreement_bp.route("/<int:agreement_id>/share", methods=["POST"])
@login_required
def share_agreement(agreement_id: int):
    user = get_current_user()
    allowed, agreement, is_owner = check_agreement_access(agreement_id, user, require_edit=True)

    if not allowed or not is_owner:
        return jsonify({"error": "Permission denied: only the document owner can share this draft."}), 403

    data = request.get_json() or {}
    target_email = (data.get("email") or "").strip().lower()

    if not target_email or "@" not in target_email:
        return jsonify({"error": "Valid reviewer email address required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Look up if user already exists
    cursor.execute("SELECT id, role FROM users WHERE email = ?;", (target_email,))
    target_user = cursor.fetchone()
    target_user_id = target_user["id"] if target_user else None

    # Check existing share
    cursor.execute("""
        SELECT id FROM agreement_shares
        WHERE agreement_id = ? AND shared_with_email = ?;
    """, (agreement_id, target_email))
    existing = cursor.fetchone()

    access_token = secrets.token_urlsafe(24)

    if existing:
        cursor.execute("UPDATE agreement_shares SET status = 'active', access_token = ? WHERE id = ?;", (access_token, existing["id"]))
    else:
        cursor.execute("""
            INSERT INTO agreement_shares (agreement_id, shared_with_email, shared_with_user_id, access_token, status)
            VALUES (?, ?, ?, ?, 'active');
        """, (agreement_id, target_email, target_user_id, access_token))

    # Update agreement status to 'under_review' if it was 'draft'
    cursor.execute("""
        UPDATE agreement_drafts
        SET status = 'under_review', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'draft';
    """, (agreement_id,))

    conn.commit()
    conn.close()

    log_audit_event(user["id"], "AGREEMENT_SHARED", target_type="agreement", target_id=agreement_id, details={
        "shared_with": target_email
    })

    return jsonify({
        "message": f"Agreement successfully shared with {target_email}.",
        "access_token": access_token
    })

@agreement_bp.route("/<int:agreement_id>/shares/<int:share_id>/revoke", methods=["POST"])
@login_required
def revoke_share(agreement_id: int, share_id: int):
    user = get_current_user()
    allowed, agreement, is_owner = check_agreement_access(agreement_id, user, require_edit=True)

    if not allowed or not is_owner:
        return jsonify({"error": "Permission denied: only the owner can revoke sharing permissions."}), 403

    conn = get_db_connection()
    conn.execute("UPDATE agreement_shares SET status = 'revoked' WHERE id = ? AND agreement_id = ?;", (share_id, agreement_id))
    conn.commit()
    conn.close()

    log_audit_event(user["id"], "AGREEMENT_SHARE_REVOKED", target_type="agreement", target_id=agreement_id, details={"share_id": share_id})

    return jsonify({"message": "Reviewer access revoked successfully."})

@agreement_bp.route("/<int:agreement_id>/comments", methods=["POST"])
@login_required
def add_comment(agreement_id: int):
    user = get_current_user()
    allowed, agreement, _ = check_agreement_access(agreement_id, user)

    if not allowed:
        return jsonify({"error": "Access denied: cannot comment on unshared agreement."}), 403

    data = request.get_json() or {}
    comment_text = (data.get("comment_text") or "").strip()
    section_ref = (data.get("section_ref") or "").strip()

    if not comment_text:
        return jsonify({"error": "Comment text cannot be empty."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO reviewer_comments (agreement_id, user_id, comment_text, section_ref)
        VALUES (?, ?, ?, ?);
    """, (agreement_id, user["id"], comment_text, section_ref))
    conn.commit()
    comment_id = cursor.lastrowid
    conn.close()

    log_audit_event(user["id"], "AGREEMENT_COMMENT_ADDED", target_type="agreement", target_id=agreement_id)

    return jsonify({
        "message": "Comment posted successfully.",
        "comment": {
            "id": comment_id,
            "comment_text": comment_text,
            "section_ref": section_ref,
            "author_name": user["full_name"],
            "author_role": user["role"]
        }
    }), 201

@agreement_bp.route("/<int:agreement_id>/pdf", methods=["GET"])
@login_required
def download_pdf(agreement_id: int):
    user = get_current_user()
    allowed, agreement, _ = check_agreement_access(agreement_id, user)

    if not allowed or not agreement:
        return jsonify({"error": "Forbidden: unauthorized access to agreement PDF."}), 403

    pdf_buffer = generate_agreement_pdf(
        title=agreement["title"],
        content=agreement["content"],
        agreement_type=agreement["agreement_type"],
        agreement_id=agreement_id
    )

    filename = f"LandAssist_Draft_{agreement['agreement_type'].capitalize()}_{agreement_id}.pdf"
    log_audit_event(user["id"], "AGREEMENT_PDF_EXPORTED", target_type="agreement", target_id=agreement_id)

    return send_file(
        pdf_buffer,
        as_attachment=True,
        download_name=filename,
        mimetype="application/pdf"
    )
