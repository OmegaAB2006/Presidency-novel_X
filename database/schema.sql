-- ============================================================
--  NOVELX Exchange Platform — Database Schema
--  Engine : SQLite 3 (file: backend/exchange.db)
--  ORM    : SQLAlchemy (models defined in backend/models.py)
--  This file is the canonical reference for all tables.
-- ============================================================

-- ── Users ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,          -- UUID v4
    username     TEXT UNIQUE NOT NULL,
    email        TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar       TEXT DEFAULT '',
    created_at   DATETIME DEFAULT (datetime('now'))
);

-- ── Items (Inventory) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
    id                  TEXT PRIMARY KEY,   -- UUID v4
    user_id             TEXT NOT NULL REFERENCES users(id),
    name                TEXT NOT NULL,
    description         TEXT DEFAULT '',
    category            TEXT NOT NULL,      -- indexed → Stage-1 filter
    condition           TEXT NOT NULL DEFAULT 'good',
    value_estimate      REAL DEFAULT 0.0,
    image_url           TEXT DEFAULT '',
    wanted_category     TEXT DEFAULT '',    -- what the owner wants back
    wanted_description  TEXT DEFAULT '',
    status              TEXT DEFAULT 'available', -- available | traded | reserved
    created_at          DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_status   ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_user     ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_cat_stat ON items(category, status); -- composite for Stage-1

-- ── Trade Requests ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_requests (
    id                  TEXT PRIMARY KEY,   -- UUID v4
    requester_id        TEXT NOT NULL REFERENCES users(id),
    requester_item_id   TEXT NOT NULL REFERENCES items(id),
    target_item_id      TEXT NOT NULL REFERENCES items(id),
    target_user_id      TEXT NOT NULL REFERENCES users(id),
    match_score         REAL NOT NULL DEFAULT 0.0,
    status              TEXT DEFAULT 'pending', -- pending | accepted | rejected | cancelled
    message             TEXT DEFAULT '',
    created_at          DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trades_requester ON trade_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_trades_target    ON trade_requests(target_user_id);
CREATE INDEX IF NOT EXISTS idx_trades_status    ON trade_requests(status);

-- ── Ratings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ratings (
    id         TEXT PRIMARY KEY,            -- UUID v4
    rater_id   TEXT NOT NULL REFERENCES users(id),
    ratee_id   TEXT NOT NULL REFERENCES users(id),
    trade_id   TEXT REFERENCES trade_requests(id),
    rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    TEXT DEFAULT '',
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ratings_ratee ON ratings(ratee_id);
