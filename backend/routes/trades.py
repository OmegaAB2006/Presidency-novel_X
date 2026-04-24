from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Item, TradeRequest, Rating, User
from services.matching import find_matches
from datetime import datetime

trades_bp = Blueprint('trades', __name__)


@trades_bp.route('/matches/<item_id>', methods=['GET'])
@jwt_required()
def get_matches(item_id):
    current_user_id = get_jwt_identity()
    limit = min(int(request.args.get('limit', 20)), 50)
    results = find_matches(current_user_id, item_id, limit)
    return jsonify(results)


@trades_bp.route('', methods=['POST'])
@jwt_required()
def create_trade():
    current_user_id = get_jwt_identity()
    data = request.get_json() or {}

    requester_item_id = data.get('requester_item_id')
    target_item_id = data.get('target_item_id')
    message = data.get('message', '')

    if not requester_item_id or not target_item_id:
        return jsonify({'error': 'requester_item_id and target_item_id required'}), 400

    req_item = Item.query.get(requester_item_id)
    tgt_item = Item.query.get(target_item_id)

    if not req_item or req_item.user_id != current_user_id:
        return jsonify({'error': 'Requester item not found or not yours'}), 404
    if not tgt_item or tgt_item.status != 'available':
        return jsonify({'error': 'Target item not available'}), 404
    if tgt_item.user_id == current_user_id:
        return jsonify({'error': 'Cannot trade with yourself'}), 400

    from services.matching import compute_match_score
    avg = db.session.query(db.func.avg(Rating.rating)).filter_by(ratee_id=current_user_id).scalar()
    rep = float(avg) if avg else 0.0
    requester_user = User.query.get(current_user_id)
    target_owner = User.query.get(tgt_item.user_id)
    user_loc = requester_user.location if requester_user else ''
    cand_loc = target_owner.location if target_owner else ''
    score = compute_match_score(req_item, tgt_item, rep, user_loc, cand_loc)

    req_val = req_item.value_estimate or 0
    tgt_val = tgt_item.value_estimate or 0
    value_diff = tgt_val - req_val

    trade = TradeRequest(
        requester_id=current_user_id,
        requester_item_id=requester_item_id,
        target_item_id=target_item_id,
        target_user_id=tgt_item.user_id,
        match_score=score,
        message=message
    )
    db.session.add(trade)
    db.session.commit()
    result = trade.to_dict()
    result['value_diff'] = value_diff
    return jsonify(result), 201


@trades_bp.route('', methods=['GET'])
@jwt_required()
def list_trades():
    current_user_id = get_jwt_identity()
    sent = TradeRequest.query.filter_by(requester_id=current_user_id).order_by(TradeRequest.created_at.desc()).all()
    received = TradeRequest.query.filter_by(target_user_id=current_user_id).order_by(TradeRequest.created_at.desc()).all()

    def annotate(trade):
        d = trade.to_dict()
        existing = Rating.query.filter_by(rater_id=current_user_id, trade_id=trade.id).first()
        d['rated_by_me'] = existing is not None
        if current_user_id == trade.requester_id:
            d['my_confirmed'] = bool(trade.requester_confirmed)
        else:
            d['my_confirmed'] = bool(trade.target_confirmed)
        return d

    return jsonify({
        'sent': [annotate(t) for t in sent],
        'received': [annotate(t) for t in received]
    })


@trades_bp.route('/<trade_id>/respond', methods=['PUT'])
@jwt_required()
def respond_trade(trade_id):
    current_user_id = get_jwt_identity()
    trade = TradeRequest.query.get_or_404(trade_id)

    if trade.target_user_id != current_user_id:
        return jsonify({'error': 'Forbidden'}), 403
    if trade.status != 'pending':
        return jsonify({'error': 'Trade already resolved'}), 400

    data = request.get_json() or {}
    action = data.get('action')
    if action not in ('accept', 'reject'):
        return jsonify({'error': 'action must be accept or reject'}), 400

    if action == 'accept':
        meetup_location = (data.get('meetup_location') or '').strip()
        wallet_payment = float(data.get('wallet_payment', 0))

        if wallet_payment > 0:
            target_user = User.query.get(current_user_id)
            if not target_user or (target_user.wallet_balance or 0) < wallet_payment:
                return jsonify({'error': 'Insufficient wallet balance'}), 400
            requester_user = User.query.get(trade.requester_id)
            target_user.wallet_balance = (target_user.wallet_balance or 0) - wallet_payment
            if requester_user:
                requester_user.wallet_balance = (requester_user.wallet_balance or 0) + wallet_payment
            trade.wallet_adjustment = wallet_payment

        trade.status = 'accepted'
        trade.meetup_location = meetup_location
        trade.accepted_at = datetime.utcnow()

        req_item = Item.query.get(trade.requester_item_id)
        tgt_item = Item.query.get(trade.target_item_id)
        if req_item:
            req_item.status = 'traded'
        if tgt_item:
            tgt_item.status = 'traded'

        TradeRequest.query.filter(
            TradeRequest.id != trade_id,
            TradeRequest.status == 'pending',
            db.or_(
                TradeRequest.requester_item_id.in_([trade.requester_item_id, trade.target_item_id]),
                TradeRequest.target_item_id.in_([trade.requester_item_id, trade.target_item_id])
            )
        ).update({'status': 'cancelled'}, synchronize_session=False)
    else:
        trade.status = 'rejected'

    db.session.commit()
    return jsonify(trade.to_dict())


@trades_bp.route('/<trade_id>/confirm', methods=['POST'])
@jwt_required()
def confirm_trade(trade_id):
    """Mark trade as physically picked up / done by current user. When both confirm → completed."""
    current_user_id = get_jwt_identity()
    trade = TradeRequest.query.get_or_404(trade_id)

    if current_user_id not in (trade.requester_id, trade.target_user_id):
        return jsonify({'error': 'Forbidden'}), 403
    if trade.status not in ('accepted', 'completed'):
        return jsonify({'error': 'Trade must be accepted before confirming pickup'}), 400

    if current_user_id == trade.requester_id:
        trade.requester_confirmed = True
    else:
        trade.target_confirmed = True

    if trade.requester_confirmed and trade.target_confirmed:
        trade.status = 'completed'
        trade.completed_at = datetime.utcnow()

    db.session.commit()
    d = trade.to_dict()
    d['my_confirmed'] = True
    return jsonify(d)


@trades_bp.route('/<trade_id>/rate', methods=['POST'])
@jwt_required()
def rate_trade(trade_id):
    current_user_id = get_jwt_identity()
    trade = TradeRequest.query.get_or_404(trade_id)

    if trade.status not in ('accepted', 'completed'):
        return jsonify({'error': 'Can only rate completed trades'}), 400
    if current_user_id not in (trade.requester_id, trade.target_user_id):
        return jsonify({'error': 'Forbidden'}), 403

    ratee_id = trade.target_user_id if current_user_id == trade.requester_id else trade.requester_id

    existing = Rating.query.filter_by(rater_id=current_user_id, trade_id=trade_id).first()
    if existing:
        return jsonify({'error': 'Already rated this trade'}), 409

    data = request.get_json() or {}
    rating_val = int(data.get('rating', 5))
    if not 1 <= rating_val <= 5:
        return jsonify({'error': 'Rating must be 1-5'}), 400

    r = Rating(
        rater_id=current_user_id,
        ratee_id=ratee_id,
        trade_id=trade_id,
        rating=rating_val,
        comment=data.get('comment', '')
    )
    db.session.add(r)
    db.session.commit()
    return jsonify({'success': True, 'rating': rating_val})
