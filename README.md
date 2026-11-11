# LandAssist — Professional Land Records & Agreement Management Platform

LandAssist is an enterprise-grade SaaS web application designed for **land record digitization**, **cadastral data validation**, **secure private document management**, and **AI-assisted property agreement drafting**.

Built with a modern **React (Vite)** frontend and a robust **Python Flask** backend powered by **SQLite**, LandAssist provides an end-to-end workflow for property owners and legal reviewers.

---

## Key Modules & Capabilities

1. **Role-Based Authorization & Session Security**
   - Three distinct roles: **Property Owner**, **Legal Reviewer**, and **System Administrator**.
   - Cryptographic password hashing via **Werkzeug** (Scrypt). Plaintext passwords are never stored.
   - Protected **Flask HTTP sessions** with `HttpOnly` and `SameSite` flags.
   - Automated brute-force login throttling and comprehensive security audit logging.

2. **Secure Document Upload & Private Storage**
   - Supports **PDF**, **PNG**, **JPG**, and **JPEG** with 16MB upload boundary checks.
   - Private file storage located strictly outside public web roots with UUID file mapping.
   - Strict server-side ownership checks before document preview, download, or deletion.

3. **Land Record Digitization & OCR Engine**
   - Text-based PDF extraction via **PyMuPDF** (`fitz`).
   - Scanned deed and image OCR via **Tesseract OCR** with graceful host-level fallbacks.
   - Cadastral pattern matching for Tamil Nadu land records (Patta, Survey/Subdivision, Village, Taluk, District, Extent, Document Reference).
   - Side-by-side extracted text inspector with human-in-the-loop manual confirmation.

4. **Cadastral Validation Rules Engine**
   - Pure Python validation rules executed on the backend:
     - Missing mandatory field checks
     - Alphanumeric survey and subdivision format validation
     - Zero or negative land area boundary verification
     - Cross-record duplicate document reference detection
     - Cadastral boundary ownership conflict detection across existing parcels
   - Categorized statuses: *Application Checks Passed*, *Needs Review*, *Incomplete*, and *Conflict Detected*.

5. **AI-Assisted Agreement Drafting & PDF Generation**
   - Multi-step wizard supporting **Sale Agreements**, **Rental Tenancy Agreements**, and **Long-Term Lease Agreements**.
   - Secure OpenAI API backend integration when configured, with an exhaustive, legally structured **template fallback engine**.
   - In-browser markdown editor with revision tracking and change history.
   - Automated, formatted PDF export using **ReportLab** with official draft notices and signature blocks.

6. **Remote Agreement Sharing & Review Collaboration**
   - Document owners can securely grant review permissions to specific reviewers via email.
   - Reviewers access only instruments explicitly shared with them.
   - Interactive review comment thread with clause reference tracking.

7. **Official Government Services Guide**
   - Direct integration link to the **Tamil Nadu Land Records e-Services Portal** (`https://eservices.tn.gov.in/`).
   - Prominent statutory disclaimers clearly separating application-level quality checks from certified government revenue records.

---

## Technology Stack

- **Frontend:** React 18, JavaScript, Vite, Lucide Icons, Pure CSS Design System
- **Backend:** Python 3.8+ / Flask 3.0+
- **Database:** SQLite 3 (Foreign keys, indexes, and seeded sample data)
- **PDF Extraction:** PyMuPDF (`fitz`)
- **OCR Engine:** Tesseract OCR (`pytesseract`)
- **PDF Generation:** ReportLab 4.x
- **Password Hashing:** Werkzeug Security (`generate_password_hash`, `check_password_hash`)
- **Test Suite:** pytest 8.x

---

## Local Installation & Quick Start

### 1. Prerequisites
- **Python 3.8+** installed
- **Node.js 18+** and **npm** installed

### 2. Backend Setup

Open a terminal and navigate to the project directory:

```bash
# Navigate to backend directory
cd backend

# Install Python dependencies
python -m pip install -r requirements.txt

# Initialize database schema and seed fictional test records
python db.py

# Launch the Flask backend server (runs on port 5000)
python app.py
```

The backend server will be live at `http://127.0.0.1:5000`.

### 3. Frontend Setup

Open a second terminal window:

```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start the Vite development server (runs on port 5173)
npm run dev
```

Open your browser and navigate to: **`http://localhost:5173`**

