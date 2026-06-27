# Project Health Inspector — MVP Build Plan

## Context

We're building **Project Health Inspector** from scratch (the repo currently contains
only the spec PDF). It's a no-AI developer tool that ingests a source repo (GitHub URL
or ZIP upload — **with drag-and-drop**), runs a battery of static analyzers, scores the
project's health across six categories, and renders an interactive dashboard with an
architecture graph.

The spec's hard constraints shape the design:

- **No AI for detection** — but the pipeline must have a clean seam where an AI
  *explanation* layer drops in later (`Analyzer → Issues → [AI Explanation] → Report`).
- Every issue has a fixed shape: `category, severity, issue, rootCause, impact,
  solution, file, line?`.
- Overall score is weighted: Architecture 20%, Code Quality 20%, Security 20%,
  Dependencies 15%, Documentation 10%, Maintainability 15%.

**Decisions locked in:** MySQL for report persistence · two separate folders
(`/frontend`, `/backend`) · all 10 analyzers built up front · **user accounts now in
scope** — login, registration, and forgot/reset password (the spec parks these for "later",
but the user has pulled them into the MVP). Reports become owned by a user.

The whole design hangs off **three real seams** (each has 2+ adapters, so each earns its
keep per the deletion test) plus one **future-facing seam** the spec demands.

---

## Architecture: the seams

```
                          POST /api/analyze
                                 │
                    ┌────────────▼─────────────┐
                    │   Inspector (orchestrator)│   ← deepest module
                    └────────────┬─────────────┘
        materialize │            │ build              │ enrich + score + store
        ┌───────────▼──┐   ┌─────▼──────┐      ┌──────▼─────────┐
        │RepositorySource│  │AnalysisCtx │      │ExplanationProv │
        │  (SEAM #1)    │   │  (shared   │      │   (SEAM #4,    │
        │ github | zip  │   │   dep)     │      │  future AI)    │
        └───────────────┘   └─────┬──────┘      └────────────────┘
                                  │ passed to every analyzer
                    ┌─────────────▼──────────────┐
                    │   Analyzer (SEAM #2)        │  10 adapters
                    │  analyze(ctx) → Issue[]     │
                    └─────────────────────────────┘
                                  │ issues
                    ┌─────────────▼──────────────┐
                    │ HealthScorer (pure fn)      │ → ReportStore (SEAM #3, MySQL)
                    └─────────────────────────────┘
```

### Seam #1 — `RepositorySource` (real: 2 adapters)
A small interface that hides *how* code arrives:
```ts
interface RepositorySource {
  materialize(): Promise<RepoHandle>;   // RepoHandle = { rootDir; cleanup(): Promise<void> }
}
```
- `GitHubCloneSource` — shallow clone via **simple-git** into a temp dir.
- `ZipUploadSource` — extract uploaded ZIP buffer to a temp dir (yauzl/adm-zip).

Deep: callers never touch git or zip internals; both yield a local `rootDir` + cleanup.
The deletion test: remove this and clone/extract logic spreads into every caller.

### Seam #2 — `Analyzer` (real: 10 adapters)
The core of the spec. One method, fixed output shape:
```ts
interface Analyzer {
  readonly category: Category;          // which score bucket its issues fall into
  analyze(ctx: AnalysisContext): Promise<Issue[]>;
}
```
All ten satisfy this and are registered in one array — adding the future AI-assisted
analyzer or a new rule means one new file, zero orchestrator changes.

The **`AnalysisContext`** is the shared dependency (accept deps, don't create them — the
testability lever). Built **once** by the Inspector, passed to every analyzer:
```ts
interface AnalysisContext {
  rootDir: string;
  project: Project;                 // ts-morph Project (TS/TSX parsed once)
  sourceFiles: SourceFile[];        // ts-morph source files
  allFiles: string[];               // every path incl. non-TS (md, json, env)
  packageJson?: PackageJson;
  readme?: string;
  envFiles: { name: string; content: string }[];
  config: AnalysisConfig;           // thresholds: maxFileLines=1000, maxFnLines=100, ...
}
```
A test builds a context over a fixture dir and asserts the returned `Issue[]` — the
interface *is* the test surface.

