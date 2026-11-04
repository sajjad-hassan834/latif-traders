# ShoppyOS PostgreSQL 16 Production Migration Runbook

This document defines the operator procedures, verification checks, execution commands, and rollback strategy for migrating ShoppyOS from SQLite (`data/latif_traders.db`) to PostgreSQL 16 on production environments (e.g., Railway / Dedicated Managed Postgres).

---

## 1. Safety Guarantees & Constraints

1. **Atomic Transaction**: The entire migration runs inside a single `BEGIN ... COMMIT` block. If any table, constraint, or foreign key fails, the entire transaction automatically rolls back.
2. **Drawer Cash Parity**: Quarantined legacy payments (unlinked to existing parties) are isolated into `legacy_unlinked_payments`. Cashbook and daily cash summary on both drivers include them to guarantee drawer totals match to the paisa (0.00 drift), while party ledgers and customer balances exclude them.
3. **No Leaks Policy**: Never prints secrets, passwords, tokens, or row-level personal data in console outputs or logs.
4. **Zero Fallback**: `DATABASE_URL` is mandatory when `DB_DRIVER=postgres`. The server crashes loudly if the variable is missing, preventing silent fallbacks.

---

## 2. Pre-Flight Checklist

Before starting migration in any staging or production environment:

- [ ] Confirm PostgreSQL 16 is provisioned and reachable via `DATABASE_URL`.
- [ ] Ensure minimum 15 GB free disk space on database volume.
- [ ] Take a point-in-time backup of the SQLite database:
  ```bash
  cp data/latif_traders.db data/latif_traders_pre_migration_backup.db
  ```
- [ ] Confirm pool size is configured (`DATABASE_POOL_SIZE=10`).
- [ ] Run rehearsal command locally:
  ```bash
  node server/scripts/run_production_rehearsal.js
  ```

---

## 3. Production Cutover Execution (Step-by-Step)

### Step 1: Put Application in Maintenance Window
Temporarily scale web workers to 0 or enable maintenance page to prevent incoming write requests during the cutover window (< 60 seconds).

### Step 2: Initialize PostgreSQL Schema
Apply the canonical PostgreSQL schema:
```bash
docker exec -i <pg-container> psql -U postgres -d <dbname> < server/migrations/pg_schema.sql
# Or via pg CLI / psql:
# psql "$DATABASE_URL" -f server/migrations/pg_schema.sql
```

### Step 3: Execute Migration Script
Run the atomic migration engine:
```bash
node server/scripts/migrate_sqlite_to_pg.js
```
*Expected Output*:
- All 28 tables migrated in strict topological dependency order.
- Primary key sequences reset to `MAX(id)`.
- Per-tenant document counters pre-initialized from existing document maximums.
- `MIGRATION COMMITTED SUCCESSFULLY!`

### Step 4: Run Aggregates Verification Engine
Verify row parity, financial sums, ledger balances, canonical hashes, and reports:
```bash
node server/scripts/verify_migration.js
```
*Expected Output*:
- `Overall Parity Verdict: 100% PERFECT PARITY VERIFIED ✅`
- Machine-readable report saved to `data/migration_verification_report.json`.

### Step 5: Switch Application Driver
Update application environment variables:
```env
DB_DRIVER=postgres
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname>
DATABASE_POOL_SIZE=10
```

### Step 6: Restart & Healthcheck
1. Start application workers.
2. Verify `/api/health` returns `status: "healthy"` and `driver: "postgres"`.
3. Check application logs for `[POSTGRES INITIALIZED] Pool Size: 10`.

---

## 4. Rollback Plan

If `verify_migration.js` reports a discrepancy or critical issues occur post-cutover:

1. Revert environment variables immediately:
   ```env
   DB_DRIVER=sqlite
   ```
2. Restore SQLite database snapshot if mutations were attempted:
   ```bash
   cp data/latif_traders_pre_migration_backup.db data/latif_traders.db
   ```
3. Restart application workers.
4. Verify application loads cleanly on SQLite driver.
5. All operations resume normally with zero data loss.
