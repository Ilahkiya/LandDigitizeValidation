import os
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from config import Config
from db import init_db
from routes.auth_routes import auth_bp
from routes.record_routes import record_bp
from routes.document_routes import document_bp
from routes.agreement_routes import agreement_bp
from routes.dashboard_routes import dashboard_bp
from routes.admin_routes import admin_bp
from routes.official_routes import official_bp
from routes.otp_routes import otp_bp

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Enable CORS with credentials for local React development
    CORS(
        app,
        supports_credentials=True,
        origins=config_class.CORS_ORIGINS,
        allow_headers=["Content-Type", "X-CSRF-Token", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    )

    # Initialize SQLite database and seed initial test records if not present
    with app.app_context():
        init_db()

    # CSRF check middleware for state-changing requests
    # Exempt login, register, logout, and csrf-token
    @app.before_request
    def check_csrf_protection():
        if app.config.get("TESTING"):
            return

        if request.method in {"POST", "PUT", "DELETE"}:
            exempt_paths = {
                "/api/auth/login",
                "/api/auth/register",
                "/api/auth/logout",
                "/api/auth/csrf-token"
            }
            if request.path not in exempt_paths:
                # Check header X-CSRF-Token or form data
                token = request.headers.get("X-CSRF-Token")
                if not token and request.form:
                    token = request.form.get("csrf_token")
                expected = session.get("csrf_token")
                if expected:
                    import secrets
                    if not token or not secrets.compare_digest(str(token), str(expected)):
                        return jsonify({"error": "Invalid CSRF security token."}), 403

    # Register API Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(record_bp)
    app.register_blueprint(document_bp)
    app.register_blueprint(agreement_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(official_bp)
    app.register_blueprint(otp_bp)

    # Error Handlers
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "Bad request. Please verify submitted parameters."}), 400

    @app.errorhandler(403)
    def forbidden(e):
        return jsonify({"error": "Access forbidden: you lack permission for this resource."}), 403

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Requested resource was not found on this server."}), 404

    @app.errorhandler(413)
    def request_entity_too_large(e):
        return jsonify({"error": "File exceeds the maximum allowable upload limit (16MB)."}), 413

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": "An internal server error occurred. Please contact technical support."}), 500

    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "service": "LandAssist Backend API",
            "status": "operational",
            "version": "1.0.0"
        })

    return app

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"[*] Starting LandAssist Backend Server on http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=True)
