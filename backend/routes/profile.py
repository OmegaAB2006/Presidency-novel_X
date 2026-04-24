from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, TradeRequest, Rating
from sqlalchemy import or_

profile_bp = Blueprint('profile', __name__)


@profile_bp.route('/<user_id>', methods=['GET'])
@jwt_required()
def get_profile(user_id):
    user = User.query.get_or_404(user_id)

    past_trades = TradeRequest.query.filter(
        or_(TradeRequest.requester_id == user_id, TradeRequest.target_user_id == user_id),
        TradeRequest.status == 'accepted'
    ).order_by(TradeRequest.created_at.desc()).limit(20).all()

    active_trades = TradeRequest.query.filter(
        or_(TradeRequest.requester_id == user_id, TradeRequest.target_user_id == user_id),
        TradeRequest.status == 'pending'
    ).order_by(TradeRequest.created_at.desc()).all()

    completed_count = TradeRequest.query.filter(
        or_(TradeRequest.requester_id == user_id, TradeRequest.target_user_id == user_id),
        TradeRequest.status == 'completed'
    ).count()
    total_resolved = TradeRequest.query.filter(
        or_(TradeRequest.requester_id == user_id, TradeRequest.target_user_id == user_id),
        TradeRequest.status.in_(['accepted', 'completed', 'rejected', 'cancelled'])
    ).count()
    success_rate = round(completed_count / total_resolved * 100, 1) if total_resolved > 0 else 0

    ratings = Rating.query.filter_by(ratee_id=user_id).order_by(Rating.created_at.desc()).all()
    reviews = []
    for r in ratings:
        rater = User.query.get(r.rater_id)
        reviews.append({
            'id': r.id,
            'rating': r.rating,
            'comment': r.comment,
            'rater_id': r.rater_id,
            'rater_username': rater.username if rater else 'Unknown',
            'created_at': r.created_at.isoformat()
        })

    return jsonify({
        'user': user.to_dict(),
        'past_trades': [t.to_dict() for t in past_trades],
        'active_trades': [t.to_dict() for t in active_trades],
        'trade_success_rate': success_rate,
        'reviews': reviews
    })


@profile_bp.route('/wallet/topup', methods=['POST'])
@jwt_required()
def topup_wallet():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}
    amount = float(data.get('amount', 0))
    if amount <= 0 or amount > 500000:
        return jsonify({'error': 'Amount must be between ₹1 and ₹5,00,000'}), 400
    user.wallet_balance = (user.wallet_balance or 0) + amount
    db.session.commit()
    return jsonify({'wallet_balance': user.wallet_balance, 'added': amount})
