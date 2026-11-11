import json
import uuid
import datetime
from pathlib import Path
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify
from auth import login_required, get_current_user
from audit import log_audit_event
from db import get_db_connection
from config import Config
from validation_engine import record_and_save_validation, validate_parcel_registration
from otp_service import validate_aadhaar, mask_aadhaar, validate_pan, mask_pan, hash_identity, validate_mobile, normalize_mobile

record_bp = Blueprint("records", __name__, url_prefix="/api/records")

@record_bp.route("/owner-photo", methods=["POST"])
@login_required
def upload_owner_photo():
    user = get_current_user()
    if "photo" not in request.files:
        return jsonify({"error": "No photograph file provided in request."}), 400

    file = request.files["photo"]
    if not file or not file.filename:
        return jsonify({"error": "Empty or invalid photograph file selected."}), 400

    filename = secure_filename(file.filename)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in Config.PHOTO_ALLOWED_EXTENSIONS:
        return jsonify({"error": f"Invalid photo format (.{ext}). Only JPG, JPEG, and PNG passport-size photographs are supported."}), 400

    file_bytes = file.read()
    if len(file_bytes) > Config.MAX_PHOTO_SIZE:
        return jsonify({"error": "Photo file size exceeds maximum limit of 5 MB."}), 400

    stored_name = f"photo_{user['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    target_dir = Path(Config.UPLOAD_FOLDER)
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / stored_name
    with open(target_path, "wb") as f:
        f.write(file_bytes)

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO documents (user_id, original_filename, stored_filename, file_type, file_size, extraction_status)
        VALUES (?, ?, ?, ?, ?, 'completed');
    """, (user["id"], filename, stored_name, f"image/{ext}", len(file_bytes)))
    conn.commit()
    doc_id = cursor.lastrowid
    conn.close()

    photo_url = f"/api/documents/{doc_id}/preview"
    return jsonify({
        "message": "Passport photo uploaded successfully.",
        "photo_id": doc_id,
        "photo_url": photo_url,
        "filename": filename
    }), 201

@record_bp.route("", methods=["GET"])
@login_required
def list_records():
    user = get_current_user()
    search = request.args.get("search", "").strip()
    status_filter = request.args.get("status", "").strip()
    reg_status_filter = request.args.get("registration_status", "").strip()
    district_filter = request.args.get("district", "").strip()

    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT lr.*, d.original_filename as source_doc_name
        FROM land_records lr
        LEFT JOIN documents d ON lr.source_document_id = d.id
        WHERE 1=1
    """
    params = []

    # Ownership enforcement: admins can see all, owners see only their records
    if user["role"] != "admin":
        query += " AND lr.user_id = ?"
        params.append(user["id"])

    if search:
        query += """ AND (
            lr.owner_name LIKE ? OR
            lr.survey_number LIKE ? OR
            lr.patta_number LIKE ? OR
            lr.document_reference LIKE ? OR
            lr.application_number LIKE ? OR
            lr.village LIKE ?
        )"""
        s_term = f"%{search}%"
        params.extend([s_term, s_term, s_term, s_term, s_term, s_term])

    if status_filter:
        if status_filter.upper() == "DRAFT":
            query += " AND (lr.is_draft = 1 OR lr.registration_status = 'DRAFT')"
        elif status_filter.upper() in {"SUBMITTED FOR REVIEW", "PENDING VERIFICATION"}:
            query += " AND (lr.registration_status IN ('Submitted for Review', 'PENDING VERIFICATION') AND (lr.is_draft = 0 OR lr.is_draft IS NULL))"
        else:
            query += " AND (lr.validation_status = ? OR lr.registration_status = ?)"
            params.extend([status_filter, status_filter])

    if reg_status_filter:
        if reg_status_filter.upper() == "DRAFT":
            query += " AND (lr.is_draft = 1 OR lr.registration_status = 'DRAFT')"
        else:
            query += " AND lr.registration_status = ?"
            params.append(reg_status_filter)

    if district_filter:
        query += " AND lr.district = ?"
        params.append(district_filter)

    query += " ORDER BY lr.updated_at DESC;"

    cursor.execute(query, params)
    rows = cursor.fetchall()

    # Calculate status counts for the current user's records
    c_query = "SELECT is_draft, registration_status, validation_status FROM land_records WHERE 1=1"
    c_params = []
    if user["role"] != "admin":
        c_query += " AND user_id = ?"
        c_params.append(user["id"])
    cursor.execute(c_query, c_params)
    all_user_rows = cursor.fetchall()
    conn.close()

    counts = {
        "total": len(all_user_rows),
        "drafts": sum(1 for r in all_user_rows if r["is_draft"] == 1 or r["registration_status"] == "DRAFT"),
        "submitted": sum(1 for r in all_user_rows if r["is_draft"] != 1 and r["registration_status"] in ("Submitted for Review", "PENDING VERIFICATION")),
        "passed": sum(1 for r in all_user_rows if r["is_draft"] != 1 and r["validation_status"] in ("Application Checks Passed", "VERIFICATION COMPLETED")),
        "needs_review": sum(1 for r in all_user_rows if r["is_draft"] != 1 and r["validation_status"] in ("Needs Review", "FLAGGED FOR REVIEW") and r["registration_status"] not in ("Submitted for Review", "PENDING VERIFICATION"))
    }

    records = [dict(r) for r in rows]
    return jsonify({"records": records, "total": len(records), "counts": counts})

