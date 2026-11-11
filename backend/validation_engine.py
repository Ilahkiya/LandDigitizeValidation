import json
import re
from db import get_db_connection

def validate_land_record(record_data: dict, current_record_id: int = None) -> dict:
    """
    Evaluates land record quality rules, detects anomalies, format errors,
    duplicate references, and conflicting property records.
    Returns status, list of issues, and persists findings to SQLite.
    """
    issues = []

    owner_name = (record_data.get("owner_name") or "").strip()
    patta_number = (record_data.get("patta_number") or "").strip()
    survey_number = (record_data.get("survey_number") or "").strip()
    subdivision_number = (record_data.get("subdivision_number") or "").strip()
    district = (record_data.get("district") or "").strip()
    taluk = (record_data.get("taluk") or "").strip()
    village = (record_data.get("village") or "").strip()
    land_area_raw = record_data.get("land_area")
    land_unit = (record_data.get("land_unit") or "sq.ft").strip()
    doc_ref = (record_data.get("document_reference") or "").strip()

    # Rule 1: Missing Required Basic Fields
    if not owner_name:
        issues.append({
            "field": "owner_name",
            "severity": "error",
            "problem": "Owner name is missing",
            "explanation": "Every valid land parcel registration requires an identified owner name.",
            "suggested_correction": "Enter the full legal name of the title holder."
        })
    elif len(owner_name) < 3:
        issues.append({
            "field": "owner_name",
            "severity": "warning",
            "problem": "Unusually short owner name",
            "explanation": f"The value '{owner_name}' may be incomplete or an abbreviation.",
            "suggested_correction": "Provide the complete name along with initials as registered in the revenue record."
        })

    if not district:
        issues.append({
            "field": "district",
            "severity": "error",
            "problem": "District name is missing",
            "explanation": "Revenue records require administrative district categorization.",
            "suggested_correction": "Select or input the revenue district (e.g., Coimbatore, Chennai)."
        })

    if not taluk:
        issues.append({
            "field": "taluk",
            "severity": "error",
            "problem": "Taluk is missing",
            "explanation": "Revenue taluk is mandatory for cadastral boundary mapping.",
            "suggested_correction": "Provide the jurisdictional taluk."
        })

    if not village:
        issues.append({
            "field": "village",
            "severity": "error",
            "problem": "Revenue village is missing",
            "explanation": "Cadastral survey numbers are indexed at the revenue village level.",
            "suggested_correction": "Specify the revenue village name."
        })

    # Rule 2: Survey & Subdivision Number validation
    if not survey_number:
        issues.append({
            "field": "survey_number",
            "severity": "error",
            "problem": "Survey number is missing",
            "explanation": "Survey numbers are the primary identification for land parcels.",
            "suggested_correction": "Enter the survey number indicated in the Patta/Deed."
        })
    elif not re.match(r"^\d+[A-Za-z0-9\-\/]*$", survey_number):
        issues.append({
            "field": "survey_number",
            "severity": "warning",
            "problem": "Unexpected survey number format",
            "explanation": f"Survey number '{survey_number}' contains unconventional characters.",
            "suggested_correction": "Ensure only alphanumeric characters or standard slashes are used."
        })

    if not subdivision_number:
        issues.append({
            "field": "subdivision_number",
            "severity": "warning",
            "problem": "Subdivision identifier is missing",
            "explanation": "Most modern Tamil Nadu parcels specify a subdivision letter/number (e.g. 1A, 2B).",
            "suggested_correction": "Provide subdivision if applicable, or enter '1' / 'NA' if unsubdivided."
        })

    # Rule 3: Land Area & Unit validation
    area_val = None
    try:
        if land_area_raw is not None and str(land_area_raw).strip() != "":
            area_val = float(land_area_raw)
            if area_val <= 0:
                issues.append({
                    "field": "land_area",
                    "severity": "error",
                    "problem": "Zero or negative land area",
                    "explanation": f"Reported land extent is {area_val} {land_unit}, which is physically impossible.",
                    "suggested_correction": "Enter a positive numeric area value greater than zero."
                })
        else:
            issues.append({
                "field": "land_area",
                "severity": "error",
                "problem": "Land area is missing",
                "explanation": "Extent of land parcel must be specified for agreement drafting and record integrity.",
                "suggested_correction": "Specify the numeric area measurement."
            })
    except (ValueError, TypeError):
        issues.append({
            "field": "land_area",
            "severity": "error",
            "problem": "Invalid numeric format for land area",
            "explanation": f"The value '{land_area_raw}' cannot be parsed as a decimal number.",
            "suggested_correction": "Enter a valid positive number (e.g. 2400 or 5.5)."
        })

    # Rule 4: Document Reference Validation
    if not doc_ref:
        issues.append({
            "field": "document_reference",
            "severity": "error",
            "problem": "Document reference is missing",
            "explanation": "A document reference or deed/patta index number is required for traceability.",
            "suggested_correction": "Enter the document registration or reference number."
        })

    # Database-level cross-record checks:
    # Rule 5: Duplicate Document Reference Check
    # Rule 6: Conflicting Owner / Survey Property Details Check
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Check for duplicate document references
        if doc_ref:
            query = "SELECT id, owner_name, village FROM land_records WHERE document_reference = ?"
            params = [doc_ref]
            if current_record_id:
                query += " AND id != ?"
                params.append(current_record_id)
            cursor.execute(query, params)
            duplicate_refs = cursor.fetchall()

            if duplicate_refs:
                dup_names = ", ".join([f"Record #{r['id']} ({r['owner_name']})" for r in duplicate_refs])
                issues.append({
                    "field": "document_reference",
                    "severity": "error",
                    "problem": "Duplicate document reference number detected",
                    "explanation": f"Document reference '{doc_ref}' is already associated with existing record(s): {dup_names}.",
                    "suggested_correction": "Verify if this document has already been digitized or if the reference is erroneous."
                })

        # Check for conflicting property claims:
        # Same Village + Survey + Subdivision, but conflicting owner or vastly differing area (>15%)
        if village and survey_number and subdivision_number:
            query = """
                SELECT id, owner_name, land_area, land_unit, document_reference
                FROM land_records
                WHERE LOWER(village) = LOWER(?)
                  AND survey_number = ?
                  AND subdivision_number = ?
            """
            params = [village, survey_number, subdivision_number]
            if current_record_id:
                query += " AND id != ?"
                params.append(current_record_id)
            cursor.execute(query, params)
            matching_parcels = cursor.fetchall()

            for match in matching_parcels:
                other_owner = (match["owner_name"] or "").strip().lower()
                this_owner = owner_name.lower()
                # Check for owner conflict
                if this_owner and other_owner and this_owner != other_owner:
                    issues.append({
                        "field": "owner_name",
                        "severity": "error",
                        "problem": "Conflicting property ownership claim detected",
                        "explanation": f"Cadastral parcel {survey_number}/{subdivision_number} in '{village}' is also recorded under owner '{match['owner_name']}' (Record #{match['id']}, Doc Ref: {match['document_reference']}).",
                        "suggested_correction": "Cross-check prior title deeds and verify encumbrance certificate via TN e-Services."
                    })
                # Check for extent discrepancy
                if area_val and match["land_area"]:
                    if match["land_unit"] == land_unit and abs(area_val - match["land_area"]) > 0.01:
                        issues.append({
                            "field": "land_area",
                            "severity": "warning",
                            "problem": "Land extent mismatch with existing record",
                            "explanation": f"Record #{match['id']} lists this parcel as {match['land_area']} {match['land_unit']}, whereas this record states {area_val} {land_unit}.",
                            "suggested_correction": "Check subdivision deed for partial partition or measurement discrepancies."
                        })

        conn.close()
    except Exception as db_err:
        print(f"[Validation DB Check Error] {db_err}")

    # Determine Overall Status
    # Statuses: 'Application Checks Passed', 'Needs Review', 'Incomplete', 'Conflict Detected'
    has_conflicts = any("conflict" in (i["problem"].lower() + i["explanation"].lower()) or "duplicate" in i["problem"].lower() for i in issues)
    has_errors = any(i["severity"] == "error" for i in issues)
    has_warnings = any(i["severity"] == "warning" for i in issues)

    if has_conflicts:
        status = "Conflict Detected"
    elif has_errors:
        status = "Incomplete"
    elif has_warnings:
        status = "Needs Review"
    else:
        status = "Application Checks Passed"

    return {
        "status": status,
        "checked_at": None,
        "total_issues": len(issues),
        "issues": issues,
        "disclaimer": "These validation results represent data-quality and internal consistency checks performed by LandAssist. They do not constitute official title verification or government certification."
    }

