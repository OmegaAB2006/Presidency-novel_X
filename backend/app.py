import os
from flask import Flask, send_from_directory, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from models import db
from routes.auth import auth_bp, bcrypt
from routes.items import items_bp
from routes.trades import trades_bp
from routes.profile import profile_bp

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
app.config.update(
    SECRET_KEY='exchange-secret-key-change-in-prod',
    JWT_SECRET_KEY='exchange-jwt-secret-change-in-prod',
    SQLALCHEMY_DATABASE_URI=f"sqlite:///{os.path.join(BASE_DIR, 'exchange.db')}",
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    UPLOAD_FOLDER=os.path.join(BASE_DIR, 'uploads'),
    MAX_CONTENT_LENGTH=100 * 1024 * 1024,  # 100 MB (supports videos)
)

CORS(app, resources={r"/api/*": {"origins": "*"}})
db.init_app(app)
bcrypt.init_app(app)
JWTManager(app)

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(items_bp, url_prefix='/api/items')
app.register_blueprint(trades_bp, url_prefix='/api/trades')
app.register_blueprint(profile_bp, url_prefix='/api/profile')


@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/api/health')
def health():
    return jsonify({'status': 'OK'})


@app.route('/api/users/<user_id>')
def get_user(user_id):
    from models import User
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict())


def run_migrations():
    """Non-destructive column additions for existing SQLite databases."""
    conn = db.engine.raw_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("PRAGMA table_info(users)")
        user_cols = {row[1] for row in cursor.fetchall()}
        for col, typedef in [
            ('location', "TEXT DEFAULT ''"),
            ('address', "TEXT DEFAULT ''"),
            ('wallet_balance', 'REAL DEFAULT 0.0'),
        ]:
            if col not in user_cols:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col} {typedef}")
                print(f"Migration: added users.{col}")

        cursor.execute("PRAGMA table_info(items)")
        item_cols = {row[1] for row in cursor.fetchall()}
        for col, typedef in [
            ('media_urls', "TEXT DEFAULT '[]'"),
            ('min_want_value', 'REAL DEFAULT 0.0'),
        ]:
            if col not in item_cols:
                cursor.execute(f"ALTER TABLE items ADD COLUMN {col} {typedef}")
                print(f"Migration: added items.{col}")

        cursor.execute("PRAGMA table_info(trade_requests)")
        trade_cols = {row[1] for row in cursor.fetchall()}
        for col, typedef in [
            ('meetup_location', "TEXT DEFAULT ''"),
            ('wallet_adjustment', 'REAL DEFAULT 0.0'),
            ('requester_confirmed', 'INTEGER DEFAULT 0'),
            ('target_confirmed', 'INTEGER DEFAULT 0'),
            ('accepted_at', 'TEXT'),
            ('completed_at', 'TEXT'),
        ]:
            if col not in trade_cols:
                cursor.execute(f"ALTER TABLE trade_requests ADD COLUMN {col} {typedef}")
                print(f"Migration: added trade_requests.{col}")

        conn.commit()
    finally:
        conn.close()


with app.app_context():
    db.create_all()
    run_migrations()
    print("Database ready.")

if __name__ == '__main__':
    app.run(debug=True, port=5001)