@record_bp.route("", methods=["POST"])
@login_required
def create_record():
    user = get_current_user()
    if user["role"] not in {"owner", "admin"}:
        return jsonify({"error": "Only owners or administrators can create land records."}), 403

    data = request.get_json() or {}

    is_draft = bool(data.get("is_draft") or data.get("registration_status") == "DRAFT")

    owner_name = (data.get("owner_name") or "").strip()
    district = (data.get("district") or "").strip()
    village = (data.get("village") or "").strip()
    taluk = (data.get("taluk") or "").strip()
    survey_number = (data.get("survey_number") or "").strip()
    subdivision_number = (data.get("subdivision_number") or "").strip()
    patta_number = (data.get("patta_number") or "").strip()
    doc_ref = (data.get("document_reference") or data.get("document_number") or "").strip()

    if not is_draft and (not owner_name or not district or not village):
        return jsonify({"error": "Owner name, district, and village are mandatory fields."}), 400

    owner_name = owner_name or ("Draft Land Parcel" if is_draft else "Unspecified Owner")
    district = district or ("Unspecified District" if is_draft else "Coimbatore")
    village = village or ("Unspecified Village" if is_draft else "Unspecified Village")
    if not doc_ref:
        doc_ref = f"DRAFT-{datetime.datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}" if is_draft else f"DOC-{datetime.datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

    try:
        land_area_float = float(data.get("land_area")) if data.get("land_area") is not None else 0.0
    except (ValueError, TypeError):
        land_area_float = 0.0

    land_unit = (data.get("land_unit") or "sq.ft").strip()
    source_doc_id = data.get("source_document_id")

    # Section A: Document details
    document_type = (data.get("document_type") or "Patta").strip()
    registration_date = (data.get("registration_date") or "").strip()
    previous_doc_reference = (data.get("previous_doc_reference") or "").strip()
    issuing_authority = (data.get("issuing_authority") or "").strip()
    document_issue_date = (data.get("document_issue_date") or "").strip()

    # Section B: Owner & Ownership details
    previous_owner_name = (data.get("previous_owner_name") or "").strip()
    try:
        number_of_owners = int(data.get("number_of_owners") or 1)
    except (ValueError, TypeError):
        number_of_owners = 1
    ownership_type = (data.get("ownership_type") or "Sole Ownership").strip()

    co_owners = data.get("co_owners") or []
    co_owners_json = json.dumps(co_owners) if isinstance(co_owners, (list, dict)) else str(co_owners)
    owner_address = (data.get("owner_address") or "").strip()
    transfer_details = (data.get("transfer_details") or "").strip()

    # Owner Identity & Verification Fields (Never store plaintext Aadhaar / PAN)
    raw_aadhaar = (data.get("aadhaar_number") or "").strip()
    aadhaar_masked = (data.get("aadhaar_masked") or "").strip()
    aadhaar_hash = ""
    if raw_aadhaar:
        is_val, clean_aadh, aadh_err = validate_aadhaar(raw_aadhaar)
        if not is_val:
            if not is_draft:
                return jsonify({"error": aadh_err}), 400
        else:
            aadhaar_hash = hash_identity(clean_aadh)
            aadhaar_masked = mask_aadhaar(clean_aadh)

    raw_pan = (data.get("pan_number") or "").strip()
    pan_masked = (data.get("pan_masked") or "").strip()
    pan_hash = ""
    if raw_pan:
        is_val, clean_pan, pan_err = validate_pan(raw_pan)
        if not is_val:
            if not is_draft:
                return jsonify({"error": pan_err}), 400
        else:
            pan_hash = hash_identity(clean_pan)
            pan_masked = mask_pan(clean_pan)

    owner_photo_id = data.get("owner_photo_id")
    owner_photo_url = (data.get("owner_photo_url") or "").strip()

    owner_mobile = (data.get("owner_mobile") or "").strip()
    if owner_mobile:
        owner_mobile = normalize_mobile(owner_mobile)

    mobile_verification_status = (data.get("mobile_verification_status") or "Not Verified").strip()
    owner_mobile_verified = 0

    # Strictly verify against actual server-side mobile OTP record
    if owner_mobile and (mobile_verification_status == "Verified" or data.get("owner_mobile_verified")):
        chk_conn = get_db_connection()
        chk_cursor = chk_conn.cursor()
        chk_cursor.execute("SELECT id FROM mobile_otps WHERE mobile = ? AND verified_at IS NOT NULL ORDER BY id DESC LIMIT 1;", (owner_mobile,))
        v_row = chk_cursor.fetchone()
        chk_conn.close()
        if v_row:
            owner_mobile_verified = 1
            mobile_verification_status = "Verified"
        else:
            owner_mobile_verified = 0
            if mobile_verification_status == "Verified":
                mobile_verification_status = "Not Verified"

    # Section C: Location & Revenue details
    panchayat_local_body = (data.get("panchayat_local_body") or "").strip()
    plot_number = (data.get("plot_number") or "").strip()
    land_address = (data.get("land_address") or "").strip()

    # Section D: Extent & Classification
    land_classification = (data.get("land_classification") or "Wetland (Nanjai)").strip()
    wetland_dryland = (data.get("wetland_dryland") or "Wetland (Nanjai)").strip()
    land_use_type = (data.get("land_use_type") or "Agricultural").strip()
    possession_status = (data.get("possession_status") or "Self-Occupied / In Possession").strip()
    encumbrance_status = (data.get("encumbrance_status") or "Nil / No Encumbrance").strip()
    property_tax_reference = (data.get("property_tax_reference") or "").strip()

    # Section E: Boundaries
    boundary_north = (data.get("boundary_north") or "").strip()
    boundary_south = (data.get("boundary_south") or "").strip()
    boundary_east = (data.get("boundary_east") or "").strip()
    boundary_west = (data.get("boundary_west") or "").strip()
    adjacent_survey_numbers = (data.get("adjacent_survey_numbers") or "").strip()
    access_road_details = (data.get("access_road_details") or "").strip()

    # Section F: Supporting Documents
    supporting_docs = data.get("supporting_documents") or []
    supporting_documents_json = json.dumps(supporting_docs) if isinstance(supporting_docs, (list, dict)) else str(supporting_docs)

    application_number = (data.get("application_number") or "").strip()
    if not application_number:
        application_number = f"APP-{datetime.datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:5].upper()}"

    # Multi-factor authenticity & validation engine
    validation_res = validate_parcel_registration(data)

    is_draft_int = 1 if is_draft else 0
    if is_draft:
        registration_status = "DRAFT"
        validation_status = "Needs Review"
    else:
        reg_stat = validation_res.get("registration_status", "PENDING VERIFICATION")
        requested_status = (data.get("registration_status") or "").strip()
        if requested_status == "Submitted for Review" and reg_stat != "FLAGGED FOR REVIEW":
            reg_stat = "Submitted for Review"
        elif reg_stat == "REGISTERED":
            reg_stat = requested_status or "Submitted for Review"
        registration_status = reg_stat
        validation_status = validation_res.get("validation_status", "Needs Review")

    comprehensive_verification_json = json.dumps(validation_res)

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO land_records (
            user_id, application_number, registration_status, owner_name, patta_number,
            survey_number, subdivision_number, district, taluk, village, land_area,
            land_unit, document_reference, document_type, registration_date,
            previous_doc_reference, issuing_authority, document_issue_date,
            previous_owner_name, number_of_owners, ownership_type, co_owners_json,
            owner_address, transfer_details, panchayat_local_body, plot_number,
            land_address, land_classification, wetland_dryland, land_use_type,
            possession_status, encumbrance_status, property_tax_reference,
            boundary_north, boundary_south, boundary_east, boundary_west,
            adjacent_survey_numbers, access_road_details, supporting_documents_json,
            comprehensive_verification_json, source_document_id, validation_status,
            aadhaar_hash, aadhaar_masked, pan_hash, pan_masked,
            owner_photo_id, owner_photo_url, owner_mobile, owner_mobile_verified, mobile_verification_status,
            is_sample, is_draft
        ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            0, ?
        );
    """, (
        user["id"], application_number, registration_status, owner_name, patta_number,
        survey_number, subdivision_number, district, taluk, village, land_area_float,
        land_unit, doc_ref, document_type, registration_date,
        previous_doc_reference, issuing_authority, document_issue_date,
        previous_owner_name, number_of_owners, ownership_type, co_owners_json,
        owner_address, transfer_details, panchayat_local_body, plot_number,
        land_address, land_classification, wetland_dryland, land_use_type,
        possession_status, encumbrance_status, property_tax_reference,
        boundary_north, boundary_south, boundary_east, boundary_west,
        adjacent_survey_numbers, access_road_details, supporting_documents_json,
        comprehensive_verification_json, source_doc_id, validation_status,
        aadhaar_hash, aadhaar_masked, pan_hash, pan_masked,
        owner_photo_id, owner_photo_url, owner_mobile, owner_mobile_verified, mobile_verification_status,
        is_draft_int
    ))
    conn.commit()
    record_id = cursor.lastrowid

    # Populate validation_results table for inspection & historical tracking
    issues_list = []
    for chk in validation_res.get("checks", []):
        if chk["status"] in {"FAILED", "NEEDS REVIEW"}:
            issues_list.append({
                "field": chk.get("name"),
                "severity": "error" if chk["status"] == "FAILED" else "warning",
                "problem": chk.get("summary"),
                "explanation": chk.get("explanation"),
                "suggested_correction": "Review and amend corresponding section before proceeding with certified registration."
            })

    cursor.execute("""
        INSERT INTO validation_results (record_id, status, issues_json)
        VALUES (?, ?, ?);
    """, (record_id, validation_status, json.dumps(issues_list)))
    conn.commit()
    conn.close()

    log_audit_event(
        user["id"],
        "LAND_PARCEL_DRAFT_SAVED" if is_draft else "LAND_PARCEL_SUBMITTED_FOR_VERIFICATION",
        target_type="land_record",
        target_id=record_id,
        details={
            "application_number": application_number,
            "registration_status": registration_status,
            "doc_ref": doc_ref,
            "village": village,
            "is_draft": is_draft_int
        }
    )

    return jsonify({
        "message": "Land parcel draft saved." if is_draft else "Land parcel validated and saved to registry.",
        "record_id": record_id,
        "application_number": application_number,
        "registration_status": registration_status,
        "validation_status": validation_status,
        "is_draft": is_draft_int,
        "validation": validation_res
    }), 201

@record_bp.route("/<int:record_id>", methods=["GET"])
@login_required
def get_record(record_id: int):
    user = get_current_user()
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT lr.*, d.original_filename as source_doc_name
        FROM land_records lr
        LEFT JOIN documents d ON lr.source_document_id = d.id
        WHERE lr.id = ?;
    """, (record_id,))
    record = cursor.fetchone()

    if not record:
        conn.close()
        return jsonify({"error": "Land record not found."}), 404

    # Authorization verification
    if user["role"] != "admin" and record["user_id"] != user["id"]:
        conn.close()
        log_audit_event(user["id"], "UNAUTHORIZED_RECORD_ACCESS_ATTEMPT", target_type="land_record", target_id=record_id)
        return jsonify({"error": "Access forbidden: you do not have permission to view this record."}), 403

    # Fetch latest validation result
    cursor.execute("""
        SELECT status, issues_json, checked_at
        FROM validation_results
        WHERE record_id = ?
        ORDER BY checked_at DESC LIMIT 1;
    """, (record_id,))
    val_row = cursor.fetchone()
    conn.close()

    val_data = None
    if val_row:
        try:
            val_data = {
                "status": val_row["status"],
                "issues": json.loads(val_row["issues_json"]),
                "checked_at": val_row["checked_at"]
            }
        except Exception:
            val_data = {"status": val_row["status"], "issues": []}

    res = dict(record)
    res["validation_details"] = val_data

    # Parse JSON fields into native structures
    for json_col in ["co_owners_json", "supporting_documents_json", "comprehensive_verification_json"]:
        if res.get(json_col):
            try:
                res[json_col.replace("_json", "")] = json.loads(res[json_col])
            except Exception:
                res[json_col.replace("_json", "")] = None

    return jsonify({"record": res})