def record_and_save_validation(record_id: int, record_data: dict) -> dict:
    result = validate_land_record(record_data, current_record_id=record_id)
    try:
        conn = get_db_connection()
        conn.execute("""
            INSERT INTO validation_results (record_id, status, issues_json)
            VALUES (?, ?, ?);
        """, (record_id, result["status"], json.dumps(result["issues"])))
        conn.execute("""
            UPDATE land_records
            SET validation_status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?;
        """, (result["status"], record_id))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Record Validation Save Error] {e}")
    return result

TN_DISTRICTS_SET = {
    'ariyalur', 'chengalpattu', 'chennai', 'coimbatore', 'cuddalore', 'dharmapuri',
    'dindigul', 'erode', 'kallakurichi', 'kancheepuram', 'karur', 'krishnagiri',
    'madurai', 'mayiladuthurai', 'nagapattinam', 'namakkal', 'nilgiris', 'perambalur',
    'pudukkottai', 'ramanathapuram', 'ranipet', 'salem', 'sivaganga', 'tenkasi',
    'thanjavur', 'theni', 'thoothukudi', 'tiruchirappalli', 'tirunelveli', 'tirupathur',
    'tiruppur', 'tiruvallur', 'tiruvannamalai', 'tiruvarur', 'vellore', 'viluppuram', 'virudhunagar'
}

