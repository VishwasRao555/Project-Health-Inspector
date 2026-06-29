# Project Health Inspector

A developer tool that analyzes a source repository (GitHub URL **or** ZIP upload, with
drag-and-drop) and produces a health report: architecture, code quality, security,
dependencies, documentation, and maintainability — each scored, with root causes and
suggested fixes. **No AI is used for detection**; a clean seam is reserved for a future
AI *explanation* layer.


## Stack

- **Backend** (`/backend`): Node + Express + TypeScript, ts-morph for analysis,
  simple-git + adm-zip for ingestion, MySQL (optional) for persistence, JWT auth.
- **Frontend** (`/frontend`): React + TypeScript + Tailwind, React Flow (architecture
  graph), Recharts (scores), react-dropzone (drag-and-drop upload).

## Installation

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # optional — runs with in-memory stores if DB is unset
npm run dev                 # http://localhost:4000
```

- **Without MySQL**: leave `DB_*` unset. Users/reports live in memory and reset on
  restart — perfect for a demo.
- **With MySQL**: set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, then
  `npm run db:init` to create the `users`, `password_resets`, and `reports` tables.
- **Email**: leave `SMTP_*` unset and password-reset links print to the server console
  (ConsoleMailer). Set `SMTP_*` for real delivery.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

Open http://localhost:5173, create an account, then paste a public GitHub URL or drop a
project `.zip` to run an inspection.

## Tests

```bash
cd backend && npm test      # analyzers, pure scorer, full Inspector pipeline
```

## How it fits together

```
Upload (URL | ZIP)  →  RepositorySource  →  AnalysisContext (ts-morph, files, env, pkg)
   →  10 Analyzers (parallel, fault-isolated)  →  Issues
   →  ExplanationProvider (static today; AI later)  →  HealthScorer  →  Architecture graph
   →  HealthReport  →  ReportStore (MySQL | in-memory)  →  Dashboard
```

All routes except `/api/auth/*` require a Bearer token; reports are owned per user.
