# ShoppyOS SQLite 1.0 Production Deployment Guide (`release/1.0-sqlite`)

This runbook defines the exact, non-destructive deployment procedure for **`release/1.0-sqlite`** (pinned strictly to tag **`rc/sqlite-2026-11-07-8`** or newer verified RC tag).
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

### Step 3: Inspect Removed Migration Settings Keys & Ledger Discrepancies
Run the read-only audit tool on your real downloaded backup:
```bash
node scripts/audit_removed_migrations.js path/to/latif_traders_backup_live.db
```
*(Outputs aggregates only — never prints customer names, phones, or invoice numbers).*

#### What Each Result Means:
1. **`clean_auto_payments_v2`**:
   - **EXISTS (value: 'true')**: The old code already executed this migration on your database in the past. Removing the code from the new release ensures it will **never run again** or wipe new invoice settlement records.
   - **NOT FOUND**: The migration never ran on your database. Removing it ensures that existing invoice settlement payments are 100% preserved and will **never be wiped**.
2. **`clean_duplicate_receipts_v2`**:
   - **EXISTS (value: 'true')**: The old code previously merged same-day identical transactions.
   - **NOT FOUND**: Legitimate same-day installments (e.g. morning/evening customer payments) remain intact.
3. **`fix_customer_ledger_opening_bal_v5`**:
   - **EXISTS (value: 'true')**: An early hardcoded customer adjustment was recorded.
   - **NOT FOUND**: Customer opening balances were never hardcoded.
4. **Customer Stored vs Ledger Discrepancies**:
   - If discrepancies are reported, it indicates the difference between stored `current_balance` and raw transaction sum `(opening_balance + sales - payments - returns)`.
   - In `release/1.0-sqlite`, the release code **NEVER** mutates or recalculates stored balances on startup. The data remains exactly as stored in your backup with **zero calculation drift**.

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

1. In Railway service settings, ensure the deployment branch or source is set to **`release/1.0-sqlite`** (pinned strictly to tag **`rc/sqlite-2026-11-07-8`** or a newer verified RC tag after a full matrix pass).
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

3. Copy or compare against `baseline_before.json` (from Step 2) locally:
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
1. **Always dry-run first**:
   ```bash
   node server/scripts/rotate_credentials.js --tenant latif_001 --admin-only
   ```
   Verify the target account username displayed in the preview.
2. **Execute rotation**:
   ```bash
   node server/scripts/rotate_credentials.js --tenant latif_001 --admin-only --yes
   ```
   **CRITICAL**: Immediately copy and store the randomly generated 18-character password printed in the terminal output before closing the shell.
3. Staff rotation (optional/as needed):
   ```bash
   node server/scripts/rotate_credentials.js --tenant latif_001 --all-staff --exclude-user <tenant_admin_username> --yes
   ```

---

## 7. Staging Environment Runbook (Anonymised Copy)

Follow this procedure to create an isolated staging verification environment before production cutover:

### 7.1 Generate and Audit Anonymised Snapshot Locally
On your local machine (where your real backup is saved):
1. Anonymise customer and supplier personal data while preserving exact balances and transaction math:
   ```bash
   node server/scripts/anonymise_snapshot.js path/to/real_backup.db staging_anonymized.db
   ```
2. Run the PII leak scanner:
   ```bash
   node server/scripts/leak_check.js staging_anonymized.db
   ```
   Must output `LEAK CHECK PASSED: Zero unmasked PII found`.
3. Capture staging baseline:
   ```bash
   node scripts/baseline_report.js staging_anonymized.db > baseline_staging_expected.json
   ```

### 7.2 Load Anonymised Database into Railway Staging Volume
Inside your Railway Staging project:
1. In the Staging service, add a persistent volume mounted at `/app/staging_data`.
2. To copy the local `staging_anonymized.db` into the container volume:
   - **Method A (Railway Web Dashboard Shell - Most Reliable)**:
     - Open Staging service -> **Deployments** -> Active Deployment -> **Terminal / Shell**.
     - On local machine, compress and base64-encode:
       ```bash
       node -e "const fs = require('fs'); const zlib = require('zlib'); const data = fs.readFileSync('staging_anonymized.db'); console.log(zlib.gzipSync(data).toString('base64'));" > staging.b64
       ```
     - In container shell, receive and unpack:
       ```bash
       mkdir -p /app/staging_data
       cat << 'EOF' > /tmp/staging.b64
       <paste-base64-string>
       EOF
       node -e "const fs = require('fs'); const zlib = require('zlib'); const b64 = fs.readFileSync('/tmp/staging.b64', 'utf8').trim(); fs.writeFileSync('/app/staging_data/latif_traders.db', zlib.gunzipSync(Buffer.from(b64, 'base64'))); console.log('Restored staging db');"
       rm /tmp/staging.b64
       ```
   - **Method B (Railway CLI `railway ssh`)**:
     If `railway ssh` is supported by your CLI version, connect and stream:
     ```bash
     railway ssh
     # inside container: curl from private webhook or stream
     ```

### 7.3 Configure Staging Environment Variables
Set the following variables in Railway Staging:
- `NODE_ENV=production`
- `DATA_DIR=/app/staging_data`
- `DB_PATH=/app/staging_data/latif_traders.db`
- `JWT_SECRET=<new-random-hex-string>`
- `SUPEROWNER_USERNAME=superowner_staging`
- `SUPEROWNER_PASSWORD=<strong-random-password>`
- `ALLOWED_ORIGINS=https://staging.<your-staging-domain>`
- `TRUST_PROXY_HOPS=1`

### 7.4 Staging Smoke Verification
1. Verify health endpoint:
   ```bash
   curl -I https://staging.<your-staging-domain>/api/health
   ```
   Must return HTTP 200 with `driver: "sqlite"`.
2. Log in with staging admin credentials (`admin` / `StagingTest@123` or your designated account).
3. Confirm that Dashboard financial totals (Receivables, Payables, Stock Valuation, Orders Count) match `baseline_staging_expected.json`.

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
