import os
import uuid
import json
from pathlib import Path
from flask import Blueprint, request, jsonify, send_file, current_app
from werkzeug.utils import secure_filename
from auth import login_required, get_current_user
from audit import log_audit_event
from db import get_db_connection
from config import Config
from ocr_engine import extract_document_text, parse_structured_fields
from verification_engine import verify_document, validate_file_bytes

document_bp = Blueprint("documents", __name__, url_prefix="/api/documents")

def is_allowed_file(filename: str) -> bool:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext in Config.ALLOWED_EXTENSIONS

@document_bp.route("/upload", methods=["POST"])
@login_required
def upload_document():
    user = get_current_user()
    if user["role"] not in {"owner", "admin"}:
        return jsonify({"error": "Only owners or administrators can upload land documents."}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file payload found in request."}), 400

    uploaded_file = request.files["file"]
    if not uploaded_file or uploaded_file.filename == "":
        return jsonify({"error": "No file selected for upload."}), 400

    original_filename = secure_filename(uploaded_file.filename)
    if not is_allowed_file(original_filename):
        return jsonify({
            "error": f"Unsupported file format. Allowed formats: {', '.join(sorted(Config.ALLOWED_EXTENSIONS)).upper()}"
        }), 400

    # Generate safe internal filename
    ext = original_filename.rsplit(".", 1)[-1].lower()
    stored_filename = f"{uuid.uuid4().hex}.{ext}"
    upload_dir = Path(Config.UPLOAD_FOLDER)
    upload_dir.mkdir(parents=True, exist_ok=True)
    destination_path = upload_dir / stored_filename

    # Save securely outside public static folder
    try:
        uploaded_file.save(str(destination_path))
        file_size = destination_path.stat().st_size
    except Exception as save_err:
        return jsonify({"error": f"Failed to save uploaded file securely: {str(save_err)}"}), 500

    # Perform text extraction (PyMuPDF or Tesseract OCR)
    extraction_res = extract_document_text(str(destination_path))
    extraction_status = "completed" if extraction_res.get("success") else "failed"
    extracted_text = extraction_res.get("text", "")

    # Parse Tamil Nadu land record fields
    structured_fields = parse_structured_fields(extracted_text)

    # Save metadata in SQLite
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO documents (
            user_id, original_filename, stored_filename, file_type, file_size,
            extraction_status, extracted_text, structured_data_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        user["id"],
        original_filename,
        stored_filename,
        ext,
        file_size,
        extraction_status,
        extracted_text,
        json.dumps(structured_fields)
    ))
    conn.commit()
    doc_id = cursor.lastrowid
    conn.close()

    log_audit_event(user["id"], "DOCUMENT_UPLOADED", target_type="document", target_id=doc_id, details={
        "filename": original_filename,
        "size_bytes": file_size,
        "extraction_method": extraction_res.get("method")
    })

    return jsonify({
        "message": "Document uploaded and digitized successfully.",
        "document": {
            "id": doc_id,
            "original_filename": original_filename,
            "file_type": ext,
            "file_size": file_size,
            "extraction_status": extraction_status,
            "extraction_method": extraction_res.get("method"),
            "extracted_text": extracted_text,
            "structured_fields": structured_fields
        }
    }), 201

