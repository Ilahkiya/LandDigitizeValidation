import io
import json
import os
import sys
from pathlib import Path
from PIL import Image
import fitz

# Ensure backend in path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app import create_app
from config import Config
from db import init_db

print("=== STARTING AUTHENTICITY VERIFICATION SYSTEM E2E CHECK ===")

app = create_app(Config)
client = app.test_client()

# 1. Login as owner
login_res = client.post("/api/auth/login", json={
    "email": "owner@landassist.local",
    "password": "OwnerPass123!"
})
assert login_res.status_code == 200, f"Login failed: {login_res.data}"
print("[PASS] Logged in as Property Owner.")

# 2. Test Genuine Land Record without Title Conflict (Matching registered owner "Rajesh Kumar")
doc = fitz.open()
page = doc.new_page()
patta_text = """
GOVERNMENT OF TAMIL NADU - REVENUE DEPARTMENT
Taluk Office: Coimbatore North Taluk
RURAL LAND RECORD - EXTRACT FROM PATTA / CHITTA REGISTER
Anytime / Anywhere Services (eservices.tn.gov.in)

1. Revenue District: Coimbatore
2. Revenue Taluk: Coimbatore North
3. Revenue Village: Saravanampatti
4. Patta Number: 49120
5. Pattadhar (Owner) Name: Rajesh Kumar
6. Cadastral Survey Number: 142/3A
7. Subdivision Number: 3A
8. Land Extent: 2400 sq.ft
9. Document Reference: PATTA-2024-49120-TN

Endorsement:
Digital record certified by Headquarters Deputy Tahsildar.
Official Seal of Taluk Office, Coimbatore North.
Sd/- Tahsildar
"""
page.insert_text((50, 72), patta_text, fontsize=10)
doc.set_metadata({
    "producer": "Government of Tamil Nadu - e-Services PDF Engine v3.2",
    "creator": "Revenue Administration Information System"
})
pdf_bytes = doc.tobytes()
doc.close()

verify_res = client.post(
    "/api/documents/verify",
    data={"file": (io.BytesIO(pdf_bytes), "tn_patta_extract_49120.pdf")},
    content_type="multipart/form-data"
)
assert verify_res.status_code == 200, f"Verification failed: {verify_res.data}"
res_json = verify_res.get_json()
verification = res_json["verification"]
document = res_json["document"]

print(f"[PASS] Document uploaded and verified.")
print(f"       Verification Ref ID: {verification['verification_ref']}")
print(f"       Document Type:       {verification['document_type']}")
print(f"       Overall Status:      {verification['overall_status']}")
print(f"       Recommended Action:  {verification['recommended_action']}")

# Check 8 Individual Checks
checks = verification["checks"]
assert len(checks) == 8, f"Expected 8 checks, got {len(checks)}"
print("\n--- Summary of 8 Individual Checks for Clean Record ---")
for chk in checks:
    print(f"  Check #{chk['id']}: [{chk['status']}] {chk['name']}")
    print(f"     Summary: {chk['summary']}")

# Verify check 8 statement
chk8 = next(c for c in checks if c["id"] == 8)
assert "Official government verification unavailable" in chk8["summary"]
assert chk8["status"] == "NOT VERIFIED"
print("[PASS] Check 8 correctly displays official government verification unavailability notice.")

# Overall status must be PENDING MANUAL VERIFICATION (not falsely claiming official government certification)
assert verification["overall_status"] == "PENDING MANUAL VERIFICATION"
print("[PASS] Overall status correctly assigned as PENDING MANUAL VERIFICATION.")

# 3. Test Conflict Detection: Conflicting Owner Claim on same parcel 142/3A
conflict_doc = fitz.open()
c_page = conflict_doc.new_page()
conflict_text = """
GOVERNMENT OF TAMIL NADU - REVENUE DEPARTMENT
Taluk Office: Coimbatore North Taluk
Village: Saravanampatti
Survey No: 142/3A
District: Coimbatore
Taluk: Coimbatore North
Extent: 2400 sq.ft
Owner Name: Unknown Competing Claimant
Document Reference: DOC-COMPETING-CLAIM-001
Official Seal of Tahsildar
Sd/- Tahsildar
"""
c_page.insert_text((50, 72), conflict_text, fontsize=10)
conflict_bytes = conflict_doc.tobytes()
conflict_doc.close()

conflict_res = client.post(
    "/api/documents/verify",
    data={"file": (io.BytesIO(conflict_bytes), "competing_claim.pdf")},
    content_type="multipart/form-data"
)
assert conflict_res.status_code == 200
conflict_json = conflict_res.get_json()["verification"]
assert conflict_json["overall_status"] == "FLAGGED FOR REVIEW"
chk2 = next(c for c in conflict_json["checks"] if c["id"] == 2)
assert chk2["status"] == "FAILED"
assert "Conflicting title ownership detected" in chk2["summary"]
print("[PASS] Conflicting owner claim on registered parcel correctly identified and FLAGGED FOR REVIEW (Check 2 FAILED).")

# 4. Test Stored Verification Retrieval from SQLite
doc_id = document["id"]
fetch_res = client.get(f"/api/documents/{doc_id}/verification")
assert fetch_res.status_code == 200
assert fetch_res.get_json()["verification_ref"] == verification["verification_ref"]
print(f"[PASS] Stored verification retrieved successfully from database for document #{doc_id}.")

# 5. Test Tampered Document Detection (Photoshop in metadata)
tampered_doc = fitz.open()
p2 = tampered_doc.new_page()
p2.insert_text((50, 72), "Altered Land Agreement - Changed Owner Name", fontsize=10)
tampered_doc.set_metadata({
    "producer": "Adobe Photoshop 2024 (Windows)",
    "creator": "Photoshop PDF Export"
})
tampered_bytes = tampered_doc.tobytes()
tampered_doc.close()

tamper_res = client.post(
    "/api/documents/verify",
    data={"file": (io.BytesIO(tampered_bytes), "altered_deed.pdf")},
    content_type="multipart/form-data"
)
assert tamper_res.status_code == 200
tamper_json = tamper_res.get_json()["verification"]
assert tamper_json["overall_status"] == "FLAGGED FOR REVIEW"
chk7 = next(c for c in tamper_json["checks"] if c["id"] == 7)
assert chk7["status"] == "FAILED"
print("[PASS] Tampered document with Photoshop metadata correctly FLAGGED FOR REVIEW (Check 7 FAILED).")

# 6. Test Invalid File Content Rejection (Binary header mismatch)
bad_res = client.post(
    "/api/documents/verify",
    data={"file": (io.BytesIO(b"FAKE_PDF_HEADER_NOT_VALID"), "fake.pdf")},
    content_type="multipart/form-data"
)
assert bad_res.status_code == 400
print(f"[PASS] Invalid binary content correctly rejected with status 400: '{bad_res.get_json()['error']}'.")

print("\n=== ALL E2E VERIFICATION CHECKS SUCCEEDED WITH 100% COMPLIANCE ===")
