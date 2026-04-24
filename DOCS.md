# NOVELX — Architecture, Algorithm & Complexity Analysis

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Backend — Flask API](#2-backend--flask-api)
3. [Database — Schema & Indexes](#3-database--schema--indexes)
4. [Frontend — React SPA](#4-frontend--react-spa)
5. [Authentication Flow](#5-authentication-flow)
6. [The Matching Algorithm](#6-the-matching-algorithm)
7. [Time Complexity — Full Derivation](#7-time-complexity--full-derivation)
8. [Reputation System](#8-reputation-system)
9. [Request Lifecycle (end-to-end)](#9-request-lifecycle-end-to-end)
10. [Data Flow Diagram](#10-data-flow-diagram)

---

## 1. System Architecture

```
Browser (React SPA)
        │  HTTP (port 3000)
        ▼
  Vite Dev Server  ──proxy /api──►  Flask API (port 5000)
                                         │
                                         ├── JWT Auth Middleware
                                         ├── Routes (auth / items / trades)
                                         ├── Services (matching engine)
                                         └── SQLAlchemy ORM
                                                   │
                                             SQLite Database
                                           (backend/exchange.db)
```

**Why this split?**
- Vite proxies all `/api` requests to Flask, so the browser never
  talks to Flask directly. This avoids CORS issues and IPv6/IPv4
  mismatches on macOS (localhost resolves to ::1 but Flask binds
  to 127.0.0.1).
- SQLite needs zero server setup, making the project portable.
  The ORM (SQLAlchemy) can switch to PostgreSQL by changing one
  config line.

---

## 2. Backend — Flask API

### File map

```
backend/
 app.py              — creates Flask app, registers blueprints,
                        initialises DB tables on first run
 models.py           — four SQLAlchemy models: User, Item,
                        TradeRequest, Rating
 routes/
   auth.py           — /api/auth/* (register, login, /me)
   items.py          — /api/items/* (CRUD + marketplace listing)
   trades.py         — /api/trades/* (match, create, respond, rate)
 services/
   matching.py       — the core matching algorithm
```

### Blueprints

Each route file is a Flask Blueprint registered in `app.py`:

```python
app.register_blueprint(auth_bp,   url_prefix='/api/auth')
app.register_blueprint(items_bp,  url_prefix='/api/items')
app.register_blueprint(trades_bp, url_prefix='/api/trades')
```

Blueprints keep each domain isolated and independently testable.

### JWT Authentication

Every protected endpoint uses the `@jwt_required()` decorator.
Flask-JWT-Extended validates the `Authorization: Bearer <token>`
header and exposes `get_jwt_identity()` which returns the user's
UUID string.

Token lifetime: **15 minutes** (configurable in app.py).

---

## 3. Database — Schema & Indexes

### Tables

```
users
 id (PK, UUID)  username  email  password_hash  avatar  created_at

items
 id (PK, UUID)  user_id (FK)  name  description  category  condition
 value_estimate  image_url  wanted_category  wanted_description
 status  created_at

trade_requests
 id (PK, UUID)  requester_id (FK)  requester_item_id (FK)
 target_item_id (FK)  target_user_id (FK)  match_score
 status  message  created_at

ratings
 id (PK, UUID)  rater_id (FK)  ratee_id (FK)  trade_id (FK)
 rating (1-5)  comment  created_at
```

### Index Strategy

```sql
-- items — used by Stage-1 of the matching algorithm
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_status   ON items(status);
CREATE INDEX idx_items_cat_stat ON items(category, status); -- composite

-- trade_requests — used by trade listing queries
CREATE INDEX idx_trades_requester ON trade_requests(requester_id);
CREATE INDEX idx_trades_target    ON trade_requests(target_user_id);

-- ratings — used by reputation calculation
CREATE INDEX idx_ratings_ratee   ON ratings(ratee_id);
```

The composite index `(category, status)` is the most important.
SQLite can satisfy the Stage-1 WHERE clause entirely from the index
without touching the table rows — this is called a **covering scan**
and runs in O(log n) instead of O(n).

---

## 4. Frontend — React SPA

### Component Hierarchy

```
App.jsx  (auth state, user session, panel routing)
 ├── AuthModal          — login / register overlay
 ├── InventoryDrawer    — slide-in panel for my items
 │    └── AddItemModal  — 2-step form (item details → what I want)
 ├── TradesPanel        — slide-in panel for sent/received trades
 └── TradeModal         — select item to offer, send request
```

### State management

No Redux or external store. State lives in the component that owns
it and is passed down via props or triggered via callbacks:

- `user` — set after login, cleared on logout
- `marketItems` — fetched from `/api/items/marketplace`
- `myItems` — fetched from `/api/items` (my inventory)
- `pendingCount` — polled every 15 s from `/api/trades`
- `panel` — `'inventory' | 'trades' | null` (which drawer is open)
- `tradeTarget` — the item the user clicked "Request Trade" on

### Vite Proxy

`vite.config.js` forwards every request starting with `/api` or
`/uploads` to `http://127.0.0.1:5000`. The frontend code uses
relative paths (`/api/...`), so no hardcoded host names appear in
source.

### Tailwind CSS v4

The project uses Tailwind CSS v4 with the `@tailwindcss/vite`
plugin. The entire CSS entry point is one line:

```css
@import "tailwindcss";
```

All styling is done with utility classes in JSX — no separate
`.css` files are needed.

---

## 5. Authentication Flow

```
User submits login form
        │
        ▼
POST /api/auth/login
        │
Flask-Bcrypt compares submitted password with stored hash
        │
        ├─ FAIL ──► 401 {"error": "Invalid credentials"}
        │
        └─ PASS ──► create_access_token(identity=user.id)
                             │
                    200 {"token": "<JWT>", "user": {...}}
                             │
                    Frontend stores token in localStorage
                             │
                    Every subsequent request adds header:
                    Authorization: Bearer <JWT>
```

Password hashing uses **bcrypt** with a work factor of 12 rounds.
Bcrypt is intentionally slow (≈100 ms) to make brute-force attacks
computationally infeasible.

---

## 6. The Matching Algorithm

File: `backend/services/matching.py`

The algorithm finds items in the marketplace that are most
compatible with the item a user wants to trade away.

### Inputs

- `user_id`  — the requesting user (to exclude their own items)
- `item_id`  — the item they want to trade
- `limit`    — max results to return (default 20)

### Three Stages

```
┌─────────────────────────────────────────────────────┐
│  Stage 1 — Database Filter                          │
│  ─────────────────────────                          │
│  SELECT * FROM items                                │
│  WHERE  category = ?           ← indexed            │
│    AND  status   = 'available' ← indexed            │
│    AND  user_id  != ?          ← excludes requester │
│  LIMIT 2000                                         │
│                                                     │
│  Result: candidate pool C  (size ≤ 2000)            │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  Stage 2 — Score Each Candidate                     │
│  ───────────────────────────                        │
│  For every candidate c in C:                        │
│    score = value_score  × 0.40                      │
│           + cond_score  × 0.30                      │
│           + want_score  × 0.20                      │
│           + rep_bonus   × 0.10                      │
│                                                     │
│  Result: list of (candidate, score)                 │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  Stage 3 — Sort and Slice                           │
│  ──────────────────────                             │
│  sorted(candidates, key=score, reverse=True)        │
│  return first `limit` items                         │
└─────────────────────────────────────────────────────┘
```

### Scoring Components (Stage 2)

#### A. Value Score (weight 40%)

Measures how close the two items are in estimated monetary value.

```
value_score = 1 - |user_value - candidate_value|
                  ─────────────────────────────
                    max(user_value, candidate_value)
```

Example:
```
User item    : $150
Candidate    : $120
|150 - 120|  : 30
max(150,120) : 150
value_score  = 1 - 30/150 = 1 - 0.20 = 0.80
```

A perfect value match gives `value_score = 1.0`.
A candidate worth 0 against an item worth $1000 gives 0.0.

#### B. Condition Score (weight 30%)

Each condition maps to an integer rank:

```
like_new=5  excellent=4  good=3  fair=2  poor=1
```

```
cond_score = 1 - |rank(user) - rank(candidate)|
                 ────────────────────────────
                             4            ← max possible difference
```

Example — user has "good" (3), candidate is "excellent" (4):
```
cond_score = 1 - |3 - 4| / 4 = 1 - 0.25 = 0.75
```

Same condition always gives `cond_score = 1.0`.

#### C. Want Alignment Score (weight 20%)

Checks whether the candidate's owner explicitly wants what the
requester's item is categorised as.

```python
if candidate.wanted_category == user_item.category:
    want_score = 1.0          # exact match
elif candidate.wanted_category in user_item.category:
    want_score = 0.6          # partial match
else:
    want_score = 0.0          # no match
```

This is the "mutual desire" signal — it rewards trades where both
parties actually want what the other has.

#### D. Reputation Bonus (weight 10%)

The requester's own average star rating boosts their offer
slightly, incentivising good trading behaviour.

```
rep_bonus = (clamp(reputation, 1, 5) - 1) / 4
```

A reputation of 5.0 → bonus = 1.0
A reputation of 1.0 → bonus = 0.0
New users start with reputation 5.0 (no ratings yet) → full bonus.

#### Final Score

```
match_score = value_score × 0.40
            + cond_score  × 0.30
            + want_score  × 0.20
            + rep_bonus   × 0.10

Range: [0.0, 1.0]   displayed as 0% – 100%
```

#### Worked Example

User's item: Bicycle  |  category=sports, condition=good, value=$150
Candidate:  Skateboard | category=sports, condition=good, value=$120
Requester reputation: 4.5 stars

```
value_score = 1 - |150-120| / 150  = 1 - 0.20  = 0.80
cond_score  = 1 - |3-3|     / 4    = 1 - 0.00  = 1.00
want_score  = 0.0   (Skateboard owner wants "electronics", not "sports")
rep_bonus   = (4.5 - 1) / 4        = 3.5 / 4   = 0.875

match_score = 0.80×0.40 + 1.00×0.30 + 0.00×0.20 + 0.875×0.10
            = 0.320     + 0.300     + 0.000     + 0.0875
            = 0.7075  →  71%
```

---

## 7. Time Complexity — Full Derivation

Let:
- **N** = total items in the database
- **C** = candidate pool size after Stage-1 filter  (C ≤ min(N, 2000))
- **K** = results requested (default 20)

### Stage 1 — Database Filter

```
O(log N)
```

SQLite uses a B-tree index on `(category, status)`.
A B-tree search on N rows takes O(log N) comparisons to reach the
first matching leaf, then O(C) to scan the matching rows.
Because C is capped at 2000, the scan is bounded:

```
Stage 1 total = O(log N + C)  ≈  O(log N)  for large N
```

Without the index, a full table scan would cost O(N).

### Stage 2 — Scoring

```
O(C)
```

Each candidate is scored with four arithmetic operations — all O(1).
Across C candidates: **O(C)**.

Since C ≤ 2000 (a constant cap), Stage 2 is effectively O(1)
regardless of database size. Even without the cap, it grows
linearly with the candidate pool, not the full database.

### Stage 3 — Sort

```
O(C log C)
```

Python's built-in sort (`list.sort`) uses Timsort — O(n log n)
average and worst case. Applied to C candidates:

```
Stage 3 = O(C log C)
```

With C ≤ 2000: O(2000 × log 2000) = O(2000 × 11) ≈ O(22,000)
— effectively constant regardless of database size.

### Full Pipeline

```
T(N, C) = O(log N)  +  O(C)  +  O(C log C)
           Stage 1     Stage 2     Stage 3
```

Since C is bounded by a constant cap (2000):

```
T(N) = O(log N)  +  O(1)  +  O(1)
     = O(log N)
```

**The algorithm scales logarithmically with the total number of
items in the database.** Doubling the database size adds only one
additional comparison in Stage 1.

### Comparison table

| Approach | Complexity | N=1,000 | N=1,000,000 | N=1,000,000,000 |
|----------|-----------|---------|-------------|-----------------|
| Naive full scan | O(N) | 1,000 | 1,000,000 | 1,000,000,000 |
| Index + cap (this system) | O(log N) | ~10 | ~20 | ~30 |

### Why the cap at 2000?

Without it, Stage 2 would be O(N) in the worst case (if every item
is in the same category). The cap converts the worst case from
O(N log N) to O(log N + 2000 × 11) ≈ O(log N), at the cost of
possibly missing some good matches ranked below position 2000.
In practice, categories contain far fewer than 2000 items.

### Space Complexity

- Stage 1 materialises at most C rows into memory: **O(C)**
- Stage 2 builds a list of C scored dicts: **O(C)**
- Stage 3 sorts in place: **O(C)** (Timsort uses O(n) extra space)

Total memory: **O(C)** ≈ O(2000) — constant.

---

## 8. Reputation System

Every accepted trade can be rated 1–5 stars.
The reputation score is the simple mean of all ratings received:

```
reputation(user) = Σ ratings_received / count(ratings_received)
```

New users with no ratings receive a default reputation of **5.0**
(full trust) so they aren't penalised at the start.

The reputation contributes 10% to the match score (see Section 6D).
It also signals to other users how reliable a trader someone is.

**Database query:**

```sql
SELECT AVG(rating) FROM ratings WHERE ratee_id = ?
```

This hits the `idx_ratings_ratee` index — O(log R + r) where R is
total ratings and r is ratings for this user.

---

## 9. Request Lifecycle (end-to-end)

### "Request Trade" button click

```
1. User clicks "Request Trade" on a marketplace card
2. TradeModal opens — user selects one of their own items to offer
3. User optionally adds a message and clicks "Send Request"

4. Frontend:  POST /api/trades
              Body: { requester_item_id, target_item_id, message }
              Header: Authorization: Bearer <JWT>

5. Vite proxy forwards to Flask at 127.0.0.1:5000

6. Flask /api/trades (POST):
   a. JWT middleware validates token, extracts user ID
   b. Verify requester_item belongs to this user
   c. Verify target_item is available and not owned by this user
   d. Run matching algorithm to compute match_score
   e. INSERT into trade_requests table
   f. Return 201 { trade_id, match_score, ... }

7. Frontend shows success screen inside the modal

8. Target user's bell icon shows a badge (polled every 15 s)
9. Target user opens Trades panel, sees pending request
10. Target user clicks Accept:
    PUT /api/trades/:id/respond  { action: "accept" }
    Flask:
      a. Sets trade status = 'accepted'
      b. Sets both items status = 'traded'
      c. Cancels all other pending trades for these items
    Return 200 { updated trade }

11. Either user can now leave a star rating (POST /api/trades/:id/rate)
    which updates the other user's reputation score
```

---

## 10. Data Flow Diagram

```
                   ┌──────────────────────────────┐
                   │         BROWSER               │
                   │                               │
                   │  ┌──────────┐  ┌──────────┐  │
                   │  │  React   │  │LocalStore│  │
                   │  │  State   │  │(JWT token│  │
                   │  └─────┬────┘  └────┬─────┘  │
                   └────────┼────────────┼─────────┘
                            │fetch       │header
                   ┌────────▼────────────▼─────────┐
                   │      VITE DEV SERVER :3000      │
                   │        (proxy /api →)           │
                   └────────────────┬────────────────┘
                                    │
                   ┌────────────────▼────────────────┐
                   │        FLASK API :5000           │
                   │                                  │
                   │  JWT Middleware                   │
                   │       │                          │
                   │  ┌────▼──────────────────────┐  │
                   │  │  Routes                    │  │
                   │  │  /auth  /items  /trades    │  │
                   │  └────────────┬───────────────┘  │
                   │               │                  │
                   │  ┌────────────▼───────────────┐  │
                   │  │  Matching Engine            │  │
                   │  │  (services/matching.py)     │  │
                   │  └────────────┬───────────────┘  │
                   │               │                  │
                   │  ┌────────────▼───────────────┐  │
                   │  │  SQLAlchemy ORM             │  │
                   │  └────────────┬───────────────┘  │
                   └───────────────┼──────────────────┘
                                   │
                   ┌───────────────▼──────────────────┐
                   │        SQLite Database             │
                   │  users │ items │ trades │ ratings  │
                   │  (backend/exchange.db)             │
                   └───────────────────────────────────┘
```

---

## Quick Reference — Algorithm Weights

| Component | Signal | Weight | Formula |
|-----------|--------|--------|---------|
| Value Score | Monetary closeness | 40% | `1 - |Δvalue| / max_value` |
| Condition Score | Physical state match | 30% | `1 - |Δrank| / 4` |
| Want Alignment | Mutual desire | 20% | `1.0` exact / `0.6` partial / `0.0` none |
| Reputation Bonus | Trust score | 10% | `(rep - 1) / 4` |

## Quick Reference — Complexity Summary

| Stage | Operation | Complexity |
|-------|-----------|------------|
| 1 | B-tree index lookup + row scan | O(log N + C) |
| 2 | Score C candidates | O(C) |
| 3 | Timsort C items | O(C log C) |
| **Total** | **C bounded by cap** | **O(log N)** |
| Space | Candidate list in memory | O(C) |
