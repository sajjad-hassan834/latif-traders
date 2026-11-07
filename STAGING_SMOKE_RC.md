# Staging Smoke Test Runbook (SQLite Release Candidate 6)

This runbook provides the mandatory pre-flight verification checklist for validating the Release Candidate 6 build (`rc/sqlite-2026-11-07-6`) on the staging environment before pointing live domain traffic.

---

## 1. Environment & Pre-Flight Verification

### 1.1 Health Check & Proxy Diagnostics
- [ ] Send `GET /api/health`
  - Expected: HTTP 200 with status `"healthy"`.
  - Verify payload contains:
    - `"db": "connected"`
    - `"proxy": { "trust_proxy_hops": 1 or 2, "ip_resolution": "active" }`
    - Response time `< 50ms`.

### 1.2 Startup Log Inspection (Zero IP Logging)
- [ ] Inspect container startup logs in Railway dashboard:
  - Check that the network line appears:
    `[ShopOS Network] Trust proxy hops configured: <N> (client IP differs from proxy IP: true)`
  - Confirm **ZERO** IP addresses, passwords, or secrets are printed in logs.

---

## 2. CORS Whitelist Verification (5 Permitted Origins)

Test pre-flight requests from the 5 authorized production frontends using `curl -I -X OPTIONS`:
1. `https://shoppyos.com` -> HTTP 204 / 200, `Access-Control-Allow-Origin: https://shoppyos.com`
2. `https://www.shoppyos.com` -> HTTP 204 / 200, `Access-Control-Allow-Origin: https://www.shoppyos.com`
3. `https://latiftraders.findcalculation.com` -> HTTP 204 / 200, `Access-Control-Allow-Origin: https://latiftraders.findcalculation.com`
4. `https://shopos.findcalculation.com` -> HTTP 204 / 200, `Access-Control-Allow-Origin: https://shopos.findcalculation.com`
5. `https://latif-traders.vercel.app` -> HTTP 204 / 200, `Access-Control-Allow-Origin: https://latif-traders.vercel.app`

Negative Checks:
- [ ] `https://attacker.vercel.app` -> HTTP 403 `CORS policy: Origin not allowed.`
- [ ] `https://findcalculation.com` (apex) -> HTTP 403 `CORS policy: Origin not allowed.`

---

## 3. Superowner & Credential Rotation Sequence

### 3.1 Initial Login
- [ ] Log in with the newly deployed `SUPEROWNER_USERNAME` and `SUPEROWNER_PASSWORD`.
  - Confirm access to `/superowner/dashboard`.

### 3.2 Credential Rotation Pre-Flight
- [ ] Run dry-run credential inspection in Railway terminal:
  ```bash
  node server/scripts/rotate_credentials.js --dry-run
  ```
  - Verify legacy default admin `shopos_superowner` or un-rotated default admin accounts are identified.
- [ ] Rotate/disable legacy default accounts safely:
  ```bash
  node server/scripts/rotate_credentials.js --user shopos_superowner --disable --yes
  ```
- [ ] For tenant staff rotation:
  - Verify `--exclude-user <admin>` preserves the active administrator:
    ```bash
    node server/scripts/rotate_credentials.js --tenant latif_001 --all-staff --exclude-user admin --dry-run
    ```

---

## 4. Operational Workflows (End-to-End)

### 4.1 Product & SKU Backward Compatibility
- [ ] Open `/products`.
  - Confirm existing products show their legacy SKU (`FRE-0001`, etc.) without auto prefixes.
  - Search by code `FRE-0001` -> verifies search index works.
  - Open Product Details modal -> verifies zero crashes, correct stock levels, and batch history.
  - Click `+ Add` -> verify new code is preassigned, read-only, and un-editable.

### 4.2 Restock & Purchase Voucher Print
- [ ] Navigate to `/purchases` -> `+ Purchase`.
  - Select supplier and add line items. Save purchase bill.
  - Open Purchase Detail / Voucher modal -> click `Print`.
  - **Verify Print Output**: System print preview renders formatted A4 voucher table with header, items, lot numbers, costs, and totals (NO blank white pages).

### 4.3 POS Sale & Receipt
- [ ] Open `/pos`.
  - Add items to cart (using cash payment).
  - Complete checkout -> verify Sale Invoice is generated.
  - Open Print Receipt preview:
    - Verify tenant custom logo loads cleanly cross-origin via `Cross-Origin-Resource-Policy: cross-origin`.
    - Verify line items show SKU and unit prices.

### 4.4 Stock Adjustment
- [ ] Navigate to `/adjustments` -> record a stock correction.
  - Verify stock level updates immediately in `/products` and reflects in `/analytics`.

---

## 5. Security & Rate Limiting Controls

