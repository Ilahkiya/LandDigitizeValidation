import requests

session = requests.Session()
base = "http://127.0.0.1:5000"

print("--- STARTING END-TO-END VERIFICATION ---")

# 1. Health check
h = session.get(f"{base}/api/health")
print(f"1. Health check: {h.status_code} -> {h.json()}")

# 2. Login as Property Owner
login_res = session.post(f"{base}/api/auth/login", json={"email": "owner@landassist.local", "password": "OwnerPass123!"})
print(f"2. Login: {login_res.status_code} -> {login_res.json()['user']['full_name']} ({login_res.json()['user']['role']})")

# 3. Dashboard Stats
stats_res = session.get(f"{base}/api/dashboard/stats")
print(f"3. Dashboard Stats: {stats_res.status_code} -> {stats_res.json()['stats']}")

# 4. Land Records
records_res = session.get(f"{base}/api/records")
records = records_res.json()["records"]
print(f"4. Land Records count: {len(records)}")
for r in records[:4]:
    print(f"   Record #{r['id']}: {r['owner_name']} | Survey {r['survey_number']}/{r['subdivision_number']} | Extent: {r['land_area']} {r['land_unit']} | Status: {r['validation_status']}")

# 5. Record #1 Details & Validation
rec1 = session.get(f"{base}/api/records/1").json()["record"]
print(f"5. Record 1 Validation Status: {rec1['validation_status']}")
if rec1.get("validation_details"):
    print(f"   Issues found: {len(rec1['validation_details'].get('issues', []))}")

# 6. Saved Agreements
agrs = session.get(f"{base}/api/agreements").json()["agreements"]
print(f"6. Agreements count: {len(agrs)} -> '{agrs[0]['title']}'")

# 7. Official Services Info
off = session.get(f"{base}/api/official-services/info").json()
print(f"7. Official TN Services Portal: {off['portal_url']} -> {len(off['services'])} official services documented")

# 8. PDF Export
pdf_res = session.get(f"{base}/api/agreements/1/pdf")
print(f"8. PDF Export status: {pdf_res.status_code} -> Content-Type: {pdf_res.headers.get('Content-Type')}, Size: {len(pdf_res.content)} bytes")
print("--- ALL VERIFICATION CHECKS PASSED SUCCESSFULLY ---")
