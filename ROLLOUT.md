# ShoppyOS SQLite Release Candidate & Security Rollout Guide

## Overview
This document details the production deployment procedure for the **ShoppyOS SQLite Release Candidate (`rc/sqlite-2026-11-04`)** on Railway. This release unites:
1. **Multi-Tenant Security Hardening (Batch 1 & 1b)**: Strict tenant isolation, cryptographic session revocation, password reset flow hardening, rate limiting, and production pre-flight checks.
2. **ShoppyOS Brand System & public tokens**: Unified ShoppyOS branding, themes engine (`brand` default), clean non-conflicting tokens.
3. **Multi-Trade Capabilities**: Backend support for batchless and dated trades, auto-lot generation, and NULL-expiry ordering.
4. **Platform Hygiene**: Safe soft-deletion with snapshot archiving, hard purge CLI, and Bcrypt 12 rounds.

> **CRITICAL NOTICE**: Deploying this release **will immediately invalidate all active sessions and log every user out** due to algorithm pinning (`HS256`), mandatory `token_version` claims, and the required rotation of `JWT_SECRET`.

---

## 1. Required Railway Environment Variables

Before triggering the deployment build, ensure the following variables are configured in the Railway dashboard:

| Variable Name | Status | Required? | Description & Constraints |
| :--- | :--- | :---: | :--- |
| `NODE_ENV` | Existing | **YES** | Set to `production`. Activates strict startup pre-flight checks. |
| `DATA_DIR` | Existing | **YES** | Absolute path to the persistent volume mount (e.g. `/data` or `/app/data`). |
| `DB_PATH` | Existing | **RECOMMENDED** | Explicit path to active SQLite database (e.g. `/data/latif_traders.db`). |
| `JWT_SECRET` | Existing | **YES** | Must be rotated to a fresh, cryptographically secure 64-character random string. **Server exits on boot if length < 32 characters in production.** |
| `SUPEROWNER_USERNAME` | Existing | **YES** | Unique username for the platform system operator (do NOT use the old default `superowner`). |
| `SUPEROWNER_PASSWORD` | Existing | **YES** | High-entropy password for initial superowner bootstrap. |
| `ALLOWED_ORIGINS` | **NEW** | **RECOMMENDED** | Comma-separated list of allowed origins (e.g. `https://shoppyos.com,https://www.shoppyos.com`). |
| `FRONTEND_URL` | Existing | Optional | Comma-separated list of allowed web origins. |
| `TRUST_PROXY_HOPS` | **NEW** | Optional | Set to `1` (default) for single reverse-proxy setups (Railway/Cloudflare). |
| `SUPPORT_EMAIL` | Existing | Optional | Public customer support email (defaults to `support@shoppyos.com`). |

---

## 2. Pre-Deployment Step-by-Step Order

1. **Safety Backup**:
   - Create a manual snapshot of the current production database from the Railway persistent volume (`latif_traders.db`) before deployment.
2. **Configure Railway Variables**:
   - In Railway Service Settings -> Variables:
     - Generate a new 64-character hex string for `JWT_SECRET` (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
     - Set `SUPEROWNER_USERNAME` and a strong `SUPEROWNER_PASSWORD`.
     - Explicitly set `DB_PATH` pointing to your existing database in the volume (e.g. `${DATA_DIR}/latif_traders.db`).
     - Set `ALLOWED_ORIGINS=https://shoppyos.com,https://www.shoppyos.com`.
3. **Deploy the Release**:
   - Deploy from the release tag `rc/sqlite-2026-11-04` on `integration/local-all`.
4. **Monitor Boot Logs**:
   - Verify log line: `[ShoppyOS Database] Connected to SQLite database: latif_traders.db`.
   - Verify log line: `[ShoppyOS Security] SuperOwner account initialized from environment`.
   - Ensure NO `[FATAL]` startup errors occur.

---

## 3. Post-Deployment Account Management

### A. Deactivate Legacy Superowner Account
If an old default `superowner` account exists in the database, run the credential rotation utility:
```bash
# Dry run preview (prints affected account names only):
node server/scripts/rotate_credentials.js --disable-legacy-superowner

# Execute deactivation:
node server/scripts/rotate_credentials.js --disable-legacy-superowner --yes
```

### B. Rotate Default Admin of First Tenant (`latif_001`)
To issue a fresh one-time random password for the primary shop administrator:
```bash
# Dry run preview:
node server/scripts/rotate_credentials.js --tenant latif_001 --admin-only

# Execute rotation:
node server/scripts/rotate_credentials.js --tenant latif_001 --admin-only --yes
```

---

## 4. Post-Deployment Smoke Tests

Execute these verification checks immediately following deployment:
1. **Health & Latency Check**:
   - `GET /api/health` -> verify HTTP 200, `status: "ok"`, `app: "ShoppyOS Management System"`, `driver: "sqlite"`.
2. **Session Invalidation**:
   - Confirm that previously saved browser sessions are logged out and redirected to `/login`.
3. **Admin Sign-In**:
   - Log in with the updated administrator credentials.
   - If `must_change_password` is set, confirm the Forced Password Change screen appears and blocks access to other routes until updated.
4. **Tenant Isolation Verification**:
   - Verify that sales, inventory, and customer ledger show only `latif_001` records.
   - Confirm no cross-tenant leakage occurs.
5. **Support & Contact Links**:
   - Verify Header and Landing Page footer display `support@shoppyos.com` with zero references to placeholder emails.
6. **Transaction & Receipt Test**:
   - Create a test sale or receipt voucher preview; verify thermal (80mm) and A4 print popups render without glyph corruption.

---

## 5. Rollback Plan

If an unexpected critical issue occurs post-deployment:
1. **Code Rollback**:
   - Revert Railway deployment to the previous stable deployment commit (`6f72dc8`).
2. **Database Non-Destructive Guarantee**:
   - All migrations applied by this release are **strictly additive** (`token_version`, `must_change_password`, `reset_token_hash`, `tenant_id` columns, `batches_temp` relaxation).
   - No existing columns or tables are dropped or renamed destructively.
   - The previous codebase version will run against the database without schema errors.
3. **Session Notice**:
   - Users will need to log in again after rollback.
