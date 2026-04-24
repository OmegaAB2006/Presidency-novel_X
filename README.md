# NOVELX — Exchange Platform

A full-stack item-trading platform with intelligent match scoring and reputation system.

```
Stack : Flask (Python) · React + Vite · SQLite · Tailwind CSS · JWT Auth
```

---

## Project Structure

```
exchange-platform/
├── backend/                    # Python / Flask API
│   ├── app.py                  # Server entry point, DB init
│   ├── models.py               # SQLAlchemy ORM models
│   ├── routes/
│   │   ├── auth.py             # /api/auth  — register, login, /me
│   │   ├── items.py            # /api/items — CRUD + marketplace
│   │   └── trades.py           # /api/trades — match, request, respond
│   └── services/
│       └── matching.py         # 3-stage matching algorithm
│
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── App.jsx             # Root component (auth, layout, routing)
│   │   ├── api.js              # Fetch wrapper for all API calls
│   │   ├── index.css           # Tailwind CSS entry
│   │   └── components/         # (legacy modals — superseded by App.jsx)
│   ├── vite.config.js          # Vite + Tailwind + proxy config
│   └── package.json
│
├── database/
│   ├── schema.sql              # Canonical SQL schema (reference)
│   └── seed.py                 # Demo data seeder
│
├── start.sh                    # One-command launcher
├── README.md                   # ← you are here
├── DOCS.md                     # Architecture + algorithm deep-dive
└── novelx.code-workspace       # VS Code multi-root workspace
```

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Python | 3.9+ | `python3 --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |

> No Docker or PostgreSQL required — SQLite is built into Python.

---

## Installation

### 1 — Install Python dependencies

```bash
pip3 install flask flask-sqlalchemy flask-jwt-extended \
             flask-cors flask-bcrypt psycopg2-binary pillow
```

### 2 — Install Node dependencies

```bash
cd frontend
npm install
cd ..
```

---

## Running the App

### Option A — One command (recommended)

```bash
bash start.sh
```

This script kills any stale processes, starts Flask on `:5000`,
starts Vite on `:3000`, and opens the browser automatically.

---

### Option B — Two terminals (manual)

**Terminal 1 — Backend**

```bash
cd backend
FLASK_APP=app.py python3 -m flask run --port 5000
```

**Terminal 2 — Frontend**

```bash
cd frontend
npm run dev
```

Then open **http://localhost:3000** in your browser.

---

## Seed Demo Data (optional)

```bash
python3 database/seed.py
```

Creates 3 demo accounts and 8 items.

| Email | Password |
|-------|----------|
| alice@test.com | password123 |
| bob@test.com | password123 |
| charlie@test.com | password123 |

---

## API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /api/auth/register | Create account | No |
| POST | /api/auth/login | Sign in, get JWT | No |
| GET  | /api/auth/me | Current user info | JWT |
| GET  | /api/items | My inventory | JWT |
| POST | /api/items | Add item (multipart) | JWT |
| DELETE | /api/items/:id | Remove item | JWT |
| GET  | /api/items/marketplace | Browse all items | JWT |
| GET  | /api/trades/matches/:itemId | Find matches for item | JWT |
| POST | /api/trades | Send trade request | JWT |
| GET  | /api/trades | My sent + received | JWT |
| PUT  | /api/trades/:id/respond | Accept or reject | JWT |
| POST | /api/trades/:id/rate | Leave rating | JWT |

---

## Stopping the App

```bash
pkill -f "flask run"
pkill -f "vite"
```

---

## Opening in VS Code

```bash
code novelx.code-workspace
```

The workspace opens four named panels: ROOT, FRONTEND, BACKEND, DATABASE.