### Seam #3 — `ReportStore` (real: MySQL + in-memory fake for tests)
```ts
interface ReportStore {
  save(report: HealthReport): Promise<void>;
  get(id: string): Promise<HealthReport | null>;
  list(): Promise<ReportSummary[]>;
}
```
- `MySqlReportStore` — single `reports` table, full report JSON in a column + indexed
  summary columns (id, createdAt, source, overallScore). Avoids over-normalizing nested
  issues for the MVP.
- `InMemoryReportStore` — the second adapter that makes the seam real and the API testable.

### Seam #4 — `ExplanationProvider` (future AI, build the static adapter now)
The spec's "AI Explanation Layer". One adapter today = a hypothetical seam, but the spec
mandates designing for it, so we build the seam + the trivial adapter:
```ts
interface ExplanationProvider {
  enrich(issues: Issue[], ctx: AnalysisContext): Promise<Issue[]>;
}
```
- `StaticExplanationProvider` (MVP) — pass-through; analyzers already fill
  `rootCause/impact/solution` from rule templates. **AI never detects.**
- *Future:* `LLMExplanationProvider` (Ollama/Gemini/Groq) swaps in behind the same method.

### Seam #5 — `AuthService` (deep module behind a small interface)
All account behaviour hides behind one service so routes stay thin and the rules
(hashing, token lifetimes, reset flow) live in one place — fix once, fixed everywhere:
```ts
interface AuthService {
  register(email: string, password: string): Promise<AuthResult>;   // AuthResult = { user; token }
  login(email: string, password: string): Promise<AuthResult>;
  requestPasswordReset(email: string): Promise<void>;               // emails a reset token
  resetPassword(resetToken: string, newPassword: string): Promise<void>;
  verify(token: string): Promise<AuthUser>;                         // for requireAuth middleware
}
```
Hidden inside: **bcrypt** password hashing, **JWT** issuing/verification, single-use
time-boxed reset tokens (hashed at rest in the DB), and consistent responses so the
forgot-password path never reveals whether an email exists. Deletion test: remove it and
hashing/JWT/reset logic smears across every route handler.

