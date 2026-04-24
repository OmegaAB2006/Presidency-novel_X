import os, uuid, json
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Item, User
from werkzeug.utils import secure_filename

items_bp = Blueprint('items', __name__)

ALLOWED_MEDIA = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'mov', 'avi', 'webm', 'mkv'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_MEDIA


@items_bp.route('', methods=['GET'])
@jwt_required()
def list_items():
    current_user_id = get_jwt_identity()
    items = Item.query.filter_by(user_id=current_user_id).order_by(Item.created_at.desc()).all()
    return jsonify([i.to_dict() for i in items])


@items_bp.route('/marketplace', methods=['GET'])
@jwt_required()
def marketplace():
    current_user_id = get_jwt_identity()
    category = request.args.get('category')
    q = Item.query.filter(Item.status == 'available', Item.user_id != current_user_id)
    if category:
        q = q.filter(Item.category == category)
    items = q.limit(200).all()
    from services.matching import score_marketplace_items
    result = score_marketplace_items(current_user_id, items)
    return jsonify(result)


@items_bp.route('', methods=['POST'])
@jwt_required()
def create_item():
    current_user_id = get_jwt_identity()
    media_urls = []

    if request.content_type and 'multipart' in request.content_type:
        name = request.form.get('name', '').strip()
        description = request.form.get('description', '')
        category = request.form.get('category', '').strip()
        condition = request.form.get('condition', 'good')
        value_estimate = float(request.form.get('value_estimate') or 0)
        wanted_category = request.form.get('wanted_category', '')
        wanted_description = request.form.get('wanted_description', '')
        min_want_value = float(request.form.get('min_want_value') or 0)

        upload_dir = current_app.config['UPLOAD_FOLDER']
        os.makedirs(upload_dir, exist_ok=True)

        # Accept up to 5 media files via 'media' key
        files = request.files.getlist('media')
        for f in files[:5]:
            if f and f.filename and allowed_file(f.filename):
                ext = f.filename.rsplit('.', 1)[1].lower()
                fname = f"{uuid.uuid4()}.{ext}"
                f.save(os.path.join(upload_dir, fname))
                media_urls.append(f"/uploads/{fname}")

        # Backward compat: single 'image' field
        if not media_urls:
            file = request.files.get('image')
            if file and file.filename and allowed_file(file.filename):
                ext = file.filename.rsplit('.', 1)[1].lower()
                fname = f"{uuid.uuid4()}.{ext}"
                file.save(os.path.join(upload_dir, fname))
                media_urls.append(f"/uploads/{fname}")
    else:
        data = request.get_json() or {}
        name = data.get('name', '').strip()
        description = data.get('description', '')
        category = data.get('category', '').strip()
        condition = data.get('condition', 'good')
        value_estimate = float(data.get('value_estimate') or 0)
        wanted_category = data.get('wanted_category', '')
        wanted_description = data.get('wanted_description', '')
        min_want_value = float(data.get('min_want_value') or 0)
        media_urls = data.get('media_urls', [])

    if not name or not category:
        return jsonify({'error': 'Name and category are required'}), 400

    image_url = media_urls[0] if media_urls else ''
    item = Item(
        user_id=current_user_id,
        name=name,
        description=description,
        category=category,
        condition=condition,
        value_estimate=value_estimate,
        image_url=image_url,
        media_urls=json.dumps(media_urls),
        wanted_category=wanted_category,
        wanted_description=wanted_description,
        min_want_value=min_want_value
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@items_bp.route('/<item_id>', methods=['PUT'])
@jwt_required()
def update_item(item_id):
    current_user_id = get_jwt_identity()
    item = Item.query.get_or_404(item_id)
    if item.user_id != current_user_id:
        return jsonify({'error': 'Forbidden'}), 403

    data = request.get_json() or {}
    for field in ['name', 'description', 'category', 'condition', 'value_estimate',
                  'wanted_category', 'wanted_description', 'status', 'min_want_value']:
        if field in data:
            setattr(item, field, data[field])
    db.session.commit()
    return jsonify(item.to_dict())


@items_bp.route('/<item_id>', methods=['DELETE'])
@jwt_required()
def delete_item(item_id):
    current_user_id = get_jwt_identity()
    item = Item.query.get_or_404(item_id)
    if item.user_id != current_user_id:
        return jsonify({'error': 'Forbidden'}), 403
    db.session.delete(item)
    db.session.commit()
    return jsonify({'success': True})
