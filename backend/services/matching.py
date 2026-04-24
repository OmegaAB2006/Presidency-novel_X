from models import Item, User, Rating, db
from sqlalchemy import or_

CONDITION_RANK = {'like_new': 5, 'excellent': 4, 'good': 3, 'fair': 2, 'poor': 1}


def compute_match_score(user_item, candidate, requester_reputation, user_location='', candidate_location=''):
    """
    Score a candidate item against the user's item.

    Weights:
      35% value compatibility (adjusted for min_want_value threshold)
      25% mutual want alignment (bidirectional category matching)
      20% condition compatibility
      10% trader reputation
      10% location proximity
    """
    u_val = user_item.value_estimate or 1000
    c_val = candidate.value_estimate or 1000
    denom = max(u_val, c_val, 1)
    value_score = 1.0 - abs(u_val - c_val) / denom

    # Penalise if my item doesn't meet the candidate's minimum ask
    if candidate.min_want_value and candidate.min_want_value > 0:
        if u_val < candidate.min_want_value:
            value_score *= max(0.0, u_val / candidate.min_want_value)

    # Mutual want alignment
    want_score = 0.0
    cw = (candidate.wanted_category or '').lower()
    uc = (user_item.category or '').lower()
    uw = (user_item.wanted_category or '').lower()
    cc = (candidate.category or '').lower()

    if cw and uc:
        if cw == uc:
            want_score = max(want_score, 1.0)
        elif cw in uc or uc in cw:
            want_score = max(want_score, 0.7)

    if uw and cc:
        if uw == cc:
            want_score = max(want_score, 0.9)
        elif uw in cc or cc in uw:
            want_score = max(want_score, 0.6)

    # Same category as partial signal
    if uc and cc and uc == cc:
        want_score = max(want_score, 0.3)

    u_cond = CONDITION_RANK.get(user_item.condition, 3)
    c_cond = CONDITION_RANK.get(candidate.condition, 3)
    cond_score = 1.0 - abs(u_cond - c_cond) / 4.0

    rep_bonus = (min(max(requester_reputation, 1), 5) - 1) / 4.0

    loc_score = 0.0
    if user_location and candidate_location:
        loc_score = 1.0 if user_location.lower() == candidate_location.lower() else 0.0

    score = (
        value_score * 0.35
        + want_score * 0.25
        + cond_score * 0.20
        + rep_bonus * 0.10
        + loc_score * 0.10
    )
    return round(max(0.0, min(1.0, score)), 4)


def find_matches(user_id, item_id, limit=20):
    """Find the best trade matches for a specific item (cross-category aware)."""
    user_item = Item.query.filter_by(id=item_id).first()
    if not user_item:
        return []

    user = User.query.get(user_id)
    user_location = user.location if user else ''

    avg = db.session.query(db.func.avg(Rating.rating)).filter_by(ratee_id=user_id).scalar()
    requester_rep = float(avg) if avg else 0.0

    # Broader filter: mutual interest OR same category fallback
    filter_conditions = [Item.category == user_item.category]
    if user_item.wanted_category:
        filter_conditions.append(Item.category == user_item.wanted_category)
    filter_conditions.append(Item.wanted_category == user_item.category)

    candidates = (
        Item.query
        .filter(
            Item.status == 'available',
            Item.user_id != user_id,
            Item.id != item_id,
            or_(*filter_conditions)
        )
        .limit(2000)
        .all()
    )

    if not candidates:
        return []

    scored = []
    for c in candidates:
        owner = c.owner
        owner_location = owner.location if owner else ''
        score = compute_match_score(user_item, c, requester_rep, user_location, owner_location)
        d = c.to_dict(include_owner=True)
        d['match_score'] = score
        scored.append(d)

    scored.sort(key=lambda x: x['match_score'], reverse=True)
    return scored[:limit]


def score_marketplace_items(user_id, items):
    """
    Score every marketplace item based on the current user's trading profile.
    Returns items sorted best-match-first so the feed is immediately useful.
    """
    user = User.query.get(user_id)
    if not user:
        return [_enrich(i) for i in items]

    user_items = Item.query.filter_by(user_id=user_id, status='available').all()
    user_location = (user.location or '').lower()

    if not user_items:
        result = [_enrich(i) for i in items]
        result.sort(key=lambda x: x.get('owner_reputation', 0), reverse=True)
        return result

    user_categories = {i.category.lower() for i in user_items}
    user_wanted = {i.wanted_category.lower() for i in user_items if i.wanted_category}
    avg_user_value = sum(i.value_estimate for i in user_items) / len(user_items)
    best_user_value = max((i.value_estimate for i in user_items), default=0)

    result = []
    for item in items:
        d = _enrich(item)
        owner_rep = d.get('owner_reputation', 0)
        owner_location = (d.get('owner_location') or '').lower()
        item_cat = item.category.lower()
        item_wanted = (item.wanted_category or '').lower()

        # Want alignment (bidirectional)
        want_score = 0.0
        if item_cat in user_wanted:
            want_score = max(want_score, 1.0)
        elif any(item_cat in w or w in item_cat for w in user_wanted):
            want_score = max(want_score, 0.7)
        if item_wanted:
            if item_wanted in user_categories:
                want_score = max(want_score, 0.9)
            elif any(item_wanted in c or c in item_wanted for c in user_categories):
                want_score = max(want_score, 0.6)
        if item_cat in user_categories:
            want_score = max(want_score, 0.3)

        # Value proximity to user's average item value
        c_val = item.value_estimate or 1000
        denom = max(avg_user_value, c_val, 1)
        value_score = 1.0 - abs(avg_user_value - c_val) / denom

        # min_want_value compliance
        min_ok = 1.0
        if item.min_want_value and item.min_want_value > 0:
            if best_user_value >= item.min_want_value:
                min_ok = 1.0
            else:
                min_ok = max(0.0, best_user_value / item.min_want_value)

        loc_score = 1.0 if (user_location and owner_location and user_location == owner_location) else 0.0
        rating_score = owner_rep / 5.0

        affinity = (
            want_score * 0.30
            + value_score * 0.25
            + min_ok * 0.15
            + rating_score * 0.20
            + loc_score * 0.10
        )
        d['affinity_score'] = round(affinity, 4)
        result.append(d)

    result.sort(key=lambda x: x.get('affinity_score', 0), reverse=True)
    return result


def _enrich(item):
    """Add owner_reputation and owner_location shortcuts to item dict."""
    d = item.to_dict(include_owner=True)
    owner_data = d.get('owner') or {}
    d['owner_reputation'] = owner_data.get('reputation', 0.0)
    d['owner_location'] = owner_data.get('location', '')
    return d
