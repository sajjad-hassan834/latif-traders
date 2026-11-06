# ShoppyOS SQLite Release Candidate & Security Rollout Guide

## Overview
This document details the production deployment procedure for the **ShoppyOS SQLite Release Candidate (`rc/sqlite-2026-11-06-3`)** on Railway. This release unites:
1. **Multi-Tenant Security Hardening (Batch 1 & 1b)**: Strict tenant isolation, cryptographic session revocation, password reset flow hardening, rate limiting, and production pre-flight checks.
2. **ShoppyOS Brand System & Public Tokens**: Unified ShoppyOS branding, themes engine (`brand` default), clean non-conflicting tokens.
3. **Multi-Trade Capabilities**: Backend support for batchless and dated trades, auto-lot generation, and NULL-expiry ordering.
4. **Platform Hygiene**: Safe soft-deletion with snapshot archiving, hard purge CLI, and Bcrypt 12 rounds.

> **CRITICAL NOTICE**: Deploying this release **will immediately invalidate all active sessions and log every user out** due to algorithm pinning (`HS256`), mandatory `token_version` claims, and the required rotation of `JWT_SECRET`.

---

## 1. Required Railway Environment Variables

Before triggering the deployment build, ensure the following variables are configured in the Railway dashboard:

| Variable Name | Status on Railway | Required? | Exact Production Value / Rule |
| :--- | :--- | :---: | :--- |
| `NODE_ENV` | Existing | **YES** | `production` (activates production guards, CORS enforcement, and rate limiting). |
| `DATA_DIR` | Existing | **YES** | `/app/data` (matches your Railway persistent volume mount; do NOT use `/data`). |
| `DB_PATH` | **NEW to set** | **REQUIRED** | `/app/data/latif_traders.db` (Boot fails if unset in production. Refuses empty DB creation). |
| `JWT_SECRET` | Existing | **YES (Rotate)** | Fresh 64-character hex string (`crypto.randomBytes(32).toString('hex')`). |
| `ALLOWED_ORIGINS` | **NEW to set** | **REQUIRED** | `https://shoppyos.com,https://www.shoppyos.com,https://findcalculation.com,https://app.findcalculation.com` |
| `FRONTEND_URL` | Existing | Optional | `https://www.shoppyos.com,https://shoppyos.com,https://findcalculation.com` |
| `SUPEROWNER_USERNAME` | **NEW to set** | **REQUIRED** | Custom username for platform superowner (never use default `superowner`). |
| `SUPEROWNER_PASSWORD` | **NEW to set** | **REQUIRED** | Strong random password (min 16 chars). |
| `TRUST_PROXY_HOPS` | **NEW to set** | **REQUIRED** | `1` for Railway direct; `2` if routing through Vercel rewrite to Railway. |
| `SUPPORT_EMAIL` | **NEW to set** | Optional | `shopos.help@gmail.com` (until custom domain mailbox is verified). |
| `PORT` | **DO NOT SET** | **NO** | Provided automatically by Railway; never set manually. |

---

## 2. Pre-Deployment Step-by-Step Order

1. **Volume & Database Snapshot**:
   - In Railway, create a safety snapshot of the persistent volume (`/app/data/latif_traders.db`).
2. **Configure Environment Variables**:
   - In Railway Service Settings -> Variables, set all variables from Table 1 above.
   - Confirm `DB_PATH=/app/data/latif_traders.db` is set and non-empty.
   - Confirm `ALLOWED_ORIGINS` includes both `shoppyos.com` and `findcalculation.com` origins.
3. **Deploy the Release**:
   - Deploy from the release tag `rc/sqlite-2026-11-06-3` on trunk branch `integration/local-all`.
4. **Monitor Boot Logs**:
   - Look for: `[ShopOS Database] Connected to SQLite database: latif_traders.db` (file basename only).
   - Look for: `[ShopOS Security] Superowner account initialized from environment`.
   - Confirm zero `[FATAL]` errors appear.

---

## 3. Post-Deployment Account Management (Execute in this exact order)

### Step 1: Log in with the New Superowner
1. Visit `https://app.shoppyos.com` or `https://latif-traders-production.up.railway.app`.
2. Sign in using the newly created `SUPEROWNER_USERNAME` and `SUPEROWNER_PASSWORD`.
3. Confirm access to the Superowner Platform Dashboard.

### Step 2: Disable Legacy Default Accounts via CLI
Run credential deactivation on the Railway container or via Railway CLI (`railway run`):

1. **Disable Legacy Superowner Account**:
   ```bash
   node server/scripts/rotate_credentials.js --disable --user superowner --yes
   ```
   *Result*: Status is set to `inactive`, `token_version` is incremented, and access is permanently disabled.

2. **Disable / Rotate Legacy Default Admin for `latif_001`**:
   ```bash
   node server/scripts/rotate_credentials.js --tenant latif_001 --admin-only --disable --yes
   ```
   *Result*: Deactivates the legacy default admin account. If rotating instead of disabling, run:
   ```bash
   node server/scripts/rotate_credentials.js --tenant latif_001 --admin-only --yes
   ```

### Step 3: Rotate Staff Passwords
To enforce zero stale credential re-use:
```bash
node server/scripts/rotate_credentials.js --tenant latif_001 --all-staff --yes
```
*Result*: Generates fresh one-time passwords for all staff members, sets `must_change_password = 1`, and terminates all active sessions.

### Step 4: Verify Boot Warnings Disappear
Restart the service or observe boot logs. Verify that both warnings:
- `[SECURITY WARNING] Legacy default or non-environment superowner account detected...`
- `[SECURITY WARNING] Legacy default admin account has never rotated initial credentials...`
are no longer logged.

---

## 4. Post-Deployment Smoke Tests

Execute these verification checks immediately following deployment:
1. **Health Check**:
   - `GET /api/health` -> verify HTTP 200, `status: "ok"`, `driver: "sqlite"`.
2. **Session Invalidation**:
   - Confirm that prior sessions redirect to `/login`.
3. **Tenant Logo Rendering**:
   - Invoices and dashboard render the tenant-specific monogram or custom uploaded logo via `/api/settings/logo/:tenantId/:filename` with `Cross-Origin-Resource-Policy: cross-origin`.
4. **Tenant Isolation**:
   - Products, customers, and orders show only records matching `req.tenantId`.
5. **Print Engine Verification**:
   - Generate a sale invoice or purchase bill and verify print preview renders cleanly in thermal (80mm) and A4 without blank pages.

---

## 5. Rollback Plan

If an unexpected critical issue occurs post-deployment:
1. **Code Rollback**:
   - Revert Railway deployment to previous release commit in Railway Deployments tab.
2. **Database Non-Destructive Guarantee**:
   - All migrations in this release are **strictly additive** (`token_version`, `must_change_password`, `reset_token_hash`, `tenant_id` columns).
   - No existing tables or columns were dropped or destructively renamed.
   - The prior application code can execute against the database without schema errors.
3. **Restoring Volume Snapshot (if needed)**:
   - If manual volume recovery is required:
     ```bash
     cp /app/data/backups/pre_deploy_latif_traders.db /app/data/latif_traders.db
     ```
4. **Session Notice**:
   - Users will need to sign in again after rollback.
