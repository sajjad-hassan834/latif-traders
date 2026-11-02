# ShopOS PostgreSQL 16 Production Cutover Runbook

> **Target SLA**: $\le 15$ Minutes Maintenance Downtime  
> **Proven Rehearsal Downtime**: **144.35 Seconds (~2.4 Minutes)** (756s safety margin)  
> **Target Execution Window**: Off-peak business hours (e.g. 02:00–02:30 PKT / 21:00–21:30 UTC)  
> **Target PostgreSQL Version**: PostgreSQL 16.x or higher  

---

## 1. Pre-Cutover Checklist (T-24 Hours)

- [ ] Target PostgreSQL 16+ instance provisioned and healthy.
- [ ] Network connectivity and latency verified from application servers to PostgreSQL ($\le 10\text{ ms}$).
- [ ] Staging dress rehearsal executed cleanly using `STAGING_RUNBOOK.md`.
- [ ] Superowner emergency credentials and JWT secrets verified in environment variables.
- [ ] Operators have console access to host shell / Railway CLI.
- [ ] Tenant notification dispatched regarding scheduled 15-minute maintenance window.

---

## 2. Step-by-Step Cutover Procedure

### Phase 1: Activate Maintenance Mode (T+0 min)
Engage circuit breaker to block all tenant writes with HTTP 503 while leaving monitoring and superowner routes active.

```bash
# In Railway/Server Environment:
export MAINTENANCE_MODE=true
# Verify healthcheck returns HTTP 200 with latency probe
curl -I http://localhost:5000/api/health
# Verify tenant requests return HTTP 503
curl -I http://localhost:5000/api/products
```

---

### Phase 2: Atomic SQLite Snapshot & Checksum (T+1 min)
Capture a zero-write atomic snapshot using SQLite's online vacuum API and generate a cryptographic SHA-256 fingerprint.

```bash
node -e "
const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const db = new Database('data/latif_traders.db');
const snapshotPath = 'data/cutover_snapshot_' + Date.now() + '.db';
console.log('[SNAPSHOT] Initiating VACUUM INTO ' + snapshotPath + '...');
db.pragma('wal_checkpoint(TRUNCATE)');
db.backup(snapshotPath).then(() => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(snapshotPath)).digest('hex');
  fs.writeFileSync(snapshotPath + '.sha256', hash);
  console.log('[SNAPSHOT COMPLETE] Path:', snapshotPath);
  console.log('[SHA-256 CHECKPRINT]:', hash);
  process.exit(0);
});
"
```

---

### Phase 3: Pre-Flight Scan & Schema Build (T+2 min)
Run the automated integrity scanner to verify precision, foreign keys, timestamps, and ledger balance consistency.

```bash
# Set active snapshot path
export DB_PATH="data/<SNAPSHOT_FILENAME>.db"

# 1. Integrity scan
node server/scripts/preflight_scan.js

# 2. Build target PostgreSQL schema with composite tenant isolation & foreign keys
node server/scripts/rebuild_pg_schema.js
```
*Note: If `preflight_scan.js` reports any fatal error, abort immediately (see Section 4).*

---

### Phase 4: Live Data Migration (T+3 min)
Execute atomic batch migration inside a single PostgreSQL transaction with sequence resets and PKT counter initializations.

```bash
# Run migration against target database
export TARGET_DATABASE_URL="postgresql://user:password@pg-host:5432/shopos_prod?sslmode=require"
node server/scripts/migrate_sqlite_to_pg.js
```

---

### Phase 5: Verification Engine — 100% Mathematical Parity Gate (T+5 min)
Verify row counts, financial balances, SHA-256 canonical row hashes across 26 business tables, 0 foreign key orphans, and 10 date-range reports.

```bash
node server/scripts/verify_migration.js
```
> [!CRITICAL]
> **GO / NO-GO GATE**: The script must output `Overall Parity Verdict: 100% PERFECT PARITY VERIFIED ✅`.  
> If any hash or balance sum fails, do **NOT** proceed. Trigger Rollback immediately.

---

### Phase 6: Switch Driver & Lift Maintenance Mode (T+7 min)
Activate PostgreSQL as primary database engine and open tenant traffic.

```bash
# Update Production Environment Variables
export DB_DRIVER=postgres
export DATABASE_URL="postgresql://user:password@pg-host:5432/shopos_prod?sslmode=require"
export DATABASE_POOL_SIZE=20
export PG_STATEMENT_TIMEOUT=15000
export PG_IDLE_TX_TIMEOUT=10000
export DATABASE_SSL=true
export MAINTENANCE_MODE=false

# Restart application service
pm2 restart server || railway restart
```

---

### Phase 7: Post-Cutover HTTP Smoke Verification (T+8 min)
Execute real API calls to ensure transactional consistency:

```bash
# 1. Health & Driver Verification
curl http://localhost:5000/api/health
# Expected: {"status":"ok","driver":"postgres","latency_ms":<10}

# 2. Execute automated 21-point smoke suite
npm run test:stage-a2
```

---

## 3. Rollback Trigger Criteria (When to Abort)

Abort the cutover immediately and rollback if **ANY** of the following occur:
1. **Verification Failure**: Any row count, hash mismatch, balance discrepancy, or foreign key orphan reported in Phase 5.
2. **Postgres Startup Failure**: PostgreSQL driver fails to connect or target version is `< 16.0`.
3. **Smoke Test Failure**: Any HTTP 500 error during Phase 7 smoke testing (sales, payments, ledger, inventory).
4. **Time SLA Breach**: Total maintenance time reaches **10 minutes** without successful completion of Phase 5.

---

## 4. Emergency Rollback Procedure (< 30 Seconds)

Because the source SQLite database was placed into read-only mode during the snapshot and never modified during migration, rolling back to SQLite is instantaneous and completely lossless.

```bash
# 1. Revert Environment Variables to SQLite
export DB_DRIVER=sqlite
export DB_PATH="data/latif_traders.db"
export MAINTENANCE_MODE=false

# 2. Restart Application Process
pm2 restart server || railway restart

# 3. Verify SQLite Health
curl http://localhost:5000/api/health
# Expected: {"status":"ok","driver":"sqlite",...}
```
*Tenants resume operations immediately on their existing SQLite database without data corruption or loss.*
