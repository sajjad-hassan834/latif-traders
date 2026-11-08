# Comprehensive Production Incident Recovery Plan
**Document Version:** 1.0.0-PROD-REC  
**Target Architecture:** ShoppyOS / Latif Traders Multi-Tenant Deployment  
**Operational Mode:** Manual Owner Actions (Dashboard & Read-Only Shell)

---

## 1. Safety Principles & Pre-Flight Rules
- **ZERO LOSS:** Never run `DROP`, `TRUNCATE`, `rm -rf`, or `--force` on any volume, database, or branch.
- **ISOLATION:** Perform backups before making any configuration changes in Railway or Vercel.
- **CREDENTIAL INTEGRITY:** Never expose, paste, or print unmasked connection strings or production tokens in logs or tickets.

---

## 2. Step A: Snapshotting Live Data (Before Touching Anything)

### 2.1 SQLite Snapshot inside Railway Container
If the Railway container for `latif-traders` has shell access enabled:
1. Open **Railway Dashboard** → Project `ShoppyOS` → Service `latif-traders` → **Console / Shell**.
2. Run the atomic SQLite vacuum snapshot command:
   ```bash
   sqlite3 /app/data/latif_traders.db "VACUUM INTO '/app/data/latif_traders_pre_recovery_snapshot.db';"
   ```
3. Verify file creation and size:
   ```bash
   ls -lh /app/data/latif_traders_pre_recovery_snapshot.db
   ```
*(Note: If the web console does not allow file downloads directly, you can use the SuperOwner dashboard backup downloader or copy out using the Railway CLI `railway run`).*

### 2.2 PostgreSQL pg_dump Snapshot
From your local terminal, run `pg_dump` targeting the Railway Postgres public proxy URL (saving a timestamped local dump):
```bash
pg_dump "postgresql://postgres:brelAfzXfDEPNoQGzLtHFZNeEXWrsKEN@hayabusa.proxy.rlwy.net:13507/railway" -F c -b -v -f ./data/postgres_snapshot_pre_recovery.dump
```

---

## 3. Step B: Enable Maintenance Mode
To prevent users or staff from submitting transactions during recovery:
1. In **Railway** → `latif-traders` (Production environment) → **Variables**.
2. Add or update:
   ```env
   MAINTENANCE_MODE="true"
   ```
3. Click **Deploy**. The server will immediately serve HTTP 503 to regular customer/staff routes while keeping health checks and SuperOwner access operational.

---

## 4. Step C: Switching Live Service between SQLite & Postgres

### Scenario C1: If reverting to SQLite as Primary
1. In Railway Variables for `latif-traders`:
   - Change `DB_DRIVER` to: `sqlite`
   - Set `DB_PATH` to: `/app/data/latif_traders.db`
   - **Do NOT delete the Postgres service or volume.**
2. Click **Deploy**.
3. Verify deploy logs:
   - Must show `[ShopOS Database] Connected to SQLite database: latif_traders.db`.
   - Must show `driver: "sqlite"` in `/api/health`.

### Scenario C2: If running PostgreSQL as Primary
1. In Railway Variables for `latif-traders`:
   - Change `DB_DRIVER` to: `postgres`
   - Set `DATABASE_URL` to: `postgresql://postgres:brelAfzXfDEPNoQGzLtHFZNeEXWrsKEN@hayabusa.proxy.rlwy.net:13507/railway`
2. Click **Deploy**.
3. Verify deploy logs:
   - Must show `[POSTGRES INITIALIZED] Pool Size: 10`.
   - Must show `driver: "postgres"` in `/api/health`.

---

## 5. Step D: Inspecting & Reconciling Post-Cutover Transactions
Before switching back or migrating, run the read-only audit tool:
```bash
DATABASE_URL="postgresql://postgres:brelAfzXfDEPNoQGzLtHFZNeEXWrsKEN@hayabusa.proxy.rlwy.net:13507/railway" node scripts/postgres_since_cutover_report.js "2026-11-08T00:00:00Z"
```
- This outputs `data/postgres_post_cutover_report.json` with counts and sanitised summaries (id, date, amount, invoice number only).
- If new orders were created in PostgreSQL, manually re-enter them or run a sync script before disabling Maintenance Mode.

---

## 6. Step E: Verification with Baseline Reports
Run before and after any database switch:
```bash
node scripts/baseline_report.js data/latif_traders.db
```
Verify the output matches your verified metrics:
- Invoices: ~1,102 (or 1,187 with test orders)
- Customers: 44 (or 121 across multi-tenants)
- Suppliers: 18

---

## 7. Step F: Rollback Procedure for Each Action
| Action Attempted | Rollback Trigger | Exact Rollback Command / Action |
| :--- | :--- | :--- |
| **Variable switch to SQLite** | App reports missing DB | Re-set `DB_DRIVER="postgres"` and redeploy |
| **Variable switch to Postgres** | Connection timeout/502 | Re-set `DB_DRIVER="sqlite"`, `DB_PATH="/app/data/latif_traders.db"` |
| **New Release Deployment** | UI white-screen or 500 error | Click **Instant Rollback** in Vercel / Redeploy previous commit in Railway |

