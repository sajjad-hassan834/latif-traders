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

2. **Railway Execution Model (CRITICAL)**:
   - **`railway run <cmd>` executes LOCALLY**: Running `railway run` on your PC executes the command on your local machine using Railway environment variables. It **cannot** access `/app/data` because the persistent volume is attached to the remote Linux container on Railway.
   - **Remote Container Commands**: Commands that inspect or modify `/app/data/latif_traders.db` MUST be executed inside the container:
     - **Primary (Recommended)**: Railway Web Dashboard -> Project -> Service (`latif-traders`) -> **Deployments** -> Click Active Deployment -> Open the **Terminal / Shell** tab (or Service Settings -> **Exec**).
     - **CLI Alternative**: `railway ssh` (or `railway shell` depending on your installed Railway CLI version).

3. **Mandatory Environment Guards**:
   - **`DB_PATH` is required**: In production (`NODE_ENV=production`), the backend server will **refuse to boot** and exit with code 1 if `DB_PATH` is not explicitly set. This prevents accidental creation of a blank database file.
   - **`SUPEROWNER_USERNAME` requirement**: If `SUPEROWNER_USERNAME` is unset, the superowner bootstrap is safely skipped, and a warning is logged.

4. **Backup & Restore Guardrails**:
   - **Old UI**: The old live UI created full binary `.db` files (`Settings -> Backup & Recovery`).
   - **New UI Tenant Export**: In the new multi-tenant architecture, `Settings -> Backup & Recovery` exports tenant-isolated JSON containing that specific store's records.
   - **CRITICAL RESTORE RULE: NEVER USE IN-APP RESTORE**:
     - `POST /api/backups/restore` is **permanently blocked server-side** (HTTP 403) to prevent data loss.
     - In-app JSON restore omits required NOT NULL schema columns (`purchases.invoice_no`, `batches.batch_no`, `inventory_movements.type`, `purchase_items.unit`).
     - Full database restorations must **ONLY** be performed via atomic binary `.db` snapshot replacement at the server/volume level.

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
7. Generate the baseline JSON report locally:
   ```bash
   node scripts/baseline_report.js path/to/latif_traders_backup_live.db > baseline_before.json
   ```
8. Save two copies: one on your local PC and one in private secure offline storage (e.g. encrypted external drive).

### Step 3: Pre-Boot Check of the Three Settings Flags
Inspect the downloaded live backup to verify the presence of legacy migration flags:
```sql
SELECT key, value FROM settings
WHERE key IN ('clean_auto_payments_v2', 'clean_duplicate_receipts_v2', 'fix_customer_ledger_opening_bal_v5');
```
Or run the automated checker locally:
```bash
node scripts/check_flags.js path/to/latif_traders_backup_live.db
```
- **Safety Guarantee**: In `release/1.0-sqlite`, the routines that delete unreferenced payments, duplicate receipts, and hardcoded customer opening balance adjustments have been completely removed. Even if any of these flags are absent in the live database, **the new code will NOT mutate or wipe any transactions or balances on boot**.

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
| `SUPEROWNER_USERNAME` | **YES** | Target superowner username (e.g. `superowner_latif`) |
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

### Step 5.1: Health Endpoint Verification
```bash
curl -I https://<your-railway-domain>/api/health
```
Must return HTTP 200 with `driver: "sqlite"`.

### Step 5.2: Admin Login & Visual Smoke Test
- Log in to `https://<your-railway-domain>/login` with Latif's store credentials.
- Verify that Dashboard numbers match the baseline recorded in Step 1.
- Open `/pos`, `/products`, and `/purchases` to verify navigation and data load cleanly.

### Step 5.3: Post-Deploy Snapshot & Baseline Diff Audit
Open Railway Web Dashboard -> **Deployments** -> Active Deployment -> **Terminal / Shell**:

1. Create a fresh post-deploy snapshot:
   ```bash
   node -e "const Database = require('better-sqlite3'); const db = new Database('/app/data/latif_traders.db'); db.exec(\"VACUUM INTO '/app/data/snapshot_post_deploy.db'\"); console.log('Post-deploy snapshot created successfully');"
   ```

2. Run the baseline report on the new snapshot:
   ```bash
   node scripts/baseline_report.js /app/data/snapshot_post_deploy.db > /app/data/baseline_after.json
   ```

3. Copy or upload `baseline_before.json` (from Step 2) into `/app/data/baseline_before.json`, or copy `baseline_after.json` locally and run:
   ```bash
   node scripts/compare_baseline.js baseline_before.json baseline_after.json
   ```
   **Requirement**: Output must say `RESULT: PASS` with 0 discrepancies across all financial metrics, customer receivables, supplier payables, inventory valuation, and orders count.