@document_bp.route("/verify", methods=["POST"])
@login_required
def verify_document_endpoint():
    user = get_current_user()
    if user["role"] not in {"owner", "admin"}:
        return jsonify({"error": "Only owners or administrators can verify land documents."}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file payload found in request."}), 400

    uploaded_file = request.files["file"]
    if not uploaded_file or uploaded_file.filename == "":
        return jsonify({"error": "No file selected for verification."}), 400

    original_filename = secure_filename(uploaded_file.filename)
    if not is_allowed_file(original_filename):
        return jsonify({
            "error": f"Unsupported file format. Allowed formats: {', '.join(sorted(Config.ALLOWED_EXTENSIONS)).upper()}"
        }), 400

    # Enforce file size limit
    if request.content_length and request.content_length > Config.MAX_CONTENT_LENGTH:
        return jsonify({"error": "File exceeds the maximum allowable upload limit (16MB)."}), 413

    ext = original_filename.rsplit(".", 1)[-1].lower()
    stored_filename = f"{uuid.uuid4().hex}.{ext}"
    upload_dir = Path(Config.UPLOAD_FOLDER)
    upload_dir.mkdir(parents=True, exist_ok=True)
    destination_path = upload_dir / stored_filename

    try:
        uploaded_file.save(str(destination_path))
        file_size = destination_path.stat().st_size
    except Exception as save_err:
        return jsonify({"error": f"Failed to save uploaded file securely: {str(save_err)}"}), 500

    if file_size > Config.MAX_CONTENT_LENGTH:
        if destination_path.exists():
            destination_path.unlink()
        return jsonify({"error": "File exceeds the maximum allowable upload limit (16MB)."}), 413

    # Validate file contents and magic headers
    is_valid, validation_err = validate_file_bytes(str(destination_path), ext)
    if not is_valid:
        if destination_path.exists():
            destination_path.unlink()
        return jsonify({"error": f"Document content validation failed: {validation_err}"}), 400

    # Run Authenticity Verification Engine
    try:
        report = verify_document(str(destination_path), original_filename, user["id"])
    except Exception as v_err:
        if destination_path.exists():
            destination_path.unlink()
        return jsonify({"error": f"Document verification failed: {str(v_err)}"}), 500

    # Persist document record
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO documents (
            user_id, original_filename, stored_filename, file_type, file_size,
            extraction_status, extracted_text, structured_data_json
        ) VALUES (?, ?, ?, ?, ?, 'verified', ?, ?);
    """, (
        user["id"],
        original_filename,
        stored_filename,
        ext,
        file_size,
        report.get("extracted_cadastral_data", {}).get("document_reference", ""),
        json.dumps(report.get("extracted_cadastral_data", {}))
    ))
    doc_id = cursor.lastrowid

    # Persist verification result
    cursor.execute("""
        INSERT INTO document_verifications (
            document_id, verification_ref, overall_status, report_json
        ) VALUES (?, ?, ?, ?);
    """, (
        doc_id,
        report["verification_ref"],
        report["overall_status"],
        json.dumps(report)
    ))
    conn.commit()
    conn.close()

    log_audit_event(user["id"], "DOCUMENT_AUTHENTICITY_VERIFIED", target_type="document", target_id=doc_id, details={
        "verification_ref": report["verification_ref"],
        "overall_status": report["overall_status"],
        "filename": original_filename
    })

    return jsonify({
        "message": "Document verification completed successfully.",
        "document": {
            "id": doc_id,
            "original_filename": original_filename,
            "file_type": ext,
            "file_size": file_size,
            "preview_url": f"/api/documents/{doc_id}/preview"
        },
        "verification": report
    }), 200

@document_bp.route("/<int:doc_id>/verification", methods=["GET"])
@login_required
def get_document_verification(doc_id: int):
    user = get_current_user()
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM documents WHERE id = ?;", (doc_id,))
    doc = cursor.fetchone()
    if not doc:
        conn.close()
        return jsonify({"error": "Document not found."}), 404

    if user["role"] != "admin" and doc["user_id"] != user["id"]:
        conn.close()
        return jsonify({"error": "Access forbidden: you do not have permission to view this document."}), 403

    cursor.execute("""
        SELECT * FROM document_verifications
        WHERE document_id = ?
        ORDER BY created_at DESC LIMIT 1;
    """, (doc_id,))
    v_row = cursor.fetchone()
    conn.close()

    if not v_row:
        return jsonify({"error": "No verification report found for this document."}), 404

    try:
        report = json.loads(v_row["report_json"])
    except Exception:
        report = {}

    return jsonify({
        "verification": report,
        "verification_ref": v_row["verification_ref"],
        "overall_status": v_row["overall_status"],
        "created_at": v_row["created_at"]
    })

@document_bp.route("", methods=["GET"])
@login_required
def list_documents():
    user = get_current_user()
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT d.id, d.original_filename, d.file_type, d.file_size, d.extraction_status,
               d.created_at, lr.id as linked_record_id, lr.owner_name as linked_owner_name
        FROM documents d
        LEFT JOIN land_records lr ON lr.source_document_id = d.id
        WHERE 1=1
    """
    params = []

    if user["role"] != "admin":
        query += " AND d.user_id = ?"
        params.append(user["id"])

    query += " ORDER BY d.created_at DESC;"

    cursor.execute(query, params)
    docs = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return jsonify({"documents": docs, "total": len(docs)})

@document_bp.route("/<int:doc_id>", methods=["GET"])
@login_required
def get_document(doc_id: int):
    user = get_current_user()
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM documents WHERE id = ?;", (doc_id,))
    doc = cursor.fetchone()
    conn.close()

    if not doc:
        return jsonify({"error": "Document not found."}), 404

    if user["role"] != "admin" and doc["user_id"] != user["id"]:
        return jsonify({"error": "Access denied: you do not have permission to view this document."}), 403

    doc_dict = dict(doc)
    try:
        doc_dict["structured_data"] = json.loads(doc_dict.get("structured_data_json") or "{}")
    except Exception:
        doc_dict["structured_data"] = {}

    return jsonify({"document": doc_dict})

@document_bp.route("/<int:doc_id>/preview", methods=["GET"])
@login_required
def preview_document(doc_id: int):
    user = get_current_user()
    conn = get_db_connection()
    doc = conn.execute("SELECT * FROM documents WHERE id = ?;", (doc_id,)).fetchone()
    conn.close()

    if not doc:
        return jsonify({"error": "Document not found."}), 404

    # Enforce authorization
    if user["role"] != "admin" and doc["user_id"] != user["id"]:
        log_audit_event(user["id"], "UNAUTHORIZED_DOCUMENT_PREVIEW_ATTEMPT", target_type="document", target_id=doc_id)
        return jsonify({"error": "Forbidden: unauthorized access to private document."}), 403

    safe_name = os.path.basename(doc["stored_filename"])
    file_path = os.path.join(Config.UPLOAD_FOLDER, safe_name)

    if not os.path.exists(file_path):
        return jsonify({"error": "Stored file is missing from private storage."}), 404

    # Content-type mapping
    mimetypes = {
        "pdf": "application/pdf",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg"
    }
    mimetype = mimetypes.get(doc["file_type"], "application/octet-stream")

    return send_file(file_path, mimetype=mimetype, as_attachment=False)

@document_bp.route("/<int:doc_id>/download", methods=["GET"])
@login_required
def download_document(doc_id: int):
    user = get_current_user()
    conn = get_db_connection()
    doc = conn.execute("SELECT * FROM documents WHERE id = ?;", (doc_id,)).fetchone()
    conn.close()

    if not doc:
        return jsonify({"error": "Document not found."}), 404

    if user["role"] != "admin" and doc["user_id"] != user["id"]:
        log_audit_event(user["id"], "UNAUTHORIZED_DOCUMENT_DOWNLOAD_ATTEMPT", target_type="document", target_id=doc_id)
        return jsonify({"error": "Forbidden: unauthorized document download attempt."}), 403

    safe_name = os.path.basename(doc["stored_filename"])
    file_path = os.path.join(Config.UPLOAD_FOLDER, safe_name)

    if not os.path.exists(file_path):
        return jsonify({"error": "Stored file missing from storage disk."}), 404

    log_audit_event(user["id"], "DOCUMENT_DOWNLOADED", target_type="document", target_id=doc_id)
    return send_file(file_path, as_attachment=True, download_name=doc["original_filename"])

@document_bp.route("/<int:doc_id>", methods=["DELETE"])
@login_required
def delete_document(doc_id: int):
    user = get_current_user()
    conn = get_db_connection()
    doc = conn.execute("SELECT * FROM documents WHERE id = ?;", (doc_id,)).fetchone()

    if not doc:
        conn.close()
        return jsonify({"error": "Document not found."}), 404

    if user["role"] != "admin" and doc["user_id"] != user["id"]:
        conn.close()
        return jsonify({"error": "Access forbidden: cannot delete another user's document."}), 403

    # Delete physical file
    safe_name = os.path.basename(doc["stored_filename"])
    file_path = os.path.join(Config.UPLOAD_FOLDER, safe_name)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"[File Delete Warning] {e}")

    conn.execute("DELETE FROM documents WHERE id = ?;", (doc_id,))
    conn.commit()
    conn.close()

    log_audit_event(user["id"], "DOCUMENT_DELETED", target_type="document", target_id=doc_id)
    return jsonify({"message": "Document removed successfully."})
