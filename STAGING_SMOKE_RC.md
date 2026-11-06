# Staging Smoke Test Runbook (SQLite Release Candidate 4)

This runbook provides the mandatory pre-flight verification checklist for validating the Release Candidate 4 build on the staging environment before pointing live domain traffic.

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
