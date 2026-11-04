# ShoppyOS Engineering & Architectural Guide (CLAUDE.md)

### One Trunk Policy & Development Rules
- **Trunk Branch**: **`integration/local-all`** is the single source of truth and only working trunk.
- **Strict Prohibition**: Never branch from `main` or from `6f72dc8` (the old production commit). Any work branched from them reintroduces obsolete UI elements.
- **Safety**: Always commit or stash WIP before switching branches.
- **Diagnostics**: Print current branch (`git branch --show-current`) and short hash (`git rev-parse --short HEAD`) before beginning every task.
- **Branch Enforcement**: Guarded by `scripts/assert_branch.js` on every build, test, and dev run.

### Brand & Product Identity
- **Product Name**: **ShoppyOS** (domain `shoppyos.com`).
- **Brand Tokens**: Deep green (`#0F4D3A`), Marigold gold (`#F4A62A`), Chili red (`#D92D5A`), Paper white (`#FFFFFF`/`#F8FAF8`), Leaf green (`#1B7A5A`/`#3DB88A`).
- **Typography**: Display: *Bricolage Grotesque*; Body: *Instrument Sans*; Mono: *DM Mono*; Urdu: *Noto Nastaliq Urdu*. Zero external font CDNs (all self-hosted in `client/src/fonts/` & `@fontsource`).
- **Logo Component**: `<BrandLogo variant="symbol|horizontal|stacked|wordmark" tone="auto|dark|light|mono" size={...} />` uses outlined vector paths (0 font dependencies) and reacts dynamically to light/dark themes.

### Stack & Architecture
- **Backend**: Node.js (v20+), Express 4, Dual-driver database (`better-sqlite3` on SQLite and `pg` on PostgreSQL 16).
- **Frontend**: React 19, Vite 8, Lucide React, CSS variables.
- **Theming**: Scope A (Public: light/dark via `data-public-theme`), Scope B (Shop App: 4 active themes — `classic`, `dark`, `green`, `indigo` via `data-app-theme`).

### PostgreSQL 16 Connection & Concurrency Guidelines
1. **Connection Pool**: Default pool size is strictly **10** (configured via `DATABASE_POOL_SIZE=10`).
2. **Statement & Idle Timeouts**: `statement_timeout = 15000` (15s), `idle_in_transaction_session_timeout = 10000` (10s) prevent lock hoarding.
3. **Zero Fallback**: `DATABASE_URL` must be explicitly provided in production; missing URL causes instant fatal error.
4. **Quarantined Payments Policy**: Unlinked orphan payments without customer or supplier references are safely isolated into `legacy_unlinked_payments`. Cashbook drawers and daily summaries include them to maintain exact cash-in-drawer balance to the paisa (verified at ₨ 84.00, ₨ 0.00 delta), while party ledgers and customer balances strictly exclude them.
5. **Document Numbering**: Sequential counters for 6 document types per tenant per business day in `Asia/Karachi` (PKT, UTC+5) timezone. Roll over atomically at PKT midnight (19:00:00 UTC).

### Multi-Tenant Isolation Rules
1. **Source of Truth**: Business routes resolve tenant strictly via `tenantContext` middleware (`req.tenantId` and `req.tenant_id`).
2. **Zero Fallback**: Never fall back to `'latif_001'` in application code or controllers.
3. **Superowner Scoping**: Superowner operators must pass `x-tenant-id` header explicitly for tenant-scoped operations.
4. **Database Queries**: Every query accessing tenant tables must filter explicitly by `WHERE tenant_id = ?`.

### Database File Selection Rules
1. `DB_PATH` environment variable wins if explicitly configured.
2. If unset, fallback hierarchy: check for `shopos.db`, then `latif_traders.db`, defaulting to `shopos.db`.
3. In `production`, system refuses to boot if the target database is missing while other `.db` files exist in `DATA_DIR`, preventing accidental empty database creation.
4. Active database file name is logged on boot (name only).

### Essential Commands
- Start Development: `npm run dev`
- Run Production Rehearsal: `node server/scripts/run_production_rehearsal.js`
- Run Client Lint: `npm --prefix client run lint`
- Run Client Build: `npm --prefix client run build`
- Run Concurrency Drill: `node server/tests/concurrency_pool10_drill.test.js`
- Run Document Numbering Test: `node server/tests/document_numbering_pkt.test.js`
- Run Cashbook Quarantine Test: `node server/tests/cashbook_quarantine_parity.test.js`
- Clean Test Artifacts: `node server/scripts/clean_test_artifacts.js`

### Production Cutover & Rehearsal Runbooks
- Production Rehearsal Kit: See [`PRODUCTION_REHEARSAL.md`](file:///c:/Users/ALLAH/OneDrive/Documents/Projects/LATIF%20TRADERS/PRODUCTION_REHEARSAL.md)
- Postgres Cutover Guide: See [`POSTGRES_CUTOVER_RUNBOOK.md`](file:///c:/Users/ALLAH/OneDrive/Documents/Projects/LATIF%20TRADERS/POSTGRES_CUTOVER_RUNBOOK.md)
- Brand System Specs: See [`BRAND.md`](file:///c:/Users/ALLAH/OneDrive/Documents/Projects/LATIF%20TRADERS/BRAND.md)