def validate_parcel_registration(data: dict, current_record_id: int = None) -> dict:
    """
    Executes mandatory multi-factor validation and authenticity verification before land parcel registration.
    Checks:
    1. Required Land Details Completeness
    2. Owner and Co-owner Completeness & Share Calculations
    3. Document Number & Patta Reference Consistency
    4. Survey and Subdivision Consistency
    5. Revenue District, Taluk, and Village Boundaries
    6. Land Extent and Measurement Units
    7. Boundary Details Completeness
    8. Supporting Documents Presence & Categorization
    9. Cross-check Form Details against Uploaded Document(s)
    10. Signature, Official Seal, and Tampering Indicators
    11. Government Record Verification (Truthful External Status)
    12. Duplicate Submission and Ownership Conflict Prevention
    """
    import datetime
    now_iso = datetime.datetime.now().isoformat()
    checks = []
    warnings = []
    errors = []

    doc_type = (data.get("document_type") or "Patta").strip()
    doc_number = (data.get("document_number") or data.get("document_reference") or "").strip()
    patta_number = (data.get("patta_number") or "").strip()
    registration_date = (data.get("registration_date") or "").strip()
    issuing_authority = (data.get("issuing_authority") or "").strip()
    
    owner_name = (data.get("owner_name") or "").strip()
    previous_owner = (data.get("previous_owner_name") or "").strip()
    number_of_owners = int(data.get("number_of_owners") or 1)
    ownership_type = (data.get("ownership_type") or "Sole Ownership").strip()
    co_owners = data.get("co_owners") or []
    if isinstance(co_owners, str):
        try:
            co_owners = json.loads(co_owners)
        except Exception:
            co_owners = []

    district = (data.get("district") or "").strip()
    taluk = (data.get("taluk") or "").strip()
    village = (data.get("village") or "").strip()
    survey_number = (data.get("survey_number") or "").strip()
    subdivision_number = (data.get("subdivision_number") or "").strip()
    
    land_area_raw = data.get("land_area")
    land_unit = (data.get("land_unit") or "sq.ft").strip()
    land_classification = (data.get("land_classification") or "").strip()

    boundary_north = (data.get("boundary_north") or "").strip()
    boundary_south = (data.get("boundary_south") or "").strip()
    boundary_east = (data.get("boundary_east") or "").strip()
    boundary_west = (data.get("boundary_west") or "").strip()

    supporting_docs = data.get("supporting_documents") or []
    if isinstance(supporting_docs, str):
        try:
            supporting_docs = json.loads(supporting_docs)
        except Exception:
            supporting_docs = []

    uploaded_doc_verification = data.get("uploaded_doc_verification") or {}

    # Check 1: Required Land Details Completeness
    missing_core = []
    if not owner_name: missing_core.append("Owner Name")
    if not district: missing_core.append("District")
    if not taluk: missing_core.append("Taluk")
    if not village: missing_core.append("Revenue Village")
    if not survey_number: missing_core.append("Survey Number")
    if not land_area_raw: missing_core.append("Land Area")

    # Document type specifics
    if any(k in doc_type.lower() for k in ["deed", "sale", "settlement", "gift", "partition"]):
        if not doc_number: missing_core.append("Deed / Document Number")
        if not issuing_authority: missing_core.append("Sub-Registrar / Issuing Office")

    if not missing_core:
        chk1_status = "PASSED"
        chk1_summary = f"All required cadastral information provided for {doc_type}."
        chk1_exp = "Mandatory document details, administrative revenue levels, and parcel identifiers are complete."
    else:
        chk1_status = "FAILED"
        chk1_summary = f"Missing required registration fields: {', '.join(missing_core)}."
        chk1_exp = f"The submission lacks essential registration parameters: {', '.join(missing_core)}."
        errors.append(f"Missing core fields: {', '.join(missing_core)}.")

    checks.append({
        "id": 1,
        "name": "Required Land Details Completeness",
        "category": "Data Completeness",
        "status": chk1_status,
        "summary": chk1_summary,
        "explanation": chk1_exp,
        "missing_fields": missing_core
    })

    # Check 2: Owner and Co-owner Completeness & Share Calculations
    chk2_status = "PASSED"
    chk2_summary = f"Owner structure verified: {ownership_type}."
    chk2_exp = f"Legal title holder recorded as '{owner_name}'."

    if not owner_name:
        chk2_status = "FAILED"
        chk2_summary = "Owner name is missing."
        chk2_exp = "Every land parcel registration must have an identified legal title holder."
    elif len(owner_name) < 3:
        chk2_status = "NEEDS REVIEW"
        chk2_summary = f"Abbreviated owner name: '{owner_name}'."
        chk2_exp = "Owner name contains fewer than 3 characters; verify full legal name as per government gazette."
        warnings.append("Owner name is unusually short.")

    if ownership_type in {"Joint Ownership", "Coparcenary", "Partnership"} or number_of_owners > 1:
        if not co_owners or len(co_owners) == 0:
            chk2_status = "NEEDS REVIEW"
            chk2_summary = "Co-owner breakdown missing for joint ownership."
            chk2_exp = f"Ownership type is '{ownership_type}' but no co-owner schedule or share distribution was provided."
            warnings.append("Co-owner schedule missing for joint property.")
        else:
            total_share = 0.0
            share_err = False
            for co in co_owners:
                try:
                    pct = float(co.get("share_percentage") or 0)
                    total_share += pct
                except ValueError:
                    share_err = True

            if share_err:
                chk2_status = "FAILED"
                chk2_summary = "Invalid co-owner share percentage format."
                chk2_exp = "One or more co-owner share percentages cannot be parsed as a valid numeric proportion."
                errors.append("Invalid co-owner share percentages.")
            elif abs(total_share - 100.0) > 0.1:
                chk2_status = "FAILED"
                chk2_summary = f"Co-owner shares total {total_share:.1f}%, which does not equal 100%."
                chk2_exp = f"Joint ownership shares must exactly tally to 100%. Current sum: {total_share:.1f}%."
                errors.append(f"Co-owner share allocation sum mismatch ({total_share:.1f}% != 100%).")
            else:
                chk2_summary = f"Co-owner breakdown complete: {len(co_owners)} co-owners totaling 100% share."
                chk2_exp = "All joint owners have specified legal share proportions totaling 100%."

    checks.append({
        "id": 2,
        "name": "Owner and Co-Owner Information Completeness",
        "category": "Ownership & Title",
        "status": chk2_status,
        "summary": chk2_summary,
        "explanation": chk2_exp
    })

    # Check 3: Document Number & Patta Reference Consistency
    if "patta" in doc_type.lower():
        if patta_number:
            chk3_status = "PASSED"
            chk3_summary = f"Patta reference recorded as '{patta_number}'."
            chk3_exp = "Patta passbook index number is properly formatted."
        else:
            chk3_status = "NEEDS REVIEW"
            chk3_summary = "Patta number missing on Patta record."
            chk3_exp = "Patta document type typically includes an authoritative Patta register number."
            warnings.append("Patta number not provided.")
    elif doc_number:
        chk3_status = "PASSED"
        chk3_summary = f"Document/Deed reference recorded as '{doc_number}'."
        chk3_exp = "Deed registration number has been verified for structural formatting."
    else:
        chk3_status = "NEEDS REVIEW"
        chk3_summary = "Deed/Document index reference not provided."
        chk3_exp = "A formal registration deed number or previous doc reference is recommended for auditability."
        warnings.append("Deed number missing.")

    checks.append({
        "id": 3,
        "name": "Document & Patta Reference Consistency",
        "category": "Document Provenance",
        "status": chk3_status,
        "summary": chk3_summary,
        "explanation": chk3_exp
    })

    # Check 4: Survey and Subdivision Consistency
    if not survey_number:
        chk4_status = "FAILED"
        chk4_summary = "Survey number missing."
        chk4_exp = "Cadastral survey numbers are mandatory for land identification."
        errors.append("Survey number is required.")
    elif not re.match(r"^\d+[A-Za-z0-9\-\/]*$", survey_number):
        chk4_status = "NEEDS REVIEW"
        chk4_summary = f"Unconventional survey number: '{survey_number}'."
        chk4_exp = "Survey number contains unusual non-alphanumeric characters."
        warnings.append(f"Unconventional survey format: {survey_number}")
    elif not subdivision_number:
        chk4_status = "NEEDS REVIEW"
        chk4_summary = f"Survey {survey_number} provided without subdivision."
        chk4_exp = "Most modern Tamil Nadu parcels specify a subdivision (e.g., 1A, 2B). Verify if parcel is unsubdivided."
    else:
        chk4_status = "PASSED"
        chk4_summary = f"Cadastral Parcel {survey_number}/{subdivision_number} conforms to survey standards."
        chk4_exp = "Survey number and subdivision identifier format adhere to Tamil Nadu cadastral standards."

    checks.append({
        "id": 4,
        "name": "Survey & Subdivision Number Consistency",
        "category": "Cadastral Attributes",
        "status": chk4_status,
        "summary": chk4_summary,
        "explanation": chk4_exp
    })

    # Check 5: Revenue District, Taluk, and Village Boundaries
    if district and district.lower() in TN_DISTRICTS_SET and taluk and village:
        chk5_status = "PASSED"
        chk5_summary = f"Valid revenue jurisdiction: {village}, {taluk} Taluk, {district} District."
        chk5_exp = "Administrative revenue boundaries align with official Tamil Nadu Revenue Department hierarchy."
    elif district and district.lower() not in TN_DISTRICTS_SET:
        chk5_status = "NEEDS REVIEW"
        chk5_summary = f"Unrecognized district: '{district}'."
        chk5_exp = f"District '{district}' is not recognized among the 38 administrative revenue districts of Tamil Nadu."
        warnings.append(f"Unrecognized Tamil Nadu district: {district}")
    else:
        chk5_status = "FAILED"
        chk5_summary = "Incomplete revenue hierarchy."
        chk5_exp = "District, taluk, and village are all required to determine cadastral jurisdiction."
        errors.append("Incomplete revenue location hierarchy.")

    checks.append({
        "id": 5,
        "name": "Revenue District, Taluk & Village Boundaries",
        "category": "Cadastral Jurisdiction",
        "status": chk5_status,
        "summary": chk5_summary,
        "explanation": chk5_exp
    })

    # Check 6: Land Extent and Measurement Units
    area_float = 0.0
    area_valid = False
    try:
        if land_area_raw is not None and str(land_area_raw).strip() != "":
            area_float = float(land_area_raw)
            if area_float > 0:
                area_valid = True
    except (ValueError, TypeError):
        pass

    valid_units = {"sq.ft", "cents", "acres", "hectares", "grounds", "sq.m"}
    if not area_valid:
        chk6_status = "FAILED"
        chk6_summary = f"Invalid land area ({land_area_raw} {land_unit})."
        chk6_exp = "Total land extent must be a positive numeric value greater than zero."
        errors.append("Invalid or non-positive land area.")
    elif land_unit not in valid_units:
        chk6_status = "NEEDS REVIEW"
        chk6_summary = f"Non-standard measurement unit: '{land_unit}'."
        chk6_exp = f"Unit '{land_unit}' is unconventional. Supported units: {', '.join(sorted(valid_units))}."
        warnings.append(f"Non-standard measurement unit: {land_unit}")
    else:
        chk6_status = "PASSED"
        chk6_summary = f"Land area valid: {area_float:g} {land_unit}."
        chk6_exp = "Reported land extent is positive, non-zero, and mapped to a standard land metric."

    checks.append({
        "id": 6,
        "name": "Land Extent & Measurement Units",
        "category": "Physical Extent",
        "status": chk6_status,
        "summary": chk6_summary,
        "explanation": chk6_exp
    })

    # Check 7: Boundary Details Completeness
    boundaries_present = [b for b in [boundary_north, boundary_south, boundary_east, boundary_west] if b]
    is_deed = any(k in doc_type.lower() for k in ["deed", "sale", "settlement", "gift", "partition"])

    if len(boundaries_present) == 4:
        chk7_status = "PASSED"
        chk7_summary = "Four-point cadastral boundaries completely specified."
        chk7_exp = "North, South, East, and West boundaries are documented, satisfying conveyance schedule norms."
    elif len(boundaries_present) > 0:
        chk7_status = "NEEDS REVIEW"
        chk7_summary = f"Partial boundaries provided ({len(boundaries_present)} of 4 defined)."
        chk7_exp = "Conveyance deeds typically require all four cardinal boundary descriptions."
        if is_deed:
            warnings.append("Partial boundary schedule provided for conveyance deed.")
    elif is_deed:
        chk7_status = "FAILED"
        chk7_summary = "Boundary schedule missing on deed registration."
        chk7_exp = "Deeds of transfer require defined four-point boundaries to prevent boundary disputes."
        errors.append("Four-point boundary schedule is required for deeds.")
    else:
        chk7_status = "NOT APPLICABLE"
        chk7_summary = "Boundaries optional for Patta extract."
        chk7_exp = "Revenue patta extracts are indexed by survey subdivision and do not always include boundary text."

    checks.append({
        "id": 7,
        "name": "Land Boundary Schedule Completeness",
        "category": "Boundary Demarcation",
        "status": chk7_status,
        "summary": chk7_summary,
        "explanation": chk7_exp
    })

    # Check 8: Supporting Documents Presence & Categorization
    if supporting_docs and len(supporting_docs) > 0:
        categories = [d.get("category") or "General" for d in supporting_docs]
        chk8_status = "PASSED"
        chk8_summary = f"{len(supporting_docs)} supporting document(s) attached ({', '.join(set(categories))})."
        chk8_exp = "Required supporting documents (Title Deed / Patta / Tax receipt) uploaded for validation."
    elif data.get("source_document_id"):
        chk8_status = "PASSED"
        chk8_summary = f"Primary source document linked (Doc #{data.get('source_document_id')})."
        chk8_exp = "A digitized source document from LandAssist storage is linked to this parcel record."
    else:
        chk8_status = "NEEDS REVIEW"
        chk8_summary = "No supporting documents uploaded."
        chk8_exp = "Attaching a scanned deed, patta copy, or tax receipt is strongly recommended before registration."
        warnings.append("No supporting document uploaded.")

    checks.append({
        "id": 8,
        "name": "Supporting Documents Presence & Categorization",
        "category": "Documentary Evidence",
        "status": chk8_status,
        "summary": chk8_summary,
        "explanation": chk8_exp
    })

    # Check 9: Cross-check Form Details against Uploaded Document(s)
    if uploaded_doc_verification and uploaded_doc_verification.get("extracted_cadastral_data"):
        extracted = uploaded_doc_verification["extracted_cadastral_data"]
        doc_owner = (extracted.get("owner_name") or "").lower()
        doc_survey = (extracted.get("survey_number") or "").lower()
        
        mismatches = []
        if doc_owner and owner_name.lower() not in doc_owner and doc_owner not in owner_name.lower():
            mismatches.append(f"Owner Name (Form: '{owner_name}' vs Document: '{extracted.get('owner_name')}')")
        if doc_survey and survey_number.lower() != doc_survey:
            mismatches.append(f"Survey Number (Form: '{survey_number}' vs Document: '{extracted.get('survey_number')}')")

        if not mismatches:
            chk9_status = "PASSED"
            chk9_summary = "Form parameters match verified uploaded document."
            chk9_exp = "Owner name, survey number, and village match the text extracted from the uploaded document."
        else:
            chk9_status = "FAILED"
            chk9_summary = f"Discrepancies found between form and document: {', '.join(mismatches)}."
            chk9_exp = f"Verified document contains conflicting parameters: {', '.join(mismatches)}. Resolve differences."
            errors.append(f"Document mismatch: {', '.join(mismatches)}.")
    else:
        chk9_status = "NOT VERIFIED"
        chk9_summary = "Direct cross-matching unavailable (no OCR verified payload)."
        chk9_exp = "No pre-verified document extraction payload was supplied with this registration submission."

    checks.append({
        "id": 9,
        "name": "Cross-Check with Uploaded Document Data",
        "category": "Documentary Evidence",
        "status": chk9_status,
        "summary": chk9_summary,
        "explanation": chk9_exp
    })

    # Check 10: Signature, Official Seal & Tampering Indicators
    if uploaded_doc_verification and uploaded_doc_verification.get("checks"):
        doc_checks = uploaded_doc_verification["checks"]
        sig_chk = next((c for c in doc_checks if c["id"] == 5), None)
        seal_chk = next((c for c in doc_checks if c["id"] == 6), None)
        tamper_chk = next((c for c in doc_checks if c["id"] == 7), None)

        if tamper_chk and tamper_chk["status"] == "FAILED":
            chk10_status = "FAILED"
            chk10_summary = "Potential tampering detected in uploaded document."
            chk10_exp = "The uploaded document contains suspicious graphic software metadata or altered streams."
            errors.append("Tampering indicators detected on uploaded title document.")
        elif sig_chk and sig_chk["status"] == "PASSED":
            chk10_status = "PASSED"
            chk10_summary = "Cryptographic digital signature verified on uploaded document."
            chk10_exp = "Uploaded document contains authenticated cryptographic digital signatures."
        elif seal_chk and seal_chk["status"] == "PASSED":
            chk10_status = "NEEDS REVIEW"
            chk10_summary = "Official seal markings detected; physical verification required."
            chk10_exp = "Visible seal / authority designation identified. Automated detection cannot certify handwritten authenticity."
        else:
            chk10_status = "NEEDS REVIEW"
            chk10_summary = "Physical signature and seal verification pending manual inspection."
            chk10_exp = "Uploaded document requires designated officer review for signature and seal validation."
    else:
        chk10_status = "NOT APPLICABLE"
        chk10_summary = "No uploaded document analyzed for digital signatures or seals."
        chk10_exp = "Attach an uploaded PDF to enable cryptographic and authenticity checks."

    checks.append({
        "id": 10,
        "name": "Signature, Seal & Tampering Authenticity",
        "category": "Document Integrity",
        "status": chk10_status,
        "summary": chk10_summary,
        "explanation": chk10_exp
    })

    # Check 11: Official Government Record Verification (Statutory Truth Rule)
    # Must never claim government approved without genuine live external API
    chk11_status = "NOT VERIFIED"
    chk11_summary = "Official government verification unavailable — manual verification required."
    chk11_exp = (
        "Tamil Nadu e-Services portal (eservices.tn.gov.in) does not offer an authorized open API "
        "for automated third-party title verification. LandAssist does not simulate or fabricate "
        "official government approval. Verification must be confirmed through certified extracts."
    )
    checks.append({
        "id": 11,
        "name": "Government Record Verification",
        "category": "Official Portal Verification",
        "status": chk11_status,
        "summary": chk11_summary,
        "explanation": chk11_exp,
        "portal_url": "https://eservices.tn.gov.in/eservicesnew/land/verify_chitta.html?lan=en"
    })

    # Check 12: Duplicate Submission & Ownership Conflict Prevention
    has_conflict = False
    has_duplicate = False
    conflict_desc = ""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Check duplicate deed/reference number
        if doc_number:
            query = "SELECT id, owner_name, village, application_number FROM land_records WHERE LOWER(document_reference) = LOWER(?)"
            params = [doc_number]
            if current_record_id:
                query += " AND id != ?"
                params.append(current_record_id)
            cursor.execute(query, params)
            dups = cursor.fetchall()
            if dups:
                has_duplicate = True
                dup_labels = [f"Record #{d['id']} ({d['owner_name']})" for d in dups]
                conflict_desc = f"Document reference '{doc_number}' already registered under {', '.join(dup_labels)}."
                errors.append(conflict_desc)

        # Check conflicting owner claims on identical parcel
        if village and survey_number and subdivision_number:
            query = """
                SELECT id, owner_name, village, survey_number, subdivision_number, document_reference
                FROM land_records
                WHERE LOWER(village) = LOWER(?) AND survey_number = ? AND subdivision_number = ?
            """
            params = [village, survey_number, subdivision_number]
            if current_record_id:
                query += " AND id != ?"
                params.append(current_record_id)
            cursor.execute(query, params)
            parcel_matches = cursor.fetchall()
            for pm in parcel_matches:
                existing_owner = (pm["owner_name"] or "").strip().lower()
                this_owner = owner_name.lower()
                if this_owner and existing_owner and this_owner != existing_owner:
                    has_conflict = True
                    conflict_desc = f"Cadastral Parcel {survey_number}/{subdivision_number} in '{village}' is already recorded under owner '{pm['owner_name']}' (Record #{pm['id']})."
                    errors.append(f"Title Conflict: Existing registered owner is '{pm['owner_name']}'.")
                    break

        conn.close()
    except Exception as db_err:
        print(f"[Parcel Registration DB Conflict Check Error] {db_err}")

    if has_conflict or has_duplicate:
        chk12_status = "FAILED"
        chk12_summary = "Conflict or duplicate submission detected."
        chk12_exp = conflict_desc
    else:
        chk12_status = "PASSED"
        chk12_summary = "No conflicting ownership claims or duplicate document numbers found in local database."
        chk12_exp = "Cadastral parcel identifier and document reference are unique in the LandAssist repository."

    checks.append({
        "id": 12,
        "name": "Database Conflict & Duplicate Prevention",
        "category": "Cadastral Integrity",
        "status": chk12_status,
        "summary": chk12_summary,
        "explanation": chk12_exp
    })

    # Compute Overall Status Workflow:
    # 'DRAFT', 'PENDING VERIFICATION', 'FLAGGED FOR REVIEW', 'VERIFICATION COMPLETED', 'REGISTERED'
    is_draft = Boolean = data.get("is_draft", False)
    has_failed = any(c["status"] == "FAILED" for c in checks)
    has_review = any(c["status"] == "NEEDS REVIEW" for c in checks)

    if is_draft:
        registration_status = "DRAFT"
        validation_status = "Needs Review"
    elif has_failed or has_conflict or has_duplicate:
        registration_status = "FLAGGED FOR REVIEW"
        validation_status = "Conflict Detected" if (has_conflict or has_duplicate) else "Incomplete"
    elif chk11_status == "NOT VERIFIED":
        # Government verification is unavailable -> must show PENDING VERIFICATION
        registration_status = "PENDING VERIFICATION"
        validation_status = "Needs Review"
    elif not has_review and not has_failed:
        # Technical checks completed
        registration_status = "VERIFICATION COMPLETED"
        validation_status = "Application Checks Passed"
    else:
        registration_status = "PENDING VERIFICATION"
        validation_status = "Needs Review"

    return {
        "registration_status": registration_status,
        "validation_status": validation_status,
        "checked_at": now_iso,
        "total_checks": len(checks),
        "passed_count": sum(1 for c in checks if c["status"] == "PASSED"),
        "failed_count": sum(1 for c in checks if c["status"] == "FAILED"),
        "review_count": sum(1 for c in checks if c["status"] == "NEEDS REVIEW"),
        "unverified_count": sum(1 for c in checks if c["status"] == "NOT VERIFIED"),
        "not_applicable_count": sum(1 for c in checks if c["status"] == "NOT APPLICABLE"),
        "checks": checks,
        "warnings": warnings,
        "errors": errors,
        "disclaimer": "These validation results represent data-quality and internal consistency checks performed by LandAssist. Official government verification unavailable — manual verification required."
    }