@record_bp.route("/<int:record_id>", methods=["PUT"])
@login_required
def update_record(record_id: int):
    user = get_current_user()
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM land_records WHERE id = ?;", (record_id,))
    record = cursor.fetchone()
    if not record:
        conn.close()
        return jsonify({"error": "Land record not found."}), 404

    # Ownership check
    if user["role"] != "admin" and record["user_id"] != user["id"]:
        conn.close()
        return jsonify({"error": "Access denied: unauthorized to edit this record."}), 403

    data = request.get_json() or {}
    is_draft = bool(data.get("is_draft") or data.get("registration_status") == "DRAFT")

    owner_name = data.get("owner_name", record["owner_name"]).strip()
    patta_number = data.get("patta_number", record["patta_number"] or "").strip()
    survey_number = data.get("survey_number", record["survey_number"] or "").strip()
    subdivision_number = data.get("subdivision_number", record["subdivision_number"] or "").strip()
    district = data.get("district", record["district"]).strip()
    taluk = data.get("taluk", record["taluk"] or "").strip()
    village = data.get("village", record["village"]).strip()
    land_area = data.get("land_area", record["land_area"])
    land_unit = data.get("land_unit", record["land_unit"]).strip()
    doc_ref = data.get("document_reference", record["document_reference"]).strip()

    try:
        land_area_float = float(land_area)
    except (ValueError, TypeError):
        land_area_float = record["land_area"]

    # Extended registration fields
    document_type = data.get("document_type", record["document_type"] or "Patta")
    registration_date = data.get("registration_date", record["registration_date"] or "")
    previous_doc_reference = data.get("previous_doc_reference", record["previous_doc_reference"] or "")
    issuing_authority = data.get("issuing_authority", record["issuing_authority"] or "")
    document_issue_date = data.get("document_issue_date", record["document_issue_date"] or "")

    previous_owner_name = data.get("previous_owner_name", record["previous_owner_name"] or "")
    try:
        number_of_owners = int(data.get("number_of_owners", record["number_of_owners"] or 1))
    except (ValueError, TypeError):
        number_of_owners = 1
    ownership_type = data.get("ownership_type", record["ownership_type"] or "Sole Ownership")

    co_owners = data.get("co_owners")
    if co_owners is not None:
        co_owners_json = json.dumps(co_owners) if isinstance(co_owners, (list, dict)) else str(co_owners)
    else:
        co_owners_json = record["co_owners_json"]

    owner_address = data.get("owner_address", record["owner_address"] or "")
    transfer_details = data.get("transfer_details", record["transfer_details"] or "")

    # Owner Identity & Verification Fields (Never store plaintext Aadhaar / PAN)
    raw_aadhaar = data.get("aadhaar_number")
    if raw_aadhaar is not None:
        raw_aadhaar = str(raw_aadhaar).strip()
        if raw_aadhaar:
            is_val, clean_aadh, aadh_err = validate_aadhaar(raw_aadhaar)
            if not is_val:
                if not is_draft:
                    return jsonify({"error": aadh_err}), 400
            else:
                aadhaar_hash = hash_identity(clean_aadh)
                aadhaar_masked = mask_aadhaar(clean_aadh)
        else:
            aadhaar_hash = ""
            aadhaar_masked = ""
    else:
        aadhaar_hash = record["aadhaar_hash"]
        aadhaar_masked = record["aadhaar_masked"]

    raw_pan = data.get("pan_number")
    if raw_pan is not None:
        raw_pan = str(raw_pan).strip()
        if raw_pan:
            is_val, clean_pan, pan_err = validate_pan(raw_pan)
            if not is_val:
                if not is_draft:
                    return jsonify({"error": pan_err}), 400
            else:
                pan_hash = hash_identity(clean_pan)
                pan_masked = mask_pan(clean_pan)
        else:
            pan_hash = ""
            pan_masked = ""
    else:
        pan_hash = record["pan_hash"]
        pan_masked = record["pan_masked"]

    owner_photo_id = data.get("owner_photo_id", record["owner_photo_id"])
    owner_photo_url = data.get("owner_photo_url", record["owner_photo_url"])

    owner_mobile = data.get("owner_mobile", record["owner_mobile"] or "")
    if owner_mobile:
        owner_mobile = normalize_mobile(owner_mobile)

    mobile_verification_status = data.get("mobile_verification_status", record["mobile_verification_status"] or "Not Verified")
    owner_mobile_verified = record["owner_mobile_verified"] or 0

    if owner_mobile and (mobile_verification_status == "Verified" or data.get("owner_mobile_verified")):
        chk_conn = get_db_connection()
        chk_cursor = chk_conn.cursor()
        chk_cursor.execute("SELECT id FROM mobile_otps WHERE mobile = ? AND verified_at IS NOT NULL ORDER BY id DESC LIMIT 1;", (owner_mobile,))
        v_row = chk_cursor.fetchone()
        chk_conn.close()
        if v_row:
            owner_mobile_verified = 1
            mobile_verification_status = "Verified"
        else:
            owner_mobile_verified = 0
            if mobile_verification_status == "Verified":
                mobile_verification_status = "Not Verified"

    panchayat_local_body = data.get("panchayat_local_body", record["panchayat_local_body"] or "")
    plot_number = data.get("plot_number", record["plot_number"] or "")
    land_address = data.get("land_address", record["land_address"] or "")

    land_classification = data.get("land_classification", record["land_classification"] or "Wetland (Nanjai)")
    wetland_dryland = data.get("wetland_dryland", record["wetland_dryland"] or "Wetland (Nanjai)")
    land_use_type = data.get("land_use_type", record["land_use_type"] or "Agricultural")
    possession_status = data.get("possession_status", record["possession_status"] or "Self-Occupied / In Possession")
    encumbrance_status = data.get("encumbrance_status", record["encumbrance_status"] or "Nil / No Encumbrance")
    property_tax_reference = data.get("property_tax_reference", record["property_tax_reference"] or "")

    boundary_north = data.get("boundary_north", record["boundary_north"] or "")
    boundary_south = data.get("boundary_south", record["boundary_south"] or "")
    boundary_east = data.get("boundary_east", record["boundary_east"] or "")
    boundary_west = data.get("boundary_west", record["boundary_west"] or "")
    adjacent_survey_numbers = data.get("adjacent_survey_numbers", record["adjacent_survey_numbers"] or "")
    access_road_details = data.get("access_road_details", record["access_road_details"] or "")

    supporting_docs = data.get("supporting_documents")
    if supporting_docs is not None:
        supporting_documents_json = json.dumps(supporting_docs) if isinstance(supporting_docs, (list, dict)) else str(supporting_docs)
    else:
        supporting_documents_json = record["supporting_documents_json"]

    # Re-evaluate multi-factor verification
    eval_payload = {
        "owner_name": owner_name,
        "patta_number": patta_number,
        "survey_number": survey_number,
        "subdivision_number": subdivision_number,
        "district": district,
        "taluk": taluk,
        "village": village,
        "land_area": land_area_float,
        "land_unit": land_unit,
        "document_reference": doc_ref,
        "document_type": document_type,
        "registration_date": registration_date,
        "previous_doc_reference": previous_doc_reference,
        "issuing_authority": issuing_authority,
        "document_issue_date": document_issue_date,
        "previous_owner_name": previous_owner_name,
        "number_of_owners": number_of_owners,
        "ownership_type": ownership_type,
        "co_owners": data.get("co_owners"),
        "owner_address": owner_address,
        "transfer_details": transfer_details,
        "panchayat_local_body": panchayat_local_body,
        "plot_number": plot_number,
        "land_address": land_address,
        "land_classification": land_classification,
        "wetland_dryland": wetland_dryland,
        "land_use_type": land_use_type,
        "possession_status": possession_status,
        "encumbrance_status": encumbrance_status,
        "property_tax_reference": property_tax_reference,
        "boundary_north": boundary_north,
        "boundary_south": boundary_south,
        "boundary_east": boundary_east,
        "boundary_west": boundary_west,
        "adjacent_survey_numbers": adjacent_survey_numbers,
        "access_road_details": access_road_details,
        "supporting_documents": data.get("supporting_documents"),
        "source_document_id": data.get("source_document_id", record["source_document_id"])
    }

    val_result = validate_parcel_registration(eval_payload, current_record_id=record_id)

    is_draft_int = 1 if is_draft else 0
    if is_draft:
        registration_status = "DRAFT"
        validation_status = "Needs Review"
    else:
        reg_stat = val_result.get("registration_status", "PENDING VERIFICATION")
        requested_status = (data.get("registration_status") or "").strip()
        if requested_status == "Submitted for Review" and reg_stat != "FLAGGED FOR REVIEW":
            reg_stat = "Submitted for Review"
        elif reg_stat == "REGISTERED":
            reg_stat = requested_status or "Submitted for Review"
        registration_status = reg_stat
        validation_status = val_result.get("validation_status", "Needs Review")

    comp_verif_json = json.dumps(val_result)

    cursor.execute("""
        UPDATE land_records SET
            owner_name = ?, patta_number = ?, survey_number = ?, subdivision_number = ?,
            district = ?, taluk = ?, village = ?, land_area = ?, land_unit = ?,
            document_reference = ?, document_type = ?, registration_date = ?,
            previous_doc_reference = ?, issuing_authority = ?, document_issue_date = ?,
            previous_owner_name = ?, number_of_owners = ?, ownership_type = ?, co_owners_json = ?,
            owner_address = ?, transfer_details = ?, panchayat_local_body = ?, plot_number = ?,
            land_address = ?, land_classification = ?, wetland_dryland = ?, land_use_type = ?,
            possession_status = ?, encumbrance_status = ?, property_tax_reference = ?,
            boundary_north = ?, boundary_south = ?, boundary_east = ?, boundary_west = ?,
            adjacent_survey_numbers = ?, access_road_details = ?, supporting_documents_json = ?,
            comprehensive_verification_json = ?, registration_status = ?, validation_status = ?,
            aadhaar_hash = ?, aadhaar_masked = ?, pan_hash = ?, pan_masked = ?,
            owner_photo_id = ?, owner_photo_url = ?, owner_mobile = ?, owner_mobile_verified = ?,
            mobile_verification_status = ?, is_draft = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?;
    """, (
        owner_name, patta_number, survey_number, subdivision_number,
        district, taluk, village, land_area_float, land_unit,
        doc_ref, document_type, registration_date,
        previous_doc_reference, issuing_authority, document_issue_date,
        previous_owner_name, number_of_owners, ownership_type, co_owners_json,
        owner_address, transfer_details, panchayat_local_body, plot_number,
        land_address, land_classification, wetland_dryland, land_use_type,
        possession_status, encumbrance_status, property_tax_reference,
        boundary_north, boundary_south, boundary_east, boundary_west,
        adjacent_survey_numbers, access_road_details, supporting_documents_json,
        comp_verif_json, registration_status, validation_status,
        aadhaar_hash, aadhaar_masked, pan_hash, pan_masked,
        owner_photo_id, owner_photo_url, owner_mobile, owner_mobile_verified,
        mobile_verification_status, is_draft_int,
        record_id
    ))
    conn.commit()

    # Save to validation_results
    issues_list = []
    for chk in val_result.get("checks", []):
        if chk["status"] in {"FAILED", "NEEDS REVIEW"}:
            issues_list.append({
                "field": chk.get("name"),
                "severity": "error" if chk["status"] == "FAILED" else "warning",
                "problem": chk.get("summary"),
                "explanation": chk.get("explanation"),
                "suggested_correction": "Review and amend corresponding section before proceeding with certified registration."
            })

    cursor.execute("""
        INSERT INTO validation_results (record_id, status, issues_json)
        VALUES (?, ?, ?);
    """, (record_id, validation_status, json.dumps(issues_list)))
    conn.commit()
    conn.close()

    log_audit_event(user["id"], "LAND_RECORD_UPDATED", target_type="land_record", target_id=record_id, details={
        "registration_status": registration_status,
        "is_draft": is_draft_int
    })

    return jsonify({
        "message": "Land parcel draft updated." if is_draft else "Land parcel validated and saved to registry.",
        "record_id": record_id,
        "registration_status": registration_status,
        "validation_status": validation_status,
        "is_draft": is_draft_int,
        "validation": val_result
    })

