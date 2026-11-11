import sqlite3
import json
import os
from pathlib import Path
from werkzeug.security import generate_password_hash
from config import Config

def get_db_connection():
    db_path = Config.DATABASE_PATH
    try:
        from flask import current_app
        if current_app and "DATABASE_PATH" in current_app.config:
            db_path = current_app.config["DATABASE_PATH"]
    except Exception:
        pass

    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    conn = get_db_connection()
    cursor = conn.cursor()

    # Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner', 'reviewer', 'admin')),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
    );
    """)

    # Documents Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        original_filename TEXT NOT NULL,
        stored_filename TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        extraction_status TEXT DEFAULT 'pending',
        extracted_text TEXT,
        structured_data_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Document Verifications Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS document_verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        verification_ref TEXT UNIQUE NOT NULL,
        overall_status TEXT NOT NULL,
        report_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
    );
    """)

    # Land Records Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS land_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        application_number TEXT UNIQUE,
        registration_status TEXT DEFAULT 'PENDING VERIFICATION',
        owner_name TEXT NOT NULL,
        patta_number TEXT,
        survey_number TEXT,
        subdivision_number TEXT,
        district TEXT NOT NULL,
        taluk TEXT NOT NULL,
        village TEXT NOT NULL,
        land_area REAL NOT NULL,
        land_unit TEXT NOT NULL DEFAULT 'sq.ft',
        document_reference TEXT NOT NULL,
        document_type TEXT,
        registration_date TEXT,
        previous_doc_reference TEXT,
        issuing_authority TEXT,
        document_issue_date TEXT,
        previous_owner_name TEXT,
        number_of_owners INTEGER DEFAULT 1,
        ownership_type TEXT DEFAULT 'Sole Ownership',
        co_owners_json TEXT,
        owner_address TEXT,
        transfer_details TEXT,
        panchayat_local_body TEXT,
        plot_number TEXT,
        land_address TEXT,
        land_classification TEXT,
        wetland_dryland TEXT,
        land_use_type TEXT,
        possession_status TEXT,
        encumbrance_status TEXT,
        property_tax_reference TEXT,
        boundary_north TEXT,
        boundary_south TEXT,
        boundary_east TEXT,
        boundary_west TEXT,
        adjacent_survey_numbers TEXT,
        access_road_details TEXT,
        supporting_documents_json TEXT,
        comprehensive_verification_json TEXT,
        aadhaar_hash TEXT,
        aadhaar_masked TEXT,
        pan_hash TEXT,
        pan_masked TEXT,
        owner_photo_id INTEGER,
        owner_photo_url TEXT,
        owner_mobile TEXT,
        owner_mobile_verified INTEGER DEFAULT 0,
        mobile_verification_status TEXT DEFAULT 'Not Verified',
        source_document_id INTEGER,
        validation_status TEXT DEFAULT 'Needs Review',
        is_sample INTEGER DEFAULT 0,
        is_draft INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (source_document_id) REFERENCES documents (id) ON DELETE SET NULL,
        FOREIGN KEY (owner_photo_id) REFERENCES documents (id) ON DELETE SET NULL
    );
    """)

    # Safe migration for existing SQLite databases
    cursor.execute("PRAGMA table_info(land_records);")
    existing_cols = {col[1] for col in cursor.fetchall()}
    new_cols = [
        ("application_number", "TEXT"),
        ("registration_status", "TEXT DEFAULT 'PENDING VERIFICATION'"),
        ("document_type", "TEXT"),
        ("registration_date", "TEXT"),
        ("previous_doc_reference", "TEXT"),
        ("issuing_authority", "TEXT"),
        ("document_issue_date", "TEXT"),
        ("previous_owner_name", "TEXT"),
        ("number_of_owners", "INTEGER DEFAULT 1"),
        ("ownership_type", "TEXT DEFAULT 'Sole Ownership'"),
        ("co_owners_json", "TEXT"),
        ("owner_address", "TEXT"),
        ("transfer_details", "TEXT"),
        ("panchayat_local_body", "TEXT"),
        ("plot_number", "TEXT"),
        ("land_address", "TEXT"),
        ("land_classification", "TEXT"),
        ("wetland_dryland", "TEXT"),
        ("land_use_type", "TEXT"),
        ("possession_status", "TEXT"),
        ("encumbrance_status", "TEXT"),
        ("property_tax_reference", "TEXT"),
        ("boundary_north", "TEXT"),
        ("boundary_south", "TEXT"),
        ("boundary_east", "TEXT"),
        ("boundary_west", "TEXT"),
        ("adjacent_survey_numbers", "TEXT"),
        ("access_road_details", "TEXT"),
        ("supporting_documents_json", "TEXT"),
        ("comprehensive_verification_json", "TEXT"),
        ("aadhaar_hash", "TEXT"),
        ("aadhaar_masked", "TEXT"),
        ("pan_hash", "TEXT"),
        ("pan_masked", "TEXT"),
        ("owner_photo_id", "INTEGER"),
        ("owner_photo_url", "TEXT"),
        ("owner_mobile", "TEXT"),
        ("owner_mobile_verified", "INTEGER DEFAULT 0"),
        ("mobile_verification_status", "TEXT DEFAULT 'Not Verified'"),
        ("is_draft", "INTEGER DEFAULT 0")
    ]
    for col_name, col_type in new_cols:
        if col_name not in existing_cols:
            try:
                cursor.execute(f"ALTER TABLE land_records ADD COLUMN {col_name} {col_type};")
            except Exception as col_err:
                print(f"[Migration Note] Column {col_name}: {col_err}")

    # Mobile OTPs Table for Two-Factor Verification
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mobile_otps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mobile TEXT NOT NULL,
        otp_hash TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        attempts_left INTEGER DEFAULT 3,
        resend_count INTEGER DEFAULT 0,
        last_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Validation Results Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS validation_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        issues_json TEXT NOT NULL,
        checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (record_id) REFERENCES land_records (id) ON DELETE CASCADE
    );
    """)

    # Agreement Drafts Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS agreement_drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        agreement_type TEXT NOT NULL CHECK(agreement_type IN ('sale', 'rental', 'lease')),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        record_id INTEGER,
        party_first_details_json TEXT,
        party_second_details_json TEXT,
        agreement_terms_json TEXT,
        generation_mode TEXT DEFAULT 'template' CHECK(generation_mode IN ('ai', 'template')),
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'under_review', 'finalized')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (record_id) REFERENCES land_records (id) ON DELETE SET NULL
    );
    """)

    # Agreement Revisions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS agreement_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agreement_id INTEGER NOT NULL,
        revision_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        updated_by INTEGER NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agreement_id) REFERENCES agreement_drafts (id) ON DELETE CASCADE,
        FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Agreement Shares Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS agreement_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agreement_id INTEGER NOT NULL,
        shared_with_email TEXT NOT NULL,
        shared_with_user_id INTEGER,
        can_comment INTEGER DEFAULT 1,
        access_token TEXT UNIQUE,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'revoked')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agreement_id) REFERENCES agreement_drafts (id) ON DELETE CASCADE,
        FOREIGN KEY (shared_with_user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Reviewer Comments Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reviewer_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agreement_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        comment_text TEXT NOT NULL,
        section_ref TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agreement_id) REFERENCES agreement_drafts (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Audit Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id INTEGER,
        details TEXT,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    );
    """)

    # Indexes for fast lookup
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_land_records_user ON land_records(user_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_land_records_doc_ref ON land_records(document_reference);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_land_records_app_no ON land_records(application_number);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_land_records_reg_status ON land_records(registration_status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_verifications_doc ON document_verifications(document_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_verifications_ref ON document_verifications(verification_ref);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_agreements_user ON agreement_drafts(user_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);")

    conn.commit()
    seed_sample_data(conn)
    conn.close()

def seed_sample_data(conn):
    cursor = conn.cursor()

    # Check if sample users already exist
    cursor.execute("SELECT COUNT(*) FROM users WHERE email = 'admin@landassist.local';")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            INSERT INTO users (email, password_hash, full_name, role)
            VALUES (?, ?, ?, ?);
        """, (
            "admin@landassist.local",
            generate_password_hash("AdminPass123!"),
            "System Administrator",
            "admin"
        ))

    cursor.execute("SELECT COUNT(*) FROM users WHERE email = 'owner@landassist.local';")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            INSERT INTO users (email, password_hash, full_name, role)
            VALUES (?, ?, ?, ?);
        """, (
            "owner@landassist.local",
            generate_password_hash("OwnerPass123!"),
            "Property Owner Demo",
            "owner"
        ))

    cursor.execute("SELECT COUNT(*) FROM users WHERE email = 'reviewer@landassist.local';")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            INSERT INTO users (email, password_hash, full_name, role)
            VALUES (?, ?, ?, ?);
        """, (
            "reviewer@landassist.local",
            generate_password_hash("ReviewerPass123!"),
            "Legal Reviewer Demo",
            "reviewer"
        ))

    conn.commit()

    # Retrieve owner user id
    cursor.execute("SELECT id FROM users WHERE email = 'owner@landassist.local';")
    owner_row = cursor.fetchone()
    if not owner_row:
        return
    owner_id = owner_row[0]

    # Check if sample land records exist
    cursor.execute("SELECT COUNT(*) FROM land_records WHERE is_sample = 1;")
    if cursor.fetchone()[0] == 0:
        sample_records = [
            # 1. Complete Valid Record
            (
                owner_id,
                "Rajesh Kumar",
                "PAT-49120-TN",
                "142",
                "3A",
                "Coimbatore",
                "Coimbatore North",
                "Saravanampatti",
                2400.0,
                "sq.ft",
                "DOC-SAMPLE-2024-001",
                None,
                "Application Checks Passed",
                1
            ),
            # 2. Record with missing required information (missing subdivision and unformatted survey)
            (
                owner_id,
                "Anand V.",
                "PAT-10884-TN",
                "89",
                "",  # Missing subdivision
                "Chennai",
                "Mylapore",
                "Alwarpet",
                -150.0,  # Negative land area to trigger validation alert
                "sq.ft",
                "DOC-SAMPLE-2024-002",
                None,
                "Needs Review",
                1
            ),
            # 3 & 4. Two records with deliberately conflicting details (same survey number & village, but conflicting owner)
            (
                owner_id,
                "Kavitha Sundaram",
                "PAT-77219-TN",
                "210",
                "1B",
                "Madurai",
                "Madurai South",
                "Thiruparankundram",
                1800.0,
                "sq.ft",
                "DOC-SAMPLE-2024-003",
                None,
                "Conflict Detected",
                1
            ),
            (
                owner_id,
                "M. Selvaraj",  # Conflicting owner for same property survey 210/1B in Thiruparankundram
                "PAT-77220-TN",
                "210",
                "1B",
                "Madurai",
                "Madurai South",
                "Thiruparankundram",
                1800.0,
                "sq.ft",
                "DOC-SAMPLE-2024-004",
                None,
                "Conflict Detected",
                1
            ),
            # 5. Duplicate document reference for validation testing (duplicate of DOC-SAMPLE-2024-001)
            (
                owner_id,
                "Suresh Balaji",
                "PAT-99321-TN",
                "305",
                "2C",
                "Coimbatore",
                "Pollachi",
                "Anaimalai",
                3200.0,
                "sq.ft",
                "DOC-SAMPLE-2024-001",  # Deliberate duplicate document reference
                None,
                "Conflict Detected",
                1
            )
        ]

        cursor.executemany("""
            INSERT INTO land_records (
                user_id, owner_name, patta_number, survey_number, subdivision_number,
                district, taluk, village, land_area, land_unit, document_reference,
                source_document_id, validation_status, is_sample
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, sample_records)

        # Retrieve the inserted record IDs to populate initial validation results
        cursor.execute("SELECT id, owner_name, validation_status FROM land_records WHERE is_sample = 1;")
        inserted = cursor.fetchall()

        for rec in inserted:
            rec_id = rec[0]
            status = rec[2]
            issues = []
            if status == "Application Checks Passed":
                issues = []
            elif "002" in str(rec_id):
                issues = [
                    {
                        "field": "subdivision_number",
                        "severity": "warning",
                        "problem": "Missing subdivision number",
                        "explanation": "Survey parcels must specify a valid subdivision identifier.",
                        "suggested_correction": "Provide the registered subdivision code (e.g. 1A, 2B)."
                    },
                    {
                        "field": "land_area",
                        "severity": "error",
                        "problem": "Negative or zero land area",
                        "explanation": "Reported land parcel area is -150.0 sq.ft, which is physically invalid.",
                        "suggested_correction": "Input a positive numeric land area."
                    }
                ]
            else:
                issues = [
                    {
                        "field": "survey_number",
                        "severity": "error",
                        "problem": "Ownership or title conflict detected",
                        "explanation": "Survey 210/1B in Thiruparankundram is claimed by another registered record.",
                        "suggested_correction": "Verify deed title chain against official Tamil Nadu e-Services."
                    }
                ]

            cursor.execute("""
                INSERT INTO validation_results (record_id, status, issues_json)
                VALUES (?, ?, ?);
            """, (rec_id, status, json.dumps(issues)))

        # Also seed a sample agreement draft for owner
        cursor.execute("""
            INSERT INTO agreement_drafts (
                user_id, agreement_type, title, content, record_id,
                party_first_details_json, party_second_details_json, agreement_terms_json,
                generation_mode, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            owner_id,
            "sale",
            "Sale Agreement Draft - Saravanampatti Parcel",
            """AGREEMENT FOR SALE OF IMMOVABLE PROPERTY (DRAFT)

THIS AGREEMENT FOR SALE is made and entered into on this 14th day of October, 2026,

BETWEEN:
Mr. Rajesh Kumar, residing at No. 45, Green Avenue, Coimbatore, Tamil Nadu, hereinafter referred to as the "VENDOR" (which expression shall unless repugnant to the context include his legal heirs, executors, administrators, and assigns) of the FIRST PART;

AND:
Mr. Karthik Narayanan, residing at No. 12, Park Road, Coimbatore, Tamil Nadu, hereinafter referred to as the "PURCHASER" (which expression shall unless repugnant to the context include his legal heirs, executors, administrators, and assigns) of the SECOND PART.

WHEREAS the Vendor is the absolute and lawful owner of the residential plot situated at Survey No. 142/3A, Patta No. PAT-49120-TN, Saravanampatti Village, Coimbatore North Taluk, Coimbatore District, measuring an extent of 2,400 sq.ft.

NOW THIS AGREEMENT WITNESSETH AS FOLLOWS:
1. SALE CONSIDERATION: The total sale consideration agreed upon between the parties is INR 45,00,000/- (Rupees Forty-Five Lakhs Only).
2. ADVANCE PAYMENT: The Purchaser has paid an advance sum of INR 5,00,000/- (Rupees Five Lakhs Only) via RTGS transfer, receipt whereof the Vendor hereby acknowledges.
3. BALANCE PAYMENT & TIME OF PERFORMANCE: The balance consideration of INR 40,00,000/- shall be paid by the Purchaser within 90 days from the date of this agreement, upon execution and registration of the regular Sale Deed.
4. TITLE & ENCUMBRANCE: The Vendor covenants that the schedule property is free from all encumbrances, mortgages, attachments, charges, and legal litigation of any nature.
5. VACANT POSSESSION: The Vendor shall deliver peaceful, vacant, and physical possession of the schedule property to the Purchaser simultaneously upon registration of the Sale Deed.
6. STAMP DUTY & REGISTRATION EXPENSES: All stamp duty, registration fees, and incidental legal drafting expenses shall be borne entirely by the Purchaser.

DISCLAIMER: This agreement is an AI/template-assisted preparatory draft generated via LandAssist. It does not constitute an officially executed or registered legal instrument. The parties must complete formal stamping, registration, and qualified legal attestation as per applicable statutory requirements.

IN WITNESS WHEREOF the Vendor and Purchaser have set their respective hands on the day, month, and year first written above.

VENDOR: ________________________ (Rajesh Kumar)
PURCHASER: ______________________ (Karthik Narayanan)

WITNESSES:
1. ______________________
2. ______________________
""",
            1,
            json.dumps({"name": "Rajesh Kumar", "address": "No. 45, Green Avenue, Coimbatore", "role": "Vendor"}),
            json.dumps({"name": "Karthik Narayanan", "address": "No. 12, Park Road, Coimbatore", "role": "Purchaser"}),
            json.dumps({"total_consideration": "4500000", "advance_amount": "500000", "completion_days": "90"}),
            "template",
            "draft"
        ))

    conn.commit()

if __name__ == "__main__":
    init_db()
    print("LandAssist SQLite database successfully initialized with sample data.")
