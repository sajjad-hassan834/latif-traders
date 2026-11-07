# ShoppyOS SQLite 1.0 Production Deployment Guide (`release/1.0-sqlite`)

This runbook defines the exact, non-destructive deployment procedure for **`release/1.0-sqlite`** (pinned strictly to tag `rc/sqlite-2026-11-07-7`).
Follow every step in sequence. Never skip any step.

---

## 1. Golden Architecture Rules & Invariants

1. **Persistent Volume Safety**:
   - The production database resides at `/app/data/latif_traders.db` on Railway's persistent volume (`latif-traders-volume`).
   - Container redeployments **do not** erase mounted persistent volumes.
   - The new codebase executes non-destructive additive migrations (`CREATE TABLE IF NOT EXISTS` and conditional column additions).
   - All destructive startup migrations (`clean_auto_payments_v2`, `clean_duplicate_receipts_v2`, `fix_customer_ledger_opening_bal_v5`) and hardcoded customer ledger overrides have been **permanently removed** from `release/1.0-sqlite`.

2. **Mandatory Environment Guards**:
   - **`DB_PATH` is required**: In production (`NODE_ENV=production`), the backend server will **refuse to boot** and exit with code 1 if `DB_PATH` is not explicitly set. This prevents accidental creation of a blank database file.
   - **`SUPEROWNER_USERNAME` requirement**: If `SUPEROWNER_USERNAME` is unset, the superowner bootstrap is safely skipped, and a warning is logged.

3. **Backup & Restore Guardrails**:
   - **Old UI**: The old live UI created full binary `.db` files (`Settings -> Backup & Recovery`).
   - **New UI Tenant Export**: In the new multi-tenant architecture, `Settings -> Backup & Recovery` exports tenant-isolated JSON containing that specific store's records.
   - **CRITICAL RESTORE RULE: NEVER USE IN-APP RESTORE**:
     - `POST /api/backups/restore` is **permanently blocked server-side** (HTTP 403) to prevent data loss.
     - In-app JSON restore omits required NOT NULL schema columns (`purchases.invoice_no`, `batches.batch_no`, `inventory_movements.type`, `purchase_items.unit`).
     - Full database restorations must **ONLY** be performed via atomic binary `.db` snapshot replacement at the server/volume level.

4. **Superowner Credential Invariant**:
   - The live database already has an existing superowner account.
   - **NEVER** disable the existing superowner account before verifying a replacement. If `SUPEROWNER_USERNAME` does not match the existing account, creating a new one may be skipped, and disabling the existing account would lock out all administrative access.
   - Always **rotate credentials on the existing superowner** rather than attempting to disable it.

---

## 2. Pre-Deployment: Step-by-Step Order

### Step 1: Capture Baseline Numbers (Live Store)
Log in to the current live production application as Admin. Record or screenshot the baseline numbers:
- Total orders count
- Total customer receivables (Udhaar)
- Total supplier payables
- Active products count
- Active stock total valuation
- Current balances of 3 top customers

### Step 2: Download Full Database Backup from Old Live UI
1. Visit the live site: `https://latiftraders.findcalculation.com` (or your live domain).
2. Log in with your Admin account.
3. Navigate to **Settings** -> **Backup & Recovery**.
4. Click **Create Live Backup Now**.
5. Download the `.db` file to your local computer (e.g. `latif_traders_backup_live.db`).
6. Run the aggregate verification script locally:
   ```bash
   node scripts/verify_backup.js path/to/latif_traders_backup_live.db
   ```
7. Generate the baseline JSON report:
   ```bash
   node scripts/baseline_report.js path/to/latif_traders_backup_live.db > baseline_before.json
   ```
8. Save two copies: one on your local PC and one in private secure offline storage (e.g. encrypted external drive).

### Step 3: Pre-Boot Check of the Three Settings Flags
Inspect the real downloaded live backup to verify the presence of legacy migration flags:
```sql
SELECT key, value FROM settings
WHERE key IN ('clean_auto_payments_v2', 'clean_duplicate_receipts_v2', 'fix_customer_ledger_opening_bal_v5');
```
Or run the automated checker:
```bash
node scripts/check_flags.js path/to/latif_traders_backup_live.db
```
- **Safety Guarantee**: In `release/1.0-sqlite` (RC7), the routines that delete unreferenced payments, duplicate receipts, and hardcoded customer opening balance adjustments have been completely removed from `server/config/database.js` and `server/services/ledgerService.js`. Even if any of these flags are absent in the live database, **the new code will NOT mutate or wipe any transactions or balances on boot**.

---

## 3. Environment Variable Configuration on Railway

