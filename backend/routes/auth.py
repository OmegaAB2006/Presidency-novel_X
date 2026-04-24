from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from flask_bcrypt import Bcrypt
from models import db, User
from extensions import limiter

auth_bp = Blueprint('auth', __name__)
bcrypt = Bcrypt()


@auth_bp.route('/register', methods=['POST'])
@limiter.limit("5 per minute")
def register():
    data = request.get_json()
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    location = (data.get('location') or '').strip()
    address = (data.get('address') or '').strip()

    if not username or not email or not password:
        return jsonify({'error': 'All fields required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already taken'}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    pw_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    user = User(
        username=username,
        email=email,
        password_hash=pw_hash,
        location=location,
        address=address
    )
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=user.id)
    return jsonify({'token': token, 'user': user.to_dict()}), 201


@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    data = request.get_json()
    identifier = (data.get('email') or data.get('username') or '').strip()
    password = data.get('password') or ''

    user = User.query.filter(
        (User.email == identifier.lower()) | (User.username == identifier)
    ).first()

    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid credentials'}), 401

    token = create_access_token(identity=user.id)
    return jsonify({'token': token, 'user': user.to_dict()})


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user = User.query.get(get_jwt_identity())
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user.to_dict())