@record_bp.route("/<int:record_id>/validate", methods=["POST"])
@login_required
def rerun_validation(record_id: int):
    user = get_current_user()
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM land_records WHERE id = ?;", (record_id,))
    record = cursor.fetchone()
    if not record:
        conn.close()
        return jsonify({"error": "Land record not found."}), 404

    if user["role"] != "admin" and record["user_id"] != user["id"]:
        conn.close()
        return jsonify({"error": "Access denied."}), 403

    conn.close()

    val_result = record_and_save_validation(record_id, dict(record))
    log_audit_event(user["id"], "LAND_RECORD_VALIDATION_RERUN", target_type="land_record", target_id=record_id)

    return jsonify({
        "message": "Validation rerun completed.",
        "record_id": record_id,
        "validation": val_result
    })

@record_bp.route("/<int:record_id>", methods=["DELETE"])
@login_required
def delete_record(record_id: int):
    user = get_current_user()
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id, user_id FROM land_records WHERE id = ?;", (record_id,))
    record = cursor.fetchone()
    if not record:
        conn.close()
        return jsonify({"error": "Land record not found."}), 404

    if user["role"] != "admin" and record["user_id"] != user["id"]:
        conn.close()
        return jsonify({"error": "Access denied."}), 403

    cursor.execute("DELETE FROM land_records WHERE id = ?;", (record_id,))
    conn.commit()
    conn.close()

    log_audit_event(user["id"], "LAND_RECORD_DELETED", target_type="land_record", target_id=record_id)
    return jsonify({"message": "Land record successfully deleted."})