Configure variables in Railway Dashboard under `latif-traders` -> **Variables** in two distinct phases:

### Phase A: Set Credentials First (Before New Code Boots)
Set these two variables on the current service first:
1. `JWT_SECRET`: A fresh random 64-character hex string:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. `SUPEROWNER_PASSWORD`: Strong random password (minimum 16 characters).

*(Note: Applying this will immediately invalidate active sessions and require re-login, securing the system against stale tokens).*

### Phase B: Configure Full Production Environment Variables
Set the remaining required variables in Railway:

| Variable | Required? | Exact Value / Rule |
| :--- | :---: | :--- |
| `NODE_ENV` | **YES** | `production` |
| `DATA_DIR` | **YES** | `/app/data` (matches Railway volume mount) |
| `DB_PATH` | **YES** | `/app/data/latif_traders.db` (**Boot fails if unset**) |
| `ALLOWED_ORIGINS` | **YES** | `https://shoppyos.com,https://www.shoppyos.com,https://latiftraders.findcalculation.com,https://shopos.findcalculation.com,https://latif-traders.vercel.app` |
| `FRONTEND_URL` | Optional | `https://latiftraders.findcalculation.com` |
| `SUPEROWNER_USERNAME` | **YES** | Target superowner username |
| `SUPEROWNER_PASSWORD` | **YES** | Strong random password (set in Phase A) |
| `JWT_SECRET` | **YES** | 64-hex string (set in Phase A) |
| `TRUST_PROXY_HOPS` | **YES** | `1` (for Railway direct) |
| `SUPPORT_EMAIL` | Optional | `shopos.help@gmail.com` |
| `PORT` | **DO NOT SET** | Managed automatically by Railway |

---

## 4. Deployment Execution

1. In Railway service settings, ensure the deployment branch or source is set to **`release/1.0-sqlite`** (pinned to tag `rc/sqlite-2026-11-07-7`).
2. Trigger the deployment build.
3. **Inspect Boot Logs**:
   - Confirm: `[ShopOS Database] Connected to SQLite database: latif_traders.db`
   - Confirm: `[ShopOS Security] Superowner account initialized from environment`
   - Confirm: Zero `[FATAL]` errors.

---

## 5. Post-Deployment Verification & Smoke Tests

1. **Health Endpoint**:
   ```bash
   curl -I https://<your-railway-domain>/api/health
   ```
   Must return HTTP 200 with `driver: "sqlite"`.

2. **Admin Login**:
   - Log in with Latif's store credentials.
   - Verify that Dashboard numbers match the baseline recorded in Step 1.

3. **Audit Against Baseline**:
   - Verify aggregate counts and business totals match `baseline_before.json`.

4. **Rotate Existing Superowner Credentials**:
   Do **NOT** disable the existing superowner. Rotate its credentials directly:
   ```bash
   railway run "node server/scripts/rotate_credentials.js --superowner"
   ```

5. **VERIFY SUPEROWNER LOGIN BEFORE ANY DISABLE STEP**:
   - Open a fresh incognito browser window.
   - Navigate to `/login` (or `/superowner/login`).
   - Log in using the newly rotated superowner credentials.
   - **CONFIRM** successful access to `/superowner/dashboard`.
   - **NEVER** run `--disable` on any legacy account until this login has succeeded.

6. **Rotate Staff Passwords (Optional / Scheduled)**:
   ```bash
   railway run "node server/scripts/rotate_credentials.js --tenant latif_001 --all-staff --yes"
   ```

---

## 6. Full Database Snapshots (VACUUM INTO) on Live Server

To create an atomic full binary database snapshot on Railway at any time:
```bash
railway run "node -e \"const Database = require('better-sqlite3'); const db = new Database('/app/data/latif_traders.db'); const target = '/app/data/snapshot_' + Date.now() + '.db'; db.exec('VACUUM INTO \\'' + target + '\\''); console.log('Full snapshot created at:', target);\""
```

---

## 7. Rollback Procedure (Safety Escape Hatch)

If any blocking issue occurs post-deploy:
1. In Railway Dashboard -> **Deployments**, click on the previous working deployment.
2. Click **Rollback**.
3. Because the migrations added to SQLite are purely non-destructive and backward-compatible, the previous deployment code will immediately reconnect to `/app/data/latif_traders.db` without data corruption.
4. If database restoration from backup is ever required:
   - Remember: In-app Restore is blocked. Use CLI-level file replacement:
   ```bash
   railway run "cp /app/data/latif_traders.db /app/data/corrupted_backup.db && cp /app/data/latif_traders_backup_live.db /app/data/latif_traders.db"
   ```
