import os
import sys
import json
import io
import requests

BASE_URL = "http://127.0.0.1:5000"

def run_tests():
    print("=" * 70)
    print("LANDASSIST AI - 11 MANDATORY VERIFICATION TESTS")
    print("=" * 70)

    session = requests.Session()

    # Step 0: Login as demo owner
    login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": "owner@landassist.local",
        "password": "OwnerPass123!"
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    user_data = login_resp.json()["user"]
    print(f"Logged in as: {user_data.get('full_name', user_data.get('email'))} ({user_data['email']}, role: {user_data['role']})")

    # Fetch CSRF token
    csrf_resp = session.get(f"{BASE_URL}/api/auth/csrf-token")
    assert csrf_resp.status_code == 200, f"Failed to get CSRF token: {csrf_resp.text}"
    csrf_token = csrf_resp.json().get("csrf_token")
    session.headers.update({"X-CSRF-Token": csrf_token})
    print(f"CSRF Token obtained: {csrf_token[:12]}...")

    # ---------------------------------------------------------
    # TEST 1: Mobile number typed and saved as string correctly
    # ---------------------------------------------------------
    print("\n--- TEST 1: Mobile Number Input & Persistence ---")
    mobile_test_number = "+919876543210"
    payload_t1 = {
        "is_draft": True,
        "owner_name": "Test Owner Digits",
        "owner_mobile": mobile_test_number,
        "document_reference": "DOC-TEST-MOB-01",
        "district": "Coimbatore",
        "village": "Saravanampatti",
        "land_area": 1200
    }
    r1 = session.post(f"{BASE_URL}/api/records", json=payload_t1)
    assert r1.status_code in (200, 201), f"TEST 1 create failed: {r1.text}"
    rec_id_1 = r1.json()["record_id"]
    
    get_r1 = session.get(f"{BASE_URL}/api/records/{rec_id_1}")
    assert get_r1.status_code == 200, f"TEST 1 fetch failed: {get_r1.text}"
    saved_rec = get_r1.json()["record"]
    assert saved_rec["owner_mobile"] == mobile_test_number, f"Expected {mobile_test_number}, got {saved_rec['owner_mobile']}"
    assert isinstance(saved_rec["owner_mobile"], str), "Mobile must be stored as string"
    print(f"TEST 1 PASSED: Mobile number saved and retrieved as string: '{saved_rec['owner_mobile']}'")

    # ---------------------------------------------------------
    # TEST 2: Upload JPG passport-size photo (CSRF resolved)
    # ---------------------------------------------------------
    print("\n--- TEST 2: JPG Passport Photo Upload & CSRF Resolution ---")
    fake_jpg = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"fakejpgcontent" * 100)
    files_jpg = {
        "photo": ("passport_photo.jpg", fake_jpg, "image/jpeg")
    }
    r2 = session.post(f"{BASE_URL}/api/records/owner-photo", files=files_jpg, data={"csrf_token": csrf_token})
    assert r2.status_code == 201, f"TEST 2 failed with status {r2.status_code}: {r2.text}"
    jpg_res = r2.json()
    assert "photo_id" in jpg_res and "photo_url" in jpg_res, f"Unexpected response: {jpg_res}"
    photo_id_jpg = jpg_res["photo_id"]
    photo_url_jpg = jpg_res["photo_url"]
    print(f"TEST 2 PASSED: JPG photo uploaded without CSRF error! Photo ID: {photo_id_jpg}, URL: {photo_url_jpg}")

    # ---------------------------------------------------------
    # TEST 3: Upload PNG photo
    # ---------------------------------------------------------
    print("\n--- TEST 3: PNG Passport Photo Upload ---")
    fake_png = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"fakepngcontent" * 100)
    files_png = {
        "photo": ("passport_photo.png", fake_png, "image/png")
    }
    r3 = session.post(f"{BASE_URL}/api/records/owner-photo", files=files_png, data={"csrf_token": csrf_token})
    assert r3.status_code == 201, f"TEST 3 failed with status {r3.status_code}: {r3.text}"
    png_res = r3.json()
    assert "photo_id" in png_res and "photo_url" in png_res
    photo_id_png = png_res["photo_id"]
    photo_url_png = png_res["photo_url"]
    print(f"TEST 3 PASSED: PNG photo uploaded successfully! Photo ID: {photo_id_png}, URL: {photo_url_png}")

    # ---------------------------------------------------------
    # TEST 4: Fill only a few fields and Save as Draft
    # ---------------------------------------------------------
    print("\n--- TEST 4: Save Incomplete Form as Draft ---")
    draft_payload = {
        "is_draft": True,
        "registration_status": "DRAFT",
        "owner_name": "Ramanathan Incomplete Draft",
        "document_reference": "DRAFT-PARCEL-2026-X",
        "district": "Salem",
        "land_area": "" # incomplete land area
        # missing taluk, village, survey_number, etc.
    }
    r4 = session.post(f"{BASE_URL}/api/records", json=draft_payload)
    assert r4.status_code in (200, 201), f"TEST 4 failed: {r4.text}"
    draft_res = r4.json()
    draft_id = draft_res["record_id"]
    print(f"TEST 4 PASSED: Incomplete form saved as draft with ID: {draft_id}, status: {draft_res.get('registration_status')}")

    # ---------------------------------------------------------
    # TEST 5: Reopen saved draft and confirm data preserved
    # ---------------------------------------------------------
    print("\n--- TEST 5: Reopen Saved Draft & Confirm Data ---")
    r5 = session.get(f"{BASE_URL}/api/records/{draft_id}")
    assert r5.status_code == 200, f"TEST 5 get failed: {r5.text}"
    draft_record = r5.json()["record"]
    assert draft_record["is_draft"] == 1, "is_draft column must be 1"
    assert draft_record["registration_status"] == "DRAFT", f"Expected DRAFT status, got {draft_record['registration_status']}"
    assert draft_record["owner_name"] == "Ramanathan Incomplete Draft"
    assert draft_record["district"] == "Salem"
    assert draft_record["document_reference"] == "DRAFT-PARCEL-2026-X"
    print(f"TEST 5 PASSED: Reopened draft #{draft_id}. Preserved owner_name='{draft_record['owner_name']}', district='{draft_record['district']}', status='{draft_record['registration_status']}'")

    # ---------------------------------------------------------
    # TEST 6: Submit incomplete form via Validate and Save -> Field Errors
    # ---------------------------------------------------------
    print("\n--- TEST 6: Incomplete Form Validation Check ---")
    incomplete_submit = {
        "is_draft": False,
        "owner_name": "", # Missing required owner
        "district": "",   # Missing required district
        "village": "",    # Missing required village
        "survey_number": "",
        "land_area": ""
    }
    r6 = session.post(f"{BASE_URL}/api/records", json=incomplete_submit)
    assert r6.status_code == 400, f"TEST 6 expected 400 Bad Request, got {r6.status_code}: {r6.text}"
    err_json = r6.json()
    assert "error" in err_json
    print(f"TEST 6 PASSED: Backend rejected incomplete submission with: '{err_json['error']}'")

    # ---------------------------------------------------------
    # TEST 7: Complete all required fields and Submit
    # ---------------------------------------------------------
    print("\n--- TEST 7: Complete All Fields and Validate & Save ---")
    import uuid
    uniq = uuid.uuid4().hex[:4].upper()
    full_payload = {
        "is_draft": False,
        "registration_status": "Submitted for Review",
        "document_type": "Sale Deed",
        "document_reference": f"SLD-2026-CBE-{uniq}",
        "registration_date": "2026-03-15",
        "patta_number": f"PAT-2026-{uniq}",
        "issuing_authority": "Sub-Registrar Office, Gandhipuram, Coimbatore",
        "owner_name": "Senthil Nathan K",
        "ownership_type": "Sole Ownership",
        "owner_address": "77 Bharathi Street, Peelamedu, Coimbatore",
        "owner_mobile": "+919842156789",
        "owner_photo_id": photo_id_png,
        "owner_photo_url": photo_url_png,
        "district": "Coimbatore",
        "taluk": "Coimbatore North",
        "village": "Saravanampatti",
        "survey_number": f"9{uniq}",
        "subdivision_number": "1A",
        "land_area": 2400.0,
        "land_unit": "sq.ft",
        "land_classification": "Wetland (Nanjai)",
        "wetland_dryland": "Wetland (Nanjai)",
        "land_use_type": "Residential - Built-up House",
        "possession_status": "Self-Occupied / In Possession",
        "encumbrance_status": "Nil / No Encumbrance (Clean Title)",
        "boundary_north": "North Plot 12",
        "boundary_south": "South 30ft Road",
        "boundary_east": "East Survey 902",
        "boundary_west": "West Canal"
    }
    r7 = session.post(f"{BASE_URL}/api/records", json=full_payload)
    assert r7.status_code in (200, 201), f"TEST 7 submit failed: {r7.text}"
    submit_res = r7.json()
    reg_id_7 = submit_res["record_id"]
    reg_status_7 = submit_res["registration_status"]
    if reg_status_7 != "Submitted for Review":
        print("DEBUG failed checks:", [c for c in submit_res.get("validation", {}).get("checks", []) if c.get("status") == "FAILED"])
    assert reg_status_7 == "Submitted for Review", f"Expected 'Submitted for Review', got '{reg_status_7}'"
    print(f"TEST 7 PASSED: Completed record saved with ID: {reg_id_7}, status: '{reg_status_7}'")

    # ---------------------------------------------------------
    # TEST 8: Open Land Records Registry & Confirm Record Displayed
    # ---------------------------------------------------------
    print("\n--- TEST 8: Registry Listing & Counts Verification ---")
    r8 = session.get(f"{BASE_URL}/api/records")
    assert r8.status_code == 200, f"TEST 8 list failed: {r8.text}"
    list_data = r8.json()
    records = list_data["records"]
    counts = list_data["counts"]
    found_rec = next((r for r in records if r["id"] == reg_id_7), None)
    assert found_rec is not None, f"Record #{reg_id_7} not found in registry listing"
    assert found_rec["document_reference"] == full_payload["document_reference"]
    assert found_rec["registration_status"] == "Submitted for Review"
    assert found_rec["owner_mobile"] == "+919842156789"
    assert found_rec["owner_photo_url"] == photo_url_png
    assert counts["submitted"] >= 1, "Submitted count must be at least 1"
    assert counts["drafts"] >= 1, "Draft count must be at least 1"
    print(f"TEST 8 PASSED: Found record #{reg_id_7} in registry. Counts: {counts}")

    # ---------------------------------------------------------
    # TEST 9: Refresh Application / Persistence Check
    # ---------------------------------------------------------
    print("\n--- TEST 9: Refresh & Database Persistence Check ---")
    # New session to simulate page refresh / restart
    fresh_session = requests.Session()
    fresh_session.post(f"{BASE_URL}/api/auth/login", json={
        "email": "owner@landassist.local",
        "password": "OwnerPass123!"
    })
    r9 = fresh_session.get(f"{BASE_URL}/api/records/{reg_id_7}")
    assert r9.status_code == 200, f"TEST 9 fetch failed: {r9.text}"
    persisted = r9.json()["record"]
    assert persisted["id"] == reg_id_7
    assert persisted["owner_name"] == "Senthil Nathan K"
    assert persisted["registration_status"] == "Submitted for Review"
    assert persisted["is_draft"] == 0
    print(f"TEST 9 PASSED: Record #{reg_id_7} completely persisted across sessions with all fields intact.")

    # ---------------------------------------------------------
    # TEST 10: User Authorization Check (Access Restricted to Owner)
    # ---------------------------------------------------------
    print("\n--- TEST 10: Data Isolation & Authorization Check ---")
    other_session = requests.Session()
    other_login = other_session.post(f"{BASE_URL}/api/auth/login", json={
        "email": "reviewer@landassist.local",
        "password": "ReviewerPass123!"
    })
    assert other_login.status_code == 200, f"Reviewer login failed: {other_login.text}"
    
    # Attempt to access owner's record
    other_resp = other_session.get(f"{BASE_URL}/api/records/{reg_id_7}")
    assert other_resp.status_code == 403, f"Expected 403 Forbidden for unauthorized user, got {other_resp.status_code}"
    
    # Check listing does not leak owner's records
    other_list = other_session.get(f"{BASE_URL}/api/records")
    assert other_list.status_code == 200
    other_records = other_list.json()["records"]
    assert not any(r["id"] == reg_id_7 for r in other_records), "Cross-user record leaked in list!"
    print(f"TEST 10 PASSED: Record #{reg_id_7} returned 403 Forbidden for non-owner, and does not leak in list.")

    # ---------------------------------------------------------
    # TEST 11: Regression Check (Dashboard, Validation, Agreement)
    # ---------------------------------------------------------
    print("\n--- TEST 11: Dashboard, Validation, and Agreement Regression Tests ---")
    dash_r = session.get(f"{BASE_URL}/api/dashboard/stats")
    assert dash_r.status_code == 200, f"Dashboard failed: {dash_r.text}"
    dash_stats = dash_r.json()
    assert "stats" in dash_stats and "total_records" in dash_stats["stats"], f"Missing stats in {dash_stats}"
    print(f"[OK] Dashboard API operational: Total Records = {dash_stats['stats']['total_records']}, Docs = {dash_stats['stats']['total_documents']}")

    # Validation Engine check on new record
    val_r = session.post(f"{BASE_URL}/api/records/{reg_id_7}/validate")
    assert val_r.status_code == 200, f"Validation evaluation failed: {val_r.text}"
    val_data = val_r.json()
    assert "validation" in val_data
    print(f"[OK] Validation Engine evaluated record #{reg_id_7}: Status={val_data['validation'].get('validation_status')}, Checks={val_data['validation'].get('total_checks')}")

    # Agreement Generator template & drafts check
    ag_r = session.get(f"{BASE_URL}/api/agreements")
    assert ag_r.status_code == 200, f"Agreements list failed: {ag_r.text}"
    print(f"[OK] Agreement Generator API operational: {len(ag_r.json().get('agreements', []))} agreements found")

    print("\n" + "=" * 70)
    print("ALL 11 TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