---

## 6. Superowner & Admin Credential Governance

All commands in this section MUST be run inside the Railway Container Shell (**never** locally with `railway run`):

### Step 6.1: Verify Login with NEW Superowner
1. Open a fresh private/incognito browser window.
2. Navigate to `https://<your-railway-domain>/superowner/login` (or `/login`).
3. Log in with `SUPEROWNER_USERNAME` and `SUPEROWNER_PASSWORD`.
4. **Confirm access** to `/superowner/dashboard`.
5. **DO NOT PROCEED to Step 6.2 until this login is 100% verified.**

### Step 6.2: Disable the OLD Default Superowner Account
Once the new superowner account is verified, disable the legacy default `shopos_superowner`:
1. Run a dry run to inspect the target account:
   ```bash
   node server/scripts/rotate_credentials.js --user shopos_superowner --disable
   ```
2. Execute the deactivation:
   ```bash
   node server/scripts/rotate_credentials.js --user shopos_superowner --disable --yes
   ```
   *(Note: The script refuses to disable the active account configured in `SUPEROWNER_USERNAME`).*

### Step 6.3: Confirm New Superowner Still Works
1. Return to the incognito window.
2. Refresh `/superowner/dashboard` and verify ongoing session health.
3. Test logging out and logging back in with the new superowner credentials.

### Step 6.4: Rotate & Secure Tenant Store Admin
If the first store tenant has a default `admin` username or outdated password:
1. Dry-run preview:
   ```bash
   node server/scripts/rotate_credentials.js --tenant latif_001 --admin-only
   ```
2. Rotate password:
   ```bash
   node server/scripts/rotate_credentials.js --tenant latif_001 --admin-only --yes
   ```
   *(Save the newly generated random password printed in the terminal immediately).*
3. If rotating staff:
   ```bash
   node server/scripts/rotate_credentials.js --tenant latif_001 --all-staff --exclude-user <tenant_admin_username> --yes
   ```

---

## 7. Container Database Snapshots & File Transfers

### 7.1 How to Take an Atomic Snapshot Inside Railway
Inside the Railway container terminal:
```bash
node -e "const Database = require('better-sqlite3'); const db = new Database('/app/data/latif_traders.db'); const target = '/app/data/snapshot_' + Date.now() + '.db'; db.exec('VACUUM INTO \\'' + target + '\\''); console.log('Snapshot created at:', target);"
```

### 7.2 Safest Methods to Transfer Snapshots Out of Railway Volume
Because Railway persistent volumes are not mounted directly to your local PC, use one of these safe methods:
- **Method 1 (Old UI Download - Recommended for Pre-Deploy)**:
  Use **Settings** -> **Backup & Recovery** in the old live UI before deploying. It streams the full SQLite file securely over HTTPS.
- **Method 2 (Base64 Stream via Container Terminal)**:
  In container shell:
  ```bash
  gzip -c /app/data/snapshot_post_deploy.db | base64 > /app/data/snapshot.b64
  ```
  Print in terminal or download via standard curl/presigned POST.
- **Method 3 (Temporary Signed Transfer)**:
  If an S3/GCS bucket or secure private webhook is available:
  ```bash
  curl -T /app/data/snapshot_post_deploy.db "https://your-secure-pre-signed-url"
  ```

### 7.3 How to Copy an Anonymised File into a Staging Volume
1. On your local PC or build runner, run:
   ```bash
   node server/scripts/anonymise_snapshot.js path/to/real_snapshot.db staging_anonymized.db
   node server/scripts/leak_check.js staging_anonymized.db
   ```
2. In the Staging project on Railway, mount a persistent volume at `/app/staging_data`.
3. In the Staging container terminal, place the audited database at:
   `/app/staging_data/latif_traders.db`
4. Set Staging environment variable: `DB_PATH=/app/staging_data/latif_traders.db`.

---

## 8. Rollback Procedure (Safety Escape Hatch)

If any blocking issue occurs post-deploy:
1. In Railway Dashboard -> **Deployments**, locate the last active working deployment.
2. Click **Rollback**.
3. Because all migrations in `release/1.0-sqlite` are non-destructive and backward-compatible, the previous deployment code will immediately reconnect to `/app/data/latif_traders.db` without schema corruption.
4. If a complete database rollback is ever required:
   In Railway Container Shell:
   ```bash
   cp /app/data/latif_traders.db /app/data/corrupted_backup.db
   cp /app/data/snapshot_before_deploy.db /app/data/latif_traders.db
   ```
   Then restart the Railway deployment.
