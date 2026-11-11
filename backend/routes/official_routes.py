from flask import Blueprint, jsonify

official_bp = Blueprint("official", __name__, url_prefix="/api/official-services")

@official_bp.route("/info", methods=["GET"])
def get_official_info():
    """
    Returns verified external links and procedural guides for Tamil Nadu
    e-Services portal, emphasizing disclaimers and distinguishing application checks.
    """
    return jsonify({
        "portal_name": "Tamil Nadu Land Records e-Services (Anytime / Anywhere Services)",
        "portal_url": "https://eservices.tn.gov.in/",
        "services": [
            {
                "title": "View Patta / Chitta Extract",
                "description": "Access rural and urban land register extracts by District, Taluk, Village, and Survey/Subdivision number.",
                "url": "https://eservices.tn.gov.in/eservicesnew/land/chitta.html?lan=en"
            },
            {
                "title": "Verify Patta / Chitta Extract",
                "description": "Authenticate web-generated Patta/Chitta copies using Reference Number.",
                "url": "https://eservices.tn.gov.in/eservicesnew/land/verify_chitta.html?lan=en"
            },
            {
                "title": "View A-Register Extract",
                "description": "Inspect village A-Register detailing soil classification, tax assessment, and holding extent.",
                "url": "https://eservices.tn.gov.in/eservicesnew/land/areg.html?lan=en"
            },
            {
                "title": "FMB (Field Measurement Book) Sketch",
                "description": "View official parcel boundary maps and survey measurement sketches.",
                "url": "https://eservices.tn.gov.in/eservicesnew/land/fmb.html?lan=en"
            },
            {
                "title": "Application Status Tracking",
                "description": "Track the status of Patta transfer or subdivision applications online.",
                "url": "https://eservices.tn.gov.in/eservicesnew/land/patta_status.html?lan=en"
            }
        ],
        "disclaimer": "EXTERNAL GOVERNMENT PORTAL NOTICE: The links above direct to the official Government of Tamil Nadu e-Services portal (eservices.tn.gov.in). LandAssist is an independent document digitization and agreement drafting application. LandAssist is NOT operated, endorsed, or directly integrated with official government servers. LandAssist internal validation results are automated data-quality checks and do NOT replace official certified copies from the Revenue Department or Registration Department."
    })