---

## Default Demo Accounts

The database comes pre-seeded with three demo accounts for instant evaluation:

| Role | Email | Password | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| **Property Owner** | `owner@landassist.local` | `OwnerPass123!` | Digitize deeds, manage land parcels, run validation, draft agreements, share with reviewers |
| **Legal Reviewer** | `reviewer@landassist.local` | `ReviewerPass123!` | Access shared agreements, review draft clauses, post legal comments |
| **Administrator** | `admin@landassist.local` | `AdminPass123!` | Full user account administration, security audit trail inspector, system health diagnostics |

*Quick-login buttons are also provided directly on the Login page for one-click access.*

---

## Running the Automated Test Suite

LandAssist includes a full pytest suite verifying authentication, hashing, authorization, validation rules, duplicate detection, agreement drafting, and PDF generation.

Run all tests from the project root:

```bash
python -m pytest backend/tests/test_landassist.py -v
```

All 9 test suites will run and pass:
```
backend/tests/test_landassist.py::test_auth_registration_and_hashing PASSED
backend/tests/test_landassist.py::test_auth_login_logout_and_protection PASSED
backend/tests/test_landassist.py::test_unauthorized_record_access_prevention PASSED
backend/tests/test_landassist.py::test_land_record_validation_missing_fields PASSED
backend/tests/test_landassist.py::test_land_record_validation_negative_area PASSED
backend/tests/test_landassist.py::test_land_record_validation_duplicate_ref PASSED
backend/tests/test_landassist.py::test_agreement_generator_and_template_fallback PASSED
backend/tests/test_landassist.py::test_agreement_pdf_generation PASSED
backend/tests/test_landassist.py::test_agreement_sharing_and_reviewer_access PASSED
```

---

## Project Structure

```
land-project/
├── backend/
│   ├── app.py                     # Flask application entry point and routes
│   ├── config.py                  # Environment and server configuration
│   ├── db.py                      # SQLite database schema and seed data
│   ├── auth.py                    # Session auth, password hashing, and role guards
│   ├── audit.py                   # Security audit logger
│   ├── ocr_engine.py              # PyMuPDF and Tesseract OCR engine
│   ├── validation_engine.py       # Cadastral quality and conflict validation rules
│   ├── agreement_engine.py        # OpenAI API client and template fallback engine
│   ├── pdf_generator.py           # ReportLab formatted agreement PDF exporter
│   ├── routes/
│   │   ├── auth_routes.py         # Login, registration, session, and password routes
│   │   ├── record_routes.py       # Land record CRUD and validation execution
│   │   ├── document_routes.py     # Secure document upload, preview, and download
│   │   ├── agreement_routes.py    # Draft generation, editor, sharing, and comments
│   │   ├── dashboard_routes.py    # Aggregated metrics from SQLite
│   │   ├── admin_routes.py        # User management, audit trail, and diagnostics
│   │   └── official_routes.py     # Tamil Nadu Land Records portal guidance
│   ├── storage/
│   │   └── uploads/               # Private file storage outside static web root
│   ├── tests/
│   │   └── test_landassist.py     # Backend unit and integration test suite
│   └── requirements.txt           # Python package requirements
├── frontend/
│   ├── src/
│   │   ├── components/            # Layout, StatusBadge, Modal, ProtectedRoute
│   │   ├── context/               # AuthContext for session state
│   │   ├── pages/                 # 16 functional production-grade pages
│   │   ├── services/              # API fetch client with credentials & CSRF
│   │   ├── styles/                # CSS design system tokens and component styles
│   │   ├── App.jsx                # Client-side routing tree
│   │   └── main.jsx               # React entry point
│   ├── package.json               # Node dependencies
│   ├── vite.config.js             # Vite configuration with API proxy
│   └── index.html                 # HTML shell with Google Fonts
├── .env.example                   # Environment configuration template
├── .gitignore                     # Git ignore rules
└── README.md                      # Documentation and run instructions
```

---

## Legal & Compliance Notice

LandAssist is an independent legal document management and cadastral digitization platform. Generating, sharing, or downloading drafts through this software does not constitute execution or registration of a deed under the Indian Registration Act, 1908. All agreements should be reviewed by a licensed advocate and registered before the jurisdictional Sub-Registrar Office where statutory registration is mandatory.
