# ShoppyOS Dual-Release Deployment Master Plan

## Executive Summary
This document establishes the two-phase production release strategy for ShoppyOS. All code, security boundaries, brand assets, multi-trade features, and database migrations have been implemented on the unified local trunk `integration/local-all` and proven against the full suite of automated regression, concurrency, and parity test matrices.

---

## Phase 1: SQLite Release Candidate (Release 1)
- **Git Tag**: `rc/sqlite-2026-11-04`
- **Target Environment**: Railway Production (SQLite Driver)
- **Deployment Scope**:
  1. **ShoppyOS Brand System & public tokens**: Unified ShoppyOS branding, themes engine (`brand` default), clean non-conflicting tokens.
  2. **Multi-Tenant Security Hardening (Batch 1 & 1b)**: Strict tenant isolation, cryptographic session revocation, password reset flow hardening, rate limiting, and production pre-flight checks.
  3. **Multi-Trade Capabilities**: Backend support for batchless and dated trades, auto-lot generation, and NULL-expiry ordering.
  4. **Platform Hygiene**: Safe soft-deletion with snapshot archiving, hard purge CLI, and Bcrypt 12 rounds.
- **Rollout Guide**: [ROLLOUT.md](file:///c:/Users/ALLAH/OneDrive/Documents/Projects/LATIF%20TRADERS/ROLLOUT.md)
- **Test Status**: 13/13 test suites PASSING (100% green).

---

## Phase 2: PostgreSQL 16 Enterprise Cutover (Release 2)
- **Target Environment**: Dedicated PostgreSQL 16 Managed Database (Docker/Railway/Cloud)
- **Deployment Scope**:
  1. Complete schema initialization with composite foreign keys, per-tenant uniqueness constraints, and money precision (`NUMERIC(14,2)`).
  2. Single-transaction live data migration from SQLite snapshot (`VACUUM INTO`).
  3. Quarantined unlinked payments handling (`legacy_unlinked_payments` in drawer cashbook; excluded from party balances).
  4. Instant zero-downtime rollback capability.
- **Cutover SLA**:
  - Rehearsal downtime: 115.13 seconds (well under 15-minute maintenance window).
  - Parity score: 100% exact match across all 27 tables and 10 financial date ranges.

---

## Test & Parity Verification Summary Matrix

| # | Domain / Test Suite | Driver | Result | Duration / Latency |
|---|---|---|---|---|
| 1 | Branch Assertion Trunk Guard | Multi | ✅ PASS | 191 ms |
| 2 | No Old UI Static Code Guard | Client/Web | ✅ PASS | 123 ms |
| 3 | Trade Matrix Shared JSON & Aliases | Server/Client | ✅ PASS | 80 ms |
| 4 | Trade Batchless Lifecycle (7/7 Scenarios) | SQLite | ✅ PASS | 256 ms |
| 5 | UI Smoke & Brand Tokens (10/10 Tests) | Headless Browser | ✅ PASS | 10.02 s |
| 6 | Security Batch 1 (Auth/JWT/Tenants) | SQLite | ✅ PASS | 2.50 s |
| 7 | Security Batch 1b (Tokens/Edges) | SQLite | ✅ PASS | 1.11 s |
| 8 | Security Batch 1b (Reset Flow) | SQLite | ✅ PASS | 3.15 s |
| 9 | Security Batch 1b (Credential Rotation) | SQLite | ✅ PASS | 1.62 s |
| 10 | Security Batch 1b (Tenant Isolation) | SQLite | ✅ PASS | 1.02 s |
| 11 | Security Migrations Idempotency | SQLite | ✅ PASS | 146 ms |
| 12 | Cashbook Quarantine Parity | Dual-Driver | ✅ PASS | 321 ms |
| 13 | Negative Controls Drill (6/6 Controls) | SQLite | ✅ PASS | 931 ms |
| 14 | Stage A Adapter & Parameter Tokenizer | PostgreSQL 16 | ✅ PASS | 4.80 s |
| 15 | Stage A2 Real Postgres Concurrency & PID | PostgreSQL 16 | ✅ PASS | 129.0 s |
| 16 | Dual-Driver Business Logic Parity (16/16) | SQLite + PG 16 | ✅ PASS | 14.0 s |
| 17 | 10-Connection Pool 50 Parallel Sales Drill | PostgreSQL 16 | ✅ PASS | 7.0 s |
| 18 | Production Cutover Dress Rehearsal (All 7 Phases)| PostgreSQL 16 | ✅ PASS | 115.1 s |