### 5.1 Rate Limiting (Staff Protection)
- [ ] Execute 5 successive failed logins for user `nonexistent_user`:
  - Verify 6th attempt returns `HTTP 429 Too Many Requests`.
- [ ] Concurrently execute valid logins for active staff from the same IP:
  - Verify valid logins are **NOT** blocked (login rate limiter counts failures only).

### 5.2 Backup Data Leak Prevention
- [ ] In `/settings`, initiate an encrypted database backup export.
- [ ] Download and inspect the backup JSON payload:
  - Confirm `password_hash`, `token_version`, and session tokens are **completely stripped/redacted**.

---

## 6. Reconciliation Against Latif Production Totals

Before cutting over DNS or final routing, execute database reconciliation comparison against known baseline:

| Financial Metric | Baseline Value | Staging Value | Status |
|---|---|---|---|
| Active Stock SKU Count | Exact count | Match | [ ] |
| Total Units in Stock | Exact units | Match | [ ] |
| Cashbook Balance | Exact balance | Match | [ ] |
| Customer Outstanding (Udhaar) | Exact balance | Match | [ ] |
| Supplier Outstanding Payables | Exact balance | Match | [ ] |

---

## 7. Staging Snapshot, Anonymisation, Leak-Check & Load Runbook

Execute these exact commands in sequence when creating and validating a sanitized staging environment:

### Step 7.1: Take Atomic Production Snapshot via VACUUM INTO
In your production Railway CLI / shell (or local production volume mount):
```bash
sqlite3 /app/data/latif_traders.db "VACUUM INTO '/app/data/latif_traders_raw_snapshot.db';"
```
*Why*: `VACUUM INTO` creates an atomic, crash-consistent, defragmented read-only SQLite snapshot without locking writes or stopping production service.

### Step 7.2: Anonymise the Snapshot (Zero PII Retention)
Run the anonymisation tool on the snapshot:
```bash
node server/scripts/anonymise_snapshot.js /app/data/latif_traders_raw_snapshot.db /app/data/latif_traders_staging_anonymized.db
```
*What it masks*:
- Customer and supplier personal names -> `Customer <id>`, `Supplier <id>`
- Phone numbers -> `0300-000xxxx`
- Email addresses -> `customer_<id>@test.local`
- User passwords -> deterministic hashed test credentials (`StagingTest@123`)
- Address details and operational notes -> cleared
*What it preserves*:
- Exact financial totals, ledger balances, transaction dates, inventory units, and SKUs.

### Step 7.3: Run the Security Leak-Check Audit
Run the rigorous PII scanner on the anonymised database file:
```bash
node server/scripts/leak_check.js /app/data/latif_traders_staging_anonymized.db
```
*Verification*: Asserts zero Pakistani phone patterns, zero real domains, zero unmasked customer names, and zero credential leakage. Exit code must be 0 (`PASSED`).

### Step 7.4: Load Anonymised Database into Staging Environment
1. Copy the audited database into the staging volume:
   ```bash
   cp /app/data/latif_traders_staging_anonymized.db /app/staging_data/latif_traders.db
   ```
2. Set staging Railway environment variables:
   - `DB_PATH=/app/staging_data/latif_traders.db`
   - `DATA_DIR=/app/staging_data`
   - `NODE_ENV=production`
   - `JWT_SECRET=<new-random-secret>`
   - `SUPEROWNER_USERNAME=<new-staging-superowner>`
   - `SUPEROWNER_PASSWORD=<new-staging-password>`
   - `ALLOWED_ORIGINS=<staging-preview-url>`
   - `TRUST_PROXY_HOPS=1` (or 2 if Vercel rewrite is used)
3. Boot the staging service and verify startup log:
   `[ShopOS Database] Connected to SQLite database: latif_traders.db`

---

## 8. Staging Teardown & Rollback Runbook

Once all operational smoke tests are completed on staging:

### Step 8.1: Teardown Staging Database & Temporary Artifacts
From the Railway container shell or staging volume:
```bash
# Remove temporary snapshot and anonymized artifacts
rm -f /app/data/latif_traders_raw_snapshot.db
rm -f /app/data/latif_traders_staging_anonymized.db
```

### Step 8.2: Staging Project Deprovisioning / Suspension
1. In the Railway dashboard, navigate to the Staging project.
2. Under **Service Settings** -> **Danger Zone**, click **Pause Service** (or **Delete Service** if testing is finalized).
3. If staging shared a volume, remove the `/app/staging_data` directory.

### Step 8.3: Emergency Rollback Procedure (If staging reveals anomalies)
If staging tests identify an unexpected behavior:
1. Production remains completely untouched (never routed to staging).
2. Export staging audit log:
   ```bash
   sqlite3 /app/staging_data/latif_traders.db "SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50;" > staging_audit.log
   ```
3. Destroy staging container. Production continues serving traffic from existing database with zero disruption.

---