Depends on two collaborators (accept deps, don't create them — both injected):
- **`UserStore` (MySQL)** — `users` + `password_resets` tables; mirrors the `ReportStore`
  pattern, with an `InMemoryUserStore` fake for tests.
- **Seam #6 — `Mailer`** (real: 2 adapters) — `send({ to, subject, body })`:
  - `ConsoleMailer` (MVP default) — logs the reset link to stdout, so forgot-password works
    with **zero email config**.
  - `SmtpMailer` (nodemailer) — drop-in for real delivery later.

`requireAuth` middleware calls `AuthService.verify` and attaches `req.user`; the
`/api/analyze` and `/api/reports*` routes sit behind it, and reports are stamped with
`userId` (this is what turns persistence multi-user).

### The Inspector (deepest module, smallest interface)
```ts
class Inspector {
  inspect(source: RepositorySource): Promise<HealthReport>;
}
```
Hides the entire pipeline: materialize → build context → run all analyzers (parallel,
fault-isolated so one analyzer crashing doesn't sink the report) → `enrich` → `score` →
build architecture graph → assemble → `store`. Massive behaviour, one method.

### `HealthScorer` (pure function — returns results, no side effects)
```ts
function score(issues: Issue[]): { overall: number; categories: Record<Category, number> }
```
Each category starts at 100; subtract per-severity penalties (critical/high/medium/low);
floor at 0; overall = weighted sum using the spec's weights. Deterministic → unit-testable
in isolation.

---

## The 10 Analyzers (all built up front, each a deep module behind Seam #2)

| Analyzer | Score category | Detects (from spec) | Primary tooling |
|---|---|---|---|
| `ArchitectureAnalyzer` | Architecture | Circular deps, deep import chains | **madge** + ts-morph import graph |
| `ProjectStructureAnalyzer` | Architecture | Huge folders, poor org, excessive nesting | fs walk over `allFiles` |
| `CodeQualityAnalyzer` | Code Quality | Large files (>1000 LOC), large functions (>100 LOC), duplicate blocks | ts-morph |
| `DeadCodeAnalyzer` | Code Quality | Unused functions/components/utils/files | ts-morph reference graph |
| `TypeScriptAnalyzer` | Code Quality | Excessive `any`, missing interfaces, weak typing | ts-morph / TS type checker |
| `ReactAnalyzer` | Maintainability | Large components, prop drilling, missing keys, deep trees | ts-morph (JSX) |
| `SecurityAnalyzer` | Security | Hardcoded secrets, weak JWT secrets, SQL-injection patterns | regex + ts-morph string literals |
| `EnvironmentAnalyzer` | Security | Missing / duplicate / unused env vars (`.env` vs `.env.example`) | dotenv parse |
| `DependencyAnalyzer` | Dependencies | Unused, outdated, heavy deps | package.json + import scan |
| `DocumentationAnalyzer` | Documentation | README sections: install, usage, features, screenshots, API | markdown section scan |

Each analyzer owns its rule templates that fill `rootCause / impact / solution` — this is
where the spec's "explain root causes / suggest fixes" lives, deterministically, no AI.

> **Maintainability** score draws from `ReactAnalyzer` plus large-file/large-function
> signals; the `category` field on each `Issue` (not the analyzer name) decides the bucket,
> so scoring stays a simple group-by.

---

## Frontend (React + TS + Tailwind + React Flow + Recharts)

### Upload — including drag-and-drop (explicitly requested)
`UploadPanel` combines both input modes feeding one endpoint:
- **GitHub URL** text field → `POST /api/analyze` (JSON body).
- **ZIP drag-and-drop** zone → `POST /api/analyze` (multipart). Built on **react-dropzone**
  (deep module: hides drag events, hover state, file-type validation, click-to-browse
  behind a tiny hook). Visual states: idle · drag-over (highlight) · file-selected ·
  uploading (progress) · error (wrong type / too large). Accepts `.zip` only.

### Dashboard
- **Overview row** — overall health score gauge (Recharts radial) + critical/high/
  medium/low count chips.
- **Category scores** — six cards / radar chart (Recharts) for Architecture, Code Quality,
  Security, Dependencies, Documentation, Maintainability.
- **Issue list** — grouped by category, filterable by severity; each row shows
  issue/severity/file/line and expands to rootCause/impact/solution (the spec's Report
  Format).
- **Architecture Visualization** — **React Flow** interactive graph
  (Controller → Service → Repository → Database) built from the report's
  `architectureGraph { nodes, edges }`.

---

## Shared types across the two folders

Since frontend and backend are separate folders, the canonical `Issue` / `HealthReport` /
`Category` types live in `backend/src/types/contract.ts` and are **mirrored** to
`frontend/src/types/contract.ts`. A tiny `npm run sync-types` script copies the file so the
seam stays single-source. (Noted as the cost of the separate-folders choice vs. a shared
workspace package.)

---

## Files to create

**Backend** (`/backend`)
```
src/
  index.ts                       # Express bootstrap
  routes/analyze.ts              # POST /api/analyze (url|zip), GET /api/reports/:id, GET /api/reports — behind requireAuth
  routes/auth.ts                 # POST /register, /login, /forgot-password, /reset-password
  auth/AuthService.ts            # Seam #5 interface + JwtAuthService (bcrypt + JWT + reset tokens)
  auth/requireAuth.ts            # middleware → req.user
  auth/UserStore.ts              # interface + MySqlUserStore + InMemoryUserStore
  mail/Mailer.ts                 # Seam #6 interface + ConsoleMailer + SmtpMailer
  inspector/Inspector.ts         # orchestrator (Seam users)
  sources/RepositorySource.ts    # Seam #1 interface
  sources/GitHubCloneSource.ts
  sources/ZipUploadSource.ts
  context/buildContext.ts        # constructs AnalysisContext (ts-morph Project, file walk, env, readme)
  analyzers/Analyzer.ts          # Seam #2 interface
  analyzers/*.ts                 # the 10 analyzers + registry.ts
  explanation/ExplanationProvider.ts   # Seam #4 + StaticExplanationProvider.ts
  scoring/HealthScorer.ts        # pure scorer
  graph/buildArchitectureGraph.ts# React Flow nodes/edges from import graph
  store/ReportStore.ts           # Seam #3 + MySqlReportStore.ts + InMemoryReportStore.ts
  types/contract.ts              # canonical shared types
  config/defaults.ts             # thresholds + score weights
test/
  fixtures/<sample-repos>/       # repos with known planted issues
  analyzers/*.test.ts            # one per analyzer, asserts Issue[] over a fixture
  scoring/HealthScorer.test.ts   # pure unit tests
  inspector/Inspector.test.ts    # full pipeline over a fixture (InMemoryReportStore)
```

**Frontend** (`/frontend`)
```
src/
  App.tsx                        # routes; gates dashboard behind auth
  auth/AuthContext.tsx           # holds JWT (localStorage) + current user; attaches token to api calls
  pages/Login.tsx                # login + register
  pages/ForgotPassword.tsx       # request reset
  pages/ResetPassword.tsx        # consume reset token from link
  api/client.ts                  # analyze() + getReport() + auth calls (sends Bearer token)
  components/ProtectedRoute.tsx  # redirects to /login when unauthenticated
  components/UploadPanel.tsx     # URL field + drag-and-drop zone (react-dropzone)
  components/Dashboard.tsx
  components/ScoreGauge.tsx      # Recharts
  components/CategoryScores.tsx  # Recharts radar/cards
  components/IssueList.tsx
  components/ArchitectureGraph.tsx # React Flow
  types/contract.ts             # mirror of backend contract
```

---

## Build sequence

1. **Scaffold** both folders (Vite React-TS + Tailwind; Express + TS), shared `contract.ts`,
   `config/defaults.ts`.
2. **Seam #1 + context** — `RepositorySource` adapters + `buildContext` (ts-morph). Prove a
   repo can be materialized and parsed.
3. **Seam #2 — all 10 analyzers** + registry, each with a fixture test.
4. **Scorer + graph + Seam #4 static** — assemble `HealthReport`.
5. **Inspector** wires it end-to-end; **Seam #3** MySQL store + in-memory fake.
6. **Auth** — Seam #5 `AuthService` (bcrypt/JWT/reset) + `UserStore` + Seam #6 `Mailer`
   (ConsoleMailer), `requireAuth` middleware, `/api/auth/*` routes.
7. **API routes** (`/api/analyze` url + multipart zip, `/api/reports`) behind `requireAuth`,
   reports stamped with `userId`.
8. **Frontend** — auth pages (login/register/forgot/reset) + AuthContext + ProtectedRoute,
   then UploadPanel (incl. drag-and-drop), Dashboard, charts, React Flow graph.
9. **DB** — MySQL `reports`, `users`, `password_resets` tables + connection config.

---

## Verification (end-to-end)

- **Unit:** `cd backend && npm test` — each analyzer asserts the exact `Issue[]` it produces
  over a planted-issue fixture; `HealthScorer` verified against hand-computed weighted
  scores; `Inspector` runs the full pipeline against a fixture using `InMemoryReportStore`.
- **Auth flow:** register → login returns a JWT; calling `/api/analyze` without the Bearer
  token returns 401, with it succeeds. `POST /api/auth/forgot-password` prints a reset link
  via `ConsoleMailer`; `POST /api/auth/reset-password` with that token sets a new password
  and old credentials stop working. Unit tests use `InMemoryUserStore` + a fake `Mailer`.
- **API smoke:** start backend, authenticate, `POST /api/analyze` with a known public GitHub URL → expect
  a `HealthReport` with non-empty `issues`, six category scores, an `architectureGraph`, and
  a persisted id retrievable via `GET /api/reports/:id`.
- **ZIP + drag-and-drop:** in the running frontend, drag a `.zip` onto `UploadPanel` →
  confirm drag-over highlight, upload, and dashboard render; repeat via the GitHub URL field.
- **Dashboard:** confirm gauge, severity counts, six category cards, expandable issue rows
  (rootCause/impact/solution), and an interactive React Flow graph.
- **AI-seam check (design-only):** confirm swapping `StaticExplanationProvider` for a stub
  `LLMExplanationProvider` requires no analyzer or Inspector changes — the seam holds.
```
