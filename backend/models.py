from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid
import json

db = SQLAlchemy()

def gen_uuid():
    return str(uuid.uuid4())


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    avatar = db.Column(db.String(256), default='')
    location = db.Column(db.String(200), default='')
    address = db.Column(db.String(500), default='')
    wallet_balance = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    items = db.relationship('Item', backref='owner', lazy=True, foreign_keys='Item.user_id')
    ratings_received = db.relationship('Rating', backref='ratee', lazy=True, foreign_keys='Rating.ratee_id')

    def to_dict(self):
        avg = db.session.query(db.func.avg(Rating.rating)).filter_by(ratee_id=self.id).scalar()
        count = db.session.query(db.func.count(Rating.id)).filter_by(ratee_id=self.id).scalar()
        from sqlalchemy import or_
        trade_count = TradeRequest.query.filter(
            or_(TradeRequest.requester_id == self.id, TradeRequest.target_user_id == self.id),
            TradeRequest.status == 'accepted'
        ).count()
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'avatar': self.avatar,
            'location': self.location or '',
            'address': self.address or '',
            'wallet_balance': round(self.wallet_balance or 0.0, 2),
            'reputation': round(float(avg), 2) if avg else 0.0,
            'total_ratings': count or 0,
            'trade_count': trade_count,
            'created_at': self.created_at.isoformat()
        }


class Item(db.Model):
    __tablename__ = 'items'
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    category = db.Column(db.String(100), nullable=False, index=True)
    condition = db.Column(db.String(50), nullable=False, default='good')
    value_estimate = db.Column(db.Float, default=0.0)
    image_url = db.Column(db.String(512), default='')
    media_urls = db.Column(db.Text, default='[]')
    wanted_category = db.Column(db.String(100), default='')
    wanted_description = db.Column(db.Text, default='')
    min_want_value = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(50), default='available', index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self, include_owner=False):
        try:
            media_list = json.loads(self.media_urls or '[]')
        except Exception:
            media_list = []
        if self.image_url and self.image_url not in media_list:
            media_list = [self.image_url] + media_list
        primary_image = media_list[0] if media_list else (self.image_url or '')
        d = {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'description': self.description,
            'category': self.category,
            'condition': self.condition,
            'value_estimate': self.value_estimate,
            'image_url': primary_image,
            'media_urls': media_list,
            'wanted_category': self.wanted_category,
            'wanted_description': self.wanted_description,
            'min_want_value': self.min_want_value or 0.0,
            'status': self.status,
            'created_at': self.created_at.isoformat()
        }
        if include_owner and self.owner:
            avg = db.session.query(db.func.avg(Rating.rating)).filter_by(ratee_id=self.owner.id).scalar()
            owner_rep = round(float(avg), 2) if avg else 0.0
            d['owner'] = {
                'id': self.owner.id,
                'username': self.owner.username,
                'reputation': owner_rep,
                'location': self.owner.location or ''
            }
            d['owner_reputation'] = owner_rep
            d['owner_location'] = self.owner.location or ''
        return d


class TradeRequest(db.Model):
    __tablename__ = 'trade_requests'
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    requester_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    requester_item_id = db.Column(db.String(36), db.ForeignKey('items.id'), nullable=False)
    target_item_id = db.Column(db.String(36), db.ForeignKey('items.id'), nullable=False)
    target_user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    match_score = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(50), default='pending', index=True)
    message = db.Column(db.Text, default='')
    meetup_location = db.Column(db.String(512), default='')
    wallet_adjustment = db.Column(db.Float, default=0.0)
    requester_confirmed = db.Column(db.Boolean, default=False)
    target_confirmed = db.Column(db.Boolean, default=False)
    requester_wallet_payment = db.Column(db.Float, default=0.0)
    requester_extra_item_ids = db.Column(db.Text, default='[]')
    accepted_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def _extra_items(self):
        try:
            ids = json.loads(self.requester_extra_item_ids or '[]')
        except Exception:
            ids = []
        result = []
        for iid in ids:
            it = Item.query.get(iid)
            if it:
                result.append(it.to_dict())
        return result

    requester = db.relationship('User', foreign_keys=[requester_id])
    target_user = db.relationship('User', foreign_keys=[target_user_id])
    requester_item = db.relationship('Item', foreign_keys=[requester_item_id])
    target_item = db.relationship('Item', foreign_keys=[target_item_id])

    def to_dict(self):
        return {
            'id': self.id,
            'requester_id': self.requester_id,
            'requester_username': self.requester.username if self.requester else '',
            'requester_item': self.requester_item.to_dict() if self.requester_item else {},
            'target_item': self.target_item.to_dict() if self.target_item else {},
            'target_user_id': self.target_user_id,
            'match_score': self.match_score,
            'status': self.status,
            'message': self.message,
            'meetup_location': self.meetup_location or '',
            'wallet_adjustment': self.wallet_adjustment or 0.0,
            'requester_confirmed': bool(self.requester_confirmed),
            'target_confirmed': bool(self.target_confirmed),
            'requester_wallet_payment': self.requester_wallet_payment or 0.0,
            'requester_extra_items': self._extra_items(),
            'accepted_at': self.accepted_at.isoformat() if self.accepted_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat()
        }


class Rating(db.Model):
    __tablename__ = 'ratings'
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    rater_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    ratee_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    trade_id = db.Column(db.String(36), db.ForeignKey('trade_requests.id'), nullable=True)
    rating = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    rater = db.relationship('User', foreign_keys=[rater_id])
