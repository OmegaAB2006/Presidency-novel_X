import os
from flask import Flask, send_from_directory, jsonify
from flask_jwt_extended import JWTManager, get_jwt, jwt_required, get_jwt_identity
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_socketio import join_room
from models import db
from routes.auth import auth_bp, bcrypt
from routes.items import items_bp
from routes.trades import trades_bp
from routes.profile import profile_bp
from extensions import socketio, limiter
from redis_client import r, REDIS_URL, REDIS_AVAILABLE

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.environ.get('SECRET_KEY', 'exchange-secret-key-change-in-prod'),
    JWT_SECRET_KEY=os.environ.get('JWT_SECRET_KEY', 'exchange-jwt-secret-change-in-prod'),
    SQLALCHEMY_DATABASE_URI=os.environ.get('DATABASE_URL', f"sqlite:///{os.path.join(BASE_DIR, 'exchange.db')}"),
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    UPLOAD_FOLDER=os.path.join(BASE_DIR, 'uploads'),
    MAX_CONTENT_LENGTH=100 * 1024 * 1024,
    RATELIMIT_STORAGE_URI=REDIS_URL if REDIS_AVAILABLE else 'memory://',
    RATELIMIT_HEADERS_ENABLED=True,
)

CORS(app, resources={r"/*": {"origins": "*"}})
db.init_app(app)
bcrypt.init_app(app)
jwt = JWTManager(app)

# Use real Redis message queue if available, else single-process mode
_mq = REDIS_URL if os.environ.get('REDIS_URL') else None
socketio.init_app(app, cors_allowed_origins="*", message_queue=_mq, async_mode='eventlet')
limiter.init_app(app)

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(items_bp, url_prefix='/api/items')
app.register_blueprint(trades_bp, url_prefix='/api/trades')
app.register_blueprint(profile_bp, url_prefix='/api/profile')


# ── JWT blocklist ────────────────────────────────────────────────
@jwt.token_in_blocklist_loader
def check_if_revoked(jwt_header, jwt_payload):
    return r.get(f'bl:{jwt_payload["jti"]}') is not None


# ── Logout ───────────────────────────────────────────────────────
@app.route('/api/auth/logout', methods=['POST'])
@jwt_required()
def logout():
    payload = get_jwt()
    ttl = max(int(payload['exp'] - payload['iat']), 60)
    r.setex(f'bl:{payload["jti"]}', ttl, '1')
    return jsonify({'message': 'Logged out'})


# ── Static routes ─────────────────────────────────────────────────
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


# ── WebSocket handlers ───────────────────────────────────────────
@socketio.on('connect')
def on_connect(auth):
    token = (auth or {}).get('token')
    if not token:
        return
    try:
        from flask_jwt_extended import decode_token
        decoded = decode_token(token)
        user_id = decoded['sub']
        join_room(user_id)
        print(f"Socket: user {user_id} joined their room")
    except Exception as e:
        print(f"Socket: auth failed — {e}")


@socketio.on('disconnect')
def on_disconnect():
    pass


# ── Migrations ───────────────────────────────────────────────────
def run_migrations():
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
            ('requester_wallet_payment', 'REAL DEFAULT 0.0'),
            ('requester_extra_item_ids', "TEXT DEFAULT '[]'"),
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
    socketio.run(app, debug=True, port=5001)
