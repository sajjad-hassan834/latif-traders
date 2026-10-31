# ShopOS Engineering & Architectural Guide (CLAUDE.md)

### Stack & Architecture
- **Backend**: Node.js (v20+), Express 4, SQLite (`better-sqlite3`, WAL mode) in production (Railway).
- **Frontend**: React 19, Vite 8, Lucide React, CSS variables.
- **Theming**: Scope A (Public: light/dark via `data-public-theme`), Scope B (Shop App: 4 active themes — `classic`, `dark`, `green`, `indigo` via `data-app-theme`).

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

### Security Release & Branching Rules
1. `release/security-batch1`: Contains pure SQLite security hardening (Batch 1/1b) decoupled from Postgres migrations.
2. `feature/postgres-migration`: Contains Stage A dual-driver code and Postgres migrations (`pg_schema.sql`, `database-pg.js`).
3. Never merge Postgres code into `main` until Stage C staging cut-over rehearsals are signed off.

### Core Safety Rules
1. Never execute migrations, seed scripts, or write commands against the live production database.
2. Never print secrets, passwords, hashes, JWTs, or customer row-level data in logs, terminal, or chat.
3. Never commit `.env`, `*.db`, `*.sqlite`, backups, snapshots, or builds to git.
4. All database migrations on the SQLite path must be strictly additive and idempotent.

### Essential Commands
- Start Development: `npm run dev`
- Run Client Lint: `npm --prefix client run lint`
- Run Client Build: `npm --prefix client run build`
- Run Security Tests: `node server/tests/security_batch1.test.js && node --test server/tests/security_batch1b_*.test.js`
- Run Static Security Audits: `node server/scripts/verify_route_coverage.js && node server/scripts/verify_tenant_queries.js && node server/scripts/ci_grep_legacy_tenant.js`
- Rotate Credentials: `node server/scripts/rotate_credentials.js --user <username> --yes`
- Disable Legacy Superowner: `node server/scripts/rotate_credentials.js --disable-legacy-superowner --yes`

### Current Status (Release Security-Batch1)
1. Branch `release/security-batch1` created cleanly from `main` (6f72dc8).
2. All 14 security hardening commits cherry-picked in order with SQLite-only adaptations.
3. Zero Postgres dependencies (`database-pg.js`, `sqlTokenizer`, `::text` casts eliminated).
4. All 117 Express routes audited with 100% security coverage.
5. All 341 SQL tenant queries enforce tenant isolation with verified allow-list.
6. DB file selection safety guard implemented and tested.
7. Support email centralized to `shopos.help@gmail.com` with unproven claims purged.
8. Client lint (`oxlint`) and client build (`vite build`) pass with 0 errors.
9. All 9 security and ledger test suites pass with 100% success rate.
10. Ready for staging review and production deployment to Railway.
