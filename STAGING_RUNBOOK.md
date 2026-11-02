# ShopOS Staging Environment PostgreSQL Runbook

This runbook guides operators through provisioning and validating the full PostgreSQL 16 migration on a staging instance (e.g. Railway or dedicated staging cloud database) prior to production cutover.

---

## 1. Prerequisites & Environment Setup

1. **PostgreSQL 16+ Staging Instance**:
   - Provision a PostgreSQL 16 instance on Railway or local Docker.
   - Note down the `DATABASE_URL` connection string:
     `postgresql://<user>:<password>@<host>:<port>/<dbname>?sslmode=require`

2. **Verify Node.js & Tooling**:
   - Node.js 20.x or higher
   - Required dependencies installed (`npm install`)

---

## 2. Generate Synthetic Dataset v2 (Seeded 14-Month Dataset)

Generate 10,000+ invoices across 14 months, multi-line batches, 300+ customers, suppliers, inventory movements, and Urdu tenant names:

```bash
# Generate synthetic dataset v2 (creates data/synthetic_v2.db)
node server/scripts/generate_synthetic_data_v2.js
```

Expected output:
```
  Tenants created:             5 (Authentic multi-trade tenants)
  Customers created:           375 (30% on credit balances)
  Suppliers created:           45
  Products & Batches created:  325 products, 650 active batches
  Sales invoices generated:    10,500 across 14 months (incl. month/year ends)
  Sale line items:             30,580 lines
  Payments registered:         10,290 vouchers
  Inventory movements:         31,367 movement logs
  Audit logs:                  10,600 system entries
```

---

## 3. Run Pre-Flight Integrity Scan

Validate SQLite data consistency, precision, foreign keys, timestamps, and customer balance ledgers:

```bash
export DB_PATH="data/synthetic_v2.db"
node server/scripts/preflight_scan.js
```

Verify that the output concludes with:
`Migration Readiness Status: READY FOR MIGRATION ✅`

---

## 4. Rebuild Staging PostgreSQL Schema

Deploy the PostgreSQL 16 schema with hard composite tenant foreign keys:

```bash
export TEST_DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/<dbname>"
node server/scripts/rebuild_pg_schema.js
```

Verify that 149 foreign key constraints and 87 composite tenant checks are applied.

---

## 5. Execute Live Migration to Staging Postgres

Migrate all records inside an atomic transaction:

```bash
node server/scripts/migrate_sqlite_to_pg.js
```

Verify that all tables show `✓ <table_name>: N rows migrated` and `MIGRATION COMPLETED SUCCESSFULLY`.

---

## 6. Run Verification Engine (Mathematical Parity)

Audit all 27 tables, 6 financial balance aggregates, customer/supplier ledgers, canonical row hashes, and 10 date-range P&L/Valuation reports:

```bash
node server/scripts/verify_migration.js
```

Expected verdict:
`Overall Parity Verdict: 100% PERFECT PARITY VERIFIED ✅`

---

## 7. Run Negative Controls Verification

Prove that the verification engine detects corruptions (swapped amounts, date shift, cross-tenant row move, 0.001 precision anomaly, 0.01 balance change, counter tampering):

```bash
node server/tests/negative_controls.test.js
```

Expected verdict:
`NEGATIVE CONTROLS VERDICT: 6/6 DETECTED ✅`

---

## 8. Run Full Dress Rehearsal & Concurrency Drill

Execute the end-to-end dress rehearsal simulating cutover maintenance mode, 21 HTTP smoke tests, 50 parallel POS requests, halfway failure rollback, and SLA timings:

```bash
node server/tests/dress_rehearsal.test.js
```

Expected output:
```
  Phase 1 (Maintenance Mode On):       < 100 ms
  Phase 2 (SQLite Snapshot VACUUM):    < 500 ms
  Phase 3 (Migration & Verification):  ~140 s
  Phase 4 (Boot & 21 Smoke Tests):     ~4 s
  Phase 5 (50 Concurrency Requests):   ~4 s
  ------------------------------------------------------------------------
  TOTAL CUTOVER DOWNTIME:             ~144 SECONDS
  MAINTENANCE WINDOW SLA (<= 15 min):  MET WITH 100% MARGIN ✅
```
