# Complete Schema Diff Report: SQLite vs PostgreSQL 16

**Generated**: 2026-10-25T07:16:50.498Z
**PostgreSQL Target**: Docker postgres:16-alpine on port 5434

## 1. Tables and Columns Detailed Mapping

| Table | Column | SQLite Type | SQLite Null? | SQLite Default | PG Type | PG Null? | PG Default | Status / Rationale |
|---|---|---|---|---|---|---|---|---|
| audit_logs | id | INTEGER | YES | - | bigint | NO | nextval('audit_logs_id_seq'::r | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| audit_logs | user_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| audit_logs | user_name | TEXT | YES | - | text | YES | - | Identical mapping |
| audit_logs | action | TEXT | NO | - | text | NO | - | Identical mapping |
| audit_logs | entity_type | TEXT | NO | - | text | NO | - | Identical mapping |
| audit_logs | entity_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| audit_logs | details | TEXT | YES | - | text | YES | - | Identical mapping |
| audit_logs | ip_address | TEXT | YES | - | text | YES | - | Identical mapping |
| audit_logs | created_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| audit_logs | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| batches | id | INTEGER | YES | - | bigint | NO | nextval('batches_id_seq'::regc | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| batches | product_id | INTEGER | NO | - | bigint | NO | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| batches | batch_no | TEXT | NO | - | text | NO | - | Identical mapping |
| batches | expiry_date | TEXT | NO | - | date | YES | - | INTENDED: Native DATE for business day |
| batches | quantity | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| batches | purchase_price | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| batches | storage_location | TEXT | YES | - | text | YES | - | Identical mapping |
| batches | status | TEXT | NO | 'active' | text | YES | 'active'::text | Identical mapping |
| batches | created_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| batches | supplier_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| batches | sale_price | REAL | YES | 0 | numeric | YES | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| batches | wholesale_price | REAL | YES | 0 | numeric | YES | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| batches | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| brands | id | INTEGER | YES | - | bigint | NO | nextval('brands_id_seq'::regcl | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| brands | name | TEXT | NO | - | text | NO | - | Identical mapping |
| brands | description | TEXT | YES | - | text | YES | - | Identical mapping |
| brands | created_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| brands | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| categories | id | INTEGER | YES | - | bigint | NO | nextval('categories_id_seq'::r | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| categories | name | TEXT | NO | - | text | NO | - | Identical mapping |
| categories | description | TEXT | YES | - | text | YES | - | Identical mapping |
| categories | created_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| categories | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| customers | id | INTEGER | YES | - | bigint | NO | nextval('customers_id_seq'::re | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| customers | name | TEXT | NO | - | text | NO | - | Identical mapping |
| customers | phone | TEXT | YES | - | text | YES | - | Identical mapping |
| customers | address | TEXT | YES | - | text | YES | - | Identical mapping |
| customers | customer_type | TEXT | NO | 'Retail' | text | NO | 'Retail'::text | Identical mapping |
| customers | opening_balance | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| customers | credit_limit | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| customers | current_balance | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| customers | notes | TEXT | YES | - | text | YES | - | Identical mapping |
| customers | created_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| customers | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| expense_categories | id | INTEGER | YES | - | bigint | NO | nextval('expense_categories_id | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| expense_categories | name | TEXT | NO | - | text | NO | - | Identical mapping |
| expense_categories | description | TEXT | YES | - | text | YES | - | Identical mapping |
| expense_categories | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| expenses | id | INTEGER | YES | - | bigint | NO | nextval('expenses_id_seq'::reg | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| expenses | category_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| expenses | title | TEXT | NO | - | text | YES | - | Identical mapping |
| expenses | amount | REAL | NO | - | numeric | NO | - | INTENDED: NUMERIC(14,2) prevents float drift |
| expenses | payment_method | TEXT | NO | 'Cash' | text | NO | 'Cash'::text | Identical mapping |
| expenses | expense_date | TEXT | NO | - | date | NO | - | INTENDED: Native DATE for business day |
| expenses | description | TEXT | YES | - | text | YES | - | Identical mapping |
| expenses | receipt_path | TEXT | YES | - | text | YES | - | Identical mapping |
| expenses | user_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| expenses | created_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| expenses | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| inventory_movements | id | INTEGER | YES | - | bigint | NO | nextval('inventory_movements_i | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| inventory_movements | product_id | INTEGER | NO | - | bigint | NO | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| inventory_movements | batch_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| inventory_movements | type | TEXT | NOT NULL | - | MISSING | - | - | ❌ Missing in Postgres |
| inventory_movements | quantity_delta | REAL | NOT NULL | - | MISSING | - | - | ❌ Missing in Postgres |
| inventory_movements | unit_price | REAL | NULL | 0 | MISSING | - | - | ❌ Missing in Postgres |
| inventory_movements | balance_after | REAL | NOT NULL | 0 | MISSING | - | - | ❌ Missing in Postgres |
| inventory_movements | reference_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| inventory_movements | reference_type | TEXT | YES | - | text | YES | - | Identical mapping |
| inventory_movements | reason | TEXT | NULL | - | MISSING | - | - | ❌ Missing in Postgres |
| inventory_movements | user_id | INTEGER | NULL | - | MISSING | - | - | ❌ Missing in Postgres |
| inventory_movements | created_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| inventory_movements | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| password_reset_requests | id | INTEGER | NULL | - | MISSING | - | - | ❌ Missing in Postgres |
| password_reset_requests | user_id | INTEGER | NULL | - | MISSING | - | - | ❌ Missing in Postgres |
| password_reset_requests | username | TEXT | NOT NULL | - | MISSING | - | - | ❌ Missing in Postgres |
| password_reset_requests | full_name | TEXT | NULL | - | MISSING | - | - | ❌ Missing in Postgres |
| password_reset_requests | request_note | TEXT | NULL | - | MISSING | - | - | ❌ Missing in Postgres |
| password_reset_requests | status | TEXT | NOT NULL | 'pending' | MISSING | - | - | ❌ Missing in Postgres |
| password_reset_requests | admin_note | TEXT | NULL | - | MISSING | - | - | ❌ Missing in Postgres |
| password_reset_requests | temporary_password | TEXT | NULL | - | MISSING | - | - | ❌ Missing in Postgres |
| password_reset_requests | created_at | DATETIME | NULL | CURRENT_TIMESTAMP | MISSING | - | - | ❌ Missing in Postgres |
| password_reset_requests | resolved_at | DATETIME | NULL | - | MISSING | - | - | ❌ Missing in Postgres |
| password_reset_requests | resolved_by | INTEGER | NULL | - | MISSING | - | - | ❌ Missing in Postgres |
| password_reset_requests | tenant_id | TEXT | NULL | 'latif_001' | MISSING | - | - | ❌ Missing in Postgres |
| payments | id | INTEGER | YES | - | bigint | NO | nextval('payments_id_seq'::reg | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| payments | type | TEXT | NO | - | text | NO | - | Identical mapping |
| payments | party_type | TEXT | NO | - | text | NO | - | Identical mapping |
| payments | party_id | INTEGER | NO | - | bigint | NO | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| payments | reference_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| payments | reference_no | TEXT | YES | - | text | YES | - | Identical mapping |
| payments | amount | REAL | NO | - | numeric | NO | - | INTENDED: NUMERIC(14,2) prevents float drift |
| payments | payment_method | TEXT | NO | 'Cash' | text | NO | 'Cash'::text | Identical mapping |
| payments | payment_date | TEXT | NO | - | date | NO | - | INTENDED: Native DATE for business day |
| payments | notes | TEXT | YES | - | text | YES | - | Identical mapping |
| payments | user_id | INTEGER | NULL | - | MISSING | - | - | ❌ Missing in Postgres |
| payments | created_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| payments | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| products | id | INTEGER | YES | - | bigint | NO | nextval('products_id_seq'::reg | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| products | name | TEXT | NO | - | text | NO | - | Identical mapping |
| products | sku | TEXT | NO | - | text | NO | - | Identical mapping |
| products | barcode | TEXT | YES | - | text | YES | - | Identical mapping |
| products | category_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| products | brand | TEXT | YES | - | text | YES | - | Identical mapping |
| products | unit | TEXT | NO | 'pkt' | text | NO | 'pkt'::text | Identical mapping |
| products | purchase_price | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| products | sale_price | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| products | wholesale_price | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| products | min_stock_level | REAL | NO | 5 | numeric | NO | 5.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| products | status | TEXT | NO | 'active' | text | NO | 'active'::text | Identical mapping |
| products | storage_location | TEXT | YES | - | text | YES | - | Identical mapping |
| products | created_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| products | updated_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| products | supplier_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| products | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| purchase_items | id | INTEGER | YES | - | bigint | NO | nextval('purchase_items_id_seq | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| purchase_items | purchase_id | INTEGER | NO | - | bigint | NO | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| purchase_items | product_id | INTEGER | NO | - | bigint | NO | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| purchase_items | batch_no | TEXT | YES | - | text | YES | - | Identical mapping |
| purchase_items | expiry_date | TEXT | YES | - | date | YES | - | INTENDED: Native DATE for business day |
| purchase_items | quantity | REAL | NO | - | numeric | NO | - | INTENDED: NUMERIC(14,2) prevents float drift |
| purchase_items | unit | TEXT | NO | - | text | NO | 'pkt'::text | Identical mapping |
| purchase_items | unit_price | REAL | NO | - | numeric | NO | - | INTENDED: NUMERIC(14,2) prevents float drift |
| purchase_items | discount | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| purchase_items | total_price | REAL | NO | - | numeric | NO | - | INTENDED: NUMERIC(14,2) prevents float drift |
| purchase_items | brand | TEXT | YES | - | text | YES | - | Identical mapping |
| purchase_items | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| purchases | id | INTEGER | YES | - | bigint | NO | nextval('purchases_id_seq'::re | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| purchases | invoice_no | TEXT | NO | - | text | NO | - | Identical mapping |
| purchases | supplier_invoice_no | TEXT | YES | - | text | YES | - | Identical mapping |
| purchases | supplier_id | INTEGER | NO | - | bigint | NO | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| purchases | purchase_date | TEXT | NO | - | date | NO | - | INTENDED: Native DATE for business day |
| purchases | subtotal | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| purchases | discount | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| purchases | tax | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| purchases | grand_total | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| purchases | paid_amount | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| purchases | balance_due | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| purchases | payment_method | TEXT | NO | 'Cash' | text | NO | 'Cash'::text | Identical mapping |
| purchases | notes | TEXT | YES | - | text | YES | - | Identical mapping |
| purchases | user_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| purchases | created_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| purchases | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| return_items | id | INTEGER | YES | - | bigint | NO | nextval('return_items_id_seq': | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| return_items | return_id | INTEGER | NO | - | bigint | NO | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| return_items | product_id | INTEGER | NO | - | bigint | NO | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| return_items | batch_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| return_items | quantity | REAL | NO | - | numeric | NO | - | INTENDED: NUMERIC(14,2) prevents float drift |
| return_items | unit_price | REAL | NO | - | numeric | NO | - | INTENDED: NUMERIC(14,2) prevents float drift |
| return_items | total_amount | REAL | NO | - | numeric | NO | - | INTENDED: NUMERIC(14,2) prevents float drift |
| return_items | condition | TEXT | NO | 'RESELLABLE' | text | NO | 'good'::text | Identical mapping |
| return_items | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| returns | id | INTEGER | YES | - | bigint | NO | nextval('returns_id_seq'::regc | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| returns | return_no | TEXT | NO | - | text | NO | - | Identical mapping |
| returns | type | TEXT | NO | - | text | NO | - | Identical mapping |
| returns | original_invoice_id | INTEGER | NULL | - | MISSING | - | - | ❌ Missing in Postgres |
| returns | original_invoice_no | TEXT | NULL | - | MISSING | - | - | ❌ Missing in Postgres |
| returns | party_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| returns | total_amount | REAL | NO | - | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| returns | reason | TEXT | YES | - | text | YES | - | Identical mapping |
| returns | user_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| returns | created_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| returns | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| sale_items | id | INTEGER | YES | - | bigint | NO | nextval('sale_items_id_seq'::r | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| sale_items | sale_id | INTEGER | NO | - | bigint | NO | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| sale_items | product_id | INTEGER | NO | - | bigint | NO | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| sale_items | batch_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| sale_items | batch_no | TEXT | YES | - | text | YES | - | Identical mapping |
| sale_items | quantity | REAL | NO | - | numeric | NO | - | INTENDED: NUMERIC(14,2) prevents float drift |
| sale_items | unit | TEXT | NO | - | text | NO | 'pkt'::text | Identical mapping |
| sale_items | unit_price | REAL | NO | - | numeric | NO | - | INTENDED: NUMERIC(14,2) prevents float drift |
| sale_items | cost_price | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| sale_items | discount | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| sale_items | total_price | REAL | NO | - | numeric | NO | - | INTENDED: NUMERIC(14,2) prevents float drift |
| sale_items | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| sales | id | INTEGER | YES | - | bigint | NO | nextval('sales_id_seq'::regcla | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| sales | invoice_no | TEXT | NO | - | text | NO | - | Identical mapping |
| sales | customer_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| sales | sale_type | TEXT | NO | 'Retail' | text | NO | 'Retail'::text | Identical mapping |
| sales | sale_date | TEXT | NO | - | date | NO | - | INTENDED: Native DATE for business day |
| sales | subtotal | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| sales | discount | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| sales | tax | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| sales | grand_total | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| sales | paid_amount | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| sales | balance_due | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| sales | payment_method | TEXT | NO | 'Cash' | text | NO | 'Cash'::text | Identical mapping |
| sales | notes | TEXT | YES | - | text | YES | - | Identical mapping |
| sales | user_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| sales | order_status | TEXT | NO | 'Completed' | text | NO | 'Completed'::text | Identical mapping |
| sales | created_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| sales | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| settings | key | TEXT | YES | - | text | NO | - | Identical mapping |
| settings | value | TEXT | NO | - | text | NO | - | Identical mapping |
| stock_adjustments | id | INTEGER | YES | - | bigint | NO | nextval('stock_adjustments_id_ | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| stock_adjustments | adjustment_no | TEXT | NO | - | text | NO | - | Identical mapping |
| stock_adjustments | product_id | INTEGER | NO | - | bigint | NO | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| stock_adjustments | batch_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| stock_adjustments | type | TEXT | NO | - | text | NO | - | Identical mapping |
| stock_adjustments | quantity | REAL | NO | - | numeric | NO | - | INTENDED: NUMERIC(14,2) prevents float drift |
| stock_adjustments | unit_cost | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| stock_adjustments | reason | TEXT | NO | - | text | NO | - | Identical mapping |
| stock_adjustments | user_id | INTEGER | YES | - | bigint | YES | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| stock_adjustments | created_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| stock_adjustments | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| subscriptions | id | INTEGER | YES | - | bigint | NO | nextval('subscriptions_id_seq' | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| subscriptions | tenant_id | TEXT | NO | - | text | NO | - | Identical mapping |
| subscriptions | plan | TEXT | NO | - | text | NO | 'free'::text | Identical mapping |
| subscriptions | price | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| subscriptions | started_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | - | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| subscriptions | expires_at | DATETIME | YES | - | timestamp with time zone | YES | - | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| subscriptions | payment_status | TEXT | NO | 'active' | text | NO | 'active'::text | Identical mapping |
| supplier_products | id | INTEGER | YES | - | bigint | NO | nextval('supplier_products_id_ | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| supplier_products | supplier_id | INTEGER | NO | - | bigint | NO | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| supplier_products | product_id | INTEGER | NO | - | bigint | NO | - | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| supplier_products | last_purchase_price | REAL | YES | 0 | numeric | YES | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| supplier_products | last_purchased_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | - | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| supplier_products | created_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| supplier_products | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| suppliers | id | INTEGER | YES | - | bigint | NO | nextval('suppliers_id_seq'::re | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| suppliers | name | TEXT | NO | - | text | NO | - | Identical mapping |
| suppliers | phone | TEXT | YES | - | text | YES | - | Identical mapping |
| suppliers | address | TEXT | YES | - | text | YES | - | Identical mapping |
| suppliers | contact_person | TEXT | YES | - | text | YES | - | Identical mapping |
| suppliers | opening_balance | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| suppliers | current_balance | REAL | NO | 0 | numeric | NO | 0.00 | INTENDED: NUMERIC(14,2) prevents float drift |
| suppliers | notes | TEXT | YES | - | text | YES | - | Identical mapping |
| suppliers | created_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| suppliers | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| tenant_settings | tenant_id | TEXT | NO | - | text | NO | - | Identical mapping |
| tenant_settings | key | TEXT | NO | - | text | NO | - | Identical mapping |
| tenant_settings | value | TEXT | NO | - | text | NO | - | Identical mapping |
| tenants | id | TEXT | YES | - | text | NO | - | Identical mapping |
| tenants | business_name | TEXT | NO | - | text | NO | - | Identical mapping |
| tenants | business_type | TEXT | NO | 'retail_general' | text | NO | 'retail'::text | Identical mapping |
| tenants | owner_name | TEXT | YES | - | text | NO | - | Identical mapping |
| tenants | email | TEXT | YES | - | text | YES | - | Identical mapping |
| tenants | phone | TEXT | YES | - | text | YES | - | Identical mapping |
| tenants | address | TEXT | YES | - | text | YES | - | Identical mapping |
| tenants | logo_url | TEXT | YES | - | text | YES | - | Identical mapping |
| tenants | plan | TEXT | NO | 'free' | text | NO | 'free'::text | Identical mapping |
| tenants | plan_expires_at | DATETIME | YES | - | timestamp with time zone | YES | - | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| tenants | is_active | INTEGER | NO | 1 | boolean | NO | true | Identical mapping |
| tenants | created_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| tenants | updated_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| units | id | INTEGER | YES | - | bigint | NO | nextval('units_id_seq'::regcla | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| units | name | TEXT | NO | - | text | NO | - | Identical mapping |
| units | short_code | TEXT | NO | - | text | NO | - | Identical mapping |
| units | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| users | id | INTEGER | YES | - | bigint | NO | nextval('users_id_seq'::regcla | INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow |
| users | username | TEXT | NO | - | text | NO | - | Identical mapping |
| users | email | TEXT | YES | - | text | YES | - | Identical mapping |
| users | password_hash | TEXT | NO | - | text | NO | - | Identical mapping |
| users | full_name | TEXT | NO | - | text | NO | - | Identical mapping |
| users | role | TEXT | NO | 'sales' | text | NO | 'sales'::text | Identical mapping |
| users | status | TEXT | NO | 'active' | text | NO | 'active'::text | Identical mapping |
| users | permissions_json | TEXT | YES | - | jsonb | YES | - | INTENDED: JSONB indexing and query operators |
| users | created_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| users | updated_at | DATETIME | YES | CURRENT_TIMESTAMP | timestamp with time zone | YES | CURRENT_TIMESTAMP | INTENDED: TIMESTAMPTZ stores exact ISO timezone |
| users | tenant_id | TEXT | YES | 'latif_001' | text | YES | 'latif_001'::text | Identical mapping |
| users | is_hidden | INTEGER | NULL | 0 | MISSING | - | - | ❌ Missing in Postgres |
| users | is_system_account | INTEGER | NULL | 0 | MISSING | - | - | ❌ Missing in Postgres |
| users | theme | TEXT | YES | 'classic' | text | YES | 'classic'::text | Identical mapping |

## 2. Foreign Key Constraints (SQLite vs PostgreSQL)

| Table | From Column | To Table | To Column | Deferrable in PG? | Delete Rule |
|---|---|---|---|---|---|
| audit_logs | user_id | users | id | YES | SET NULL |
| batches | product_id | products | id | YES | CASCADE |
| batches | supplier_id | suppliers | id | YES | SET NULL |
| expenses | category_id | expense_categories | id | YES | SET NULL |
| expenses | user_id | users | id | YES | SET NULL |
| inventory_movements | batch_id | batches | id | YES | SET NULL |
| inventory_movements | product_id | products | id | YES | CASCADE |
| products | category_id | categories | id | YES | SET NULL |
| products | supplier_id | suppliers | id | YES | SET NULL |
| purchase_items | product_id | products | id | YES | RESTRICT |
| purchase_items | purchase_id | purchases | id | YES | CASCADE |
| purchases | supplier_id | suppliers | id | YES | RESTRICT |
| purchases | user_id | users | id | YES | SET NULL |
| return_items | batch_id | batches | id | YES | SET NULL |
| return_items | product_id | products | id | YES | RESTRICT |
| return_items | return_id | returns | id | YES | CASCADE |
| returns | user_id | users | id | YES | SET NULL |
| sale_items | batch_id | batches | id | YES | SET NULL |
| sale_items | product_id | products | id | YES | RESTRICT |
| sale_items | sale_id | sales | id | YES | CASCADE |
| sales | customer_id | customers | id | YES | SET NULL |
| sales | user_id | users | id | YES | SET NULL |
| stock_adjustments | batch_id | batches | id | YES | SET NULL |
| stock_adjustments | product_id | products | id | YES | CASCADE |
| stock_adjustments | user_id | users | id | YES | SET NULL |
| subscriptions | tenant_id | tenants | id | YES | CASCADE |
| supplier_products | product_id | products | id | YES | CASCADE |
| supplier_products | supplier_id | suppliers | id | YES | CASCADE |

## 3. Unique Constraints (SQLite vs PostgreSQL)

| Table | Constraint Name | Columns | Type |
|---|---|---|---|
| audit_logs | audit_logs_pkey | id | PRIMARY KEY |
| batches | batches_pkey | id | PRIMARY KEY |
| batches | uq_batches_tenant_prod_batch | tenant_id, product_id, batch_no | UNIQUE |
| brands | brands_pkey | id | PRIMARY KEY |
| brands | uq_brands_tenant_name | tenant_id, name | UNIQUE |
| categories | categories_pkey | id | PRIMARY KEY |
| categories | uq_categories_tenant_name | tenant_id, name | UNIQUE |
| counters | counters_pkey | id | PRIMARY KEY |
| counters | uq_counters_tenant_type | tenant_id, counter_type | UNIQUE |
| customers | customers_pkey | id | PRIMARY KEY |
| customers | uq_customers_tenant_name | tenant_id, name | UNIQUE |
| expense_categories | expense_categories_pkey | id | PRIMARY KEY |
| expense_categories | uq_exp_categories_tenant_name | tenant_id, name | UNIQUE |
| expenses | expenses_pkey | id | PRIMARY KEY |
| inventory_movements | inventory_movements_pkey | id | PRIMARY KEY |
| naive_counters | naive_counters_pkey | id | PRIMARY KEY |
| naive_stock | naive_stock_pkey | id | PRIMARY KEY |
| payments | payments_pkey | id | PRIMARY KEY |
| products | products_pkey | id | PRIMARY KEY |
| products | uq_products_tenant_sku | tenant_id, sku | UNIQUE |
| purchase_items | purchase_items_pkey | id | PRIMARY KEY |
| purchases | purchases_pkey | id | PRIMARY KEY |
| purchases | uq_purchases_tenant_invoice | tenant_id, invoice_no | UNIQUE |
| return_items | return_items_pkey | id | PRIMARY KEY |
| returns | returns_pkey | id | PRIMARY KEY |
| returns | uq_returns_tenant_no | tenant_id, return_no | UNIQUE |
| sale_items | sale_items_pkey | id | PRIMARY KEY |
| sales | sales_pkey | id | PRIMARY KEY |
| sales | uq_sales_tenant_invoice | tenant_id, invoice_no | UNIQUE |
| settings | settings_pkey | key | PRIMARY KEY |
| stock_adjustments | stock_adjustments_pkey | id | PRIMARY KEY |
| stock_adjustments | uq_stock_adj_tenant_no | tenant_id, adjustment_no | UNIQUE |
| subscriptions | subscriptions_pkey | id | PRIMARY KEY |
| supplier_products | supplier_products_pkey | id | PRIMARY KEY |
| supplier_products | uq_supplier_products | tenant_id, supplier_id, product_id | UNIQUE |
| suppliers | suppliers_pkey | id | PRIMARY KEY |
| suppliers | uq_suppliers_tenant_name | tenant_id, name | UNIQUE |
| tenant_settings | tenant_settings_pkey | id | PRIMARY KEY |
| tenant_settings | uq_tenant_settings_key | tenant_id, key | UNIQUE |
| tenants | tenants_pkey | id | PRIMARY KEY |
| units | units_pkey | id | PRIMARY KEY |
| units | uq_units_tenant_code | tenant_id, short_code | UNIQUE |
| users | users_pkey | id | PRIMARY KEY |
| users | uq_users_tenant_username | tenant_id, username | UNIQUE |

## 4. PostgreSQL Indexes

| Table | Index Name | Index Definition |
|---|---|---|
| audit_logs | audit_logs_pkey | `CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id)` |
| audit_logs | idx_audit_logs_tenant | `CREATE INDEX idx_audit_logs_tenant ON public.audit_logs USING btree (tenant_id)` |
| batches | batches_pkey | `CREATE UNIQUE INDEX batches_pkey ON public.batches USING btree (id)` |
| batches | idx_batches_tenant | `CREATE INDEX idx_batches_tenant ON public.batches USING btree (tenant_id)` |
| batches | uq_batches_tenant_prod_batch | `CREATE UNIQUE INDEX uq_batches_tenant_prod_batch ON public.batches USING btree (tenant_id, product_id, batch_no)` |
| brands | brands_pkey | `CREATE UNIQUE INDEX brands_pkey ON public.brands USING btree (id)` |
| brands | idx_brands_tenant | `CREATE INDEX idx_brands_tenant ON public.brands USING btree (tenant_id)` |
| brands | uq_brands_tenant_name | `CREATE UNIQUE INDEX uq_brands_tenant_name ON public.brands USING btree (tenant_id, name)` |
| categories | categories_pkey | `CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id)` |
| categories | idx_categories_tenant | `CREATE INDEX idx_categories_tenant ON public.categories USING btree (tenant_id)` |
| categories | uq_categories_tenant_name | `CREATE UNIQUE INDEX uq_categories_tenant_name ON public.categories USING btree (tenant_id, name)` |
| counters | counters_pkey | `CREATE UNIQUE INDEX counters_pkey ON public.counters USING btree (id)` |
| counters | idx_counters_tenant | `CREATE INDEX idx_counters_tenant ON public.counters USING btree (tenant_id)` |
| counters | uq_counters_tenant_type | `CREATE UNIQUE INDEX uq_counters_tenant_type ON public.counters USING btree (tenant_id, counter_type)` |
| customers | customers_pkey | `CREATE UNIQUE INDEX customers_pkey ON public.customers USING btree (id)` |
| customers | idx_customers_tenant | `CREATE INDEX idx_customers_tenant ON public.customers USING btree (tenant_id)` |
| customers | uq_customers_tenant_name | `CREATE UNIQUE INDEX uq_customers_tenant_name ON public.customers USING btree (tenant_id, name)` |
| expense_categories | expense_categories_pkey | `CREATE UNIQUE INDEX expense_categories_pkey ON public.expense_categories USING btree (id)` |
| expense_categories | idx_expense_categories_tenant | `CREATE INDEX idx_expense_categories_tenant ON public.expense_categories USING btree (tenant_id)` |
| expense_categories | uq_exp_categories_tenant_name | `CREATE UNIQUE INDEX uq_exp_categories_tenant_name ON public.expense_categories USING btree (tenant_id, name)` |
| expenses | expenses_pkey | `CREATE UNIQUE INDEX expenses_pkey ON public.expenses USING btree (id)` |
| expenses | idx_expenses_tenant | `CREATE INDEX idx_expenses_tenant ON public.expenses USING btree (tenant_id)` |
| inventory_movements | idx_inv_movements_tenant | `CREATE INDEX idx_inv_movements_tenant ON public.inventory_movements USING btree (tenant_id)` |
| inventory_movements | inventory_movements_pkey | `CREATE UNIQUE INDEX inventory_movements_pkey ON public.inventory_movements USING btree (id)` |
| naive_counters | naive_counters_pkey | `CREATE UNIQUE INDEX naive_counters_pkey ON public.naive_counters USING btree (id)` |
| naive_stock | naive_stock_pkey | `CREATE UNIQUE INDEX naive_stock_pkey ON public.naive_stock USING btree (id)` |
| payments | idx_payments_party | `CREATE INDEX idx_payments_party ON public.payments USING btree (party_type, party_id)` |
| payments | idx_payments_tenant | `CREATE INDEX idx_payments_tenant ON public.payments USING btree (tenant_id)` |
| payments | payments_pkey | `CREATE UNIQUE INDEX payments_pkey ON public.payments USING btree (id)` |
| products | idx_products_tenant | `CREATE INDEX idx_products_tenant ON public.products USING btree (tenant_id)` |
| products | products_pkey | `CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id)` |
| products | uq_products_tenant_sku | `CREATE UNIQUE INDEX uq_products_tenant_sku ON public.products USING btree (tenant_id, sku)` |
| purchase_items | idx_purchase_items_purchase | `CREATE INDEX idx_purchase_items_purchase ON public.purchase_items USING btree (purchase_id)` |
| purchase_items | idx_purchase_items_tenant | `CREATE INDEX idx_purchase_items_tenant ON public.purchase_items USING btree (tenant_id)` |
| purchase_items | purchase_items_pkey | `CREATE UNIQUE INDEX purchase_items_pkey ON public.purchase_items USING btree (id)` |
| purchases | idx_purchases_supplier | `CREATE INDEX idx_purchases_supplier ON public.purchases USING btree (supplier_id)` |
| purchases | idx_purchases_tenant | `CREATE INDEX idx_purchases_tenant ON public.purchases USING btree (tenant_id)` |
| purchases | purchases_pkey | `CREATE UNIQUE INDEX purchases_pkey ON public.purchases USING btree (id)` |
| purchases | uq_purchases_tenant_invoice | `CREATE UNIQUE INDEX uq_purchases_tenant_invoice ON public.purchases USING btree (tenant_id, invoice_no)` |
| return_items | idx_return_items_tenant | `CREATE INDEX idx_return_items_tenant ON public.return_items USING btree (tenant_id)` |
| return_items | return_items_pkey | `CREATE UNIQUE INDEX return_items_pkey ON public.return_items USING btree (id)` |
| returns | idx_returns_tenant | `CREATE INDEX idx_returns_tenant ON public.returns USING btree (tenant_id)` |
| returns | returns_pkey | `CREATE UNIQUE INDEX returns_pkey ON public.returns USING btree (id)` |
| returns | uq_returns_tenant_no | `CREATE UNIQUE INDEX uq_returns_tenant_no ON public.returns USING btree (tenant_id, return_no)` |
| sale_items | idx_sale_items_sale | `CREATE INDEX idx_sale_items_sale ON public.sale_items USING btree (sale_id)` |
| sale_items | idx_sale_items_tenant | `CREATE INDEX idx_sale_items_tenant ON public.sale_items USING btree (tenant_id)` |
| sale_items | sale_items_pkey | `CREATE UNIQUE INDEX sale_items_pkey ON public.sale_items USING btree (id)` |
| sales | idx_sales_customer | `CREATE INDEX idx_sales_customer ON public.sales USING btree (customer_id)` |
| sales | idx_sales_tenant | `CREATE INDEX idx_sales_tenant ON public.sales USING btree (tenant_id)` |
| sales | sales_pkey | `CREATE UNIQUE INDEX sales_pkey ON public.sales USING btree (id)` |
| sales | uq_sales_tenant_invoice | `CREATE UNIQUE INDEX uq_sales_tenant_invoice ON public.sales USING btree (tenant_id, invoice_no)` |
| settings | settings_pkey | `CREATE UNIQUE INDEX settings_pkey ON public.settings USING btree (key)` |
| stock_adjustments | idx_stock_adj_tenant | `CREATE INDEX idx_stock_adj_tenant ON public.stock_adjustments USING btree (tenant_id)` |
| stock_adjustments | stock_adjustments_pkey | `CREATE UNIQUE INDEX stock_adjustments_pkey ON public.stock_adjustments USING btree (id)` |
| stock_adjustments | uq_stock_adj_tenant_no | `CREATE UNIQUE INDEX uq_stock_adj_tenant_no ON public.stock_adjustments USING btree (tenant_id, adjustment_no)` |
| subscriptions | idx_subscriptions_tenant | `CREATE INDEX idx_subscriptions_tenant ON public.subscriptions USING btree (tenant_id)` |
| subscriptions | subscriptions_pkey | `CREATE UNIQUE INDEX subscriptions_pkey ON public.subscriptions USING btree (id)` |
| supplier_products | idx_supplier_products_tenant | `CREATE INDEX idx_supplier_products_tenant ON public.supplier_products USING btree (tenant_id)` |
| supplier_products | supplier_products_pkey | `CREATE UNIQUE INDEX supplier_products_pkey ON public.supplier_products USING btree (id)` |
| supplier_products | uq_supplier_products | `CREATE UNIQUE INDEX uq_supplier_products ON public.supplier_products USING btree (tenant_id, supplier_id, product_id)` |
| suppliers | idx_suppliers_tenant | `CREATE INDEX idx_suppliers_tenant ON public.suppliers USING btree (tenant_id)` |
| suppliers | suppliers_pkey | `CREATE UNIQUE INDEX suppliers_pkey ON public.suppliers USING btree (id)` |
| suppliers | uq_suppliers_tenant_name | `CREATE UNIQUE INDEX uq_suppliers_tenant_name ON public.suppliers USING btree (tenant_id, name)` |
| tenant_settings | idx_tenant_settings_tenant | `CREATE INDEX idx_tenant_settings_tenant ON public.tenant_settings USING btree (tenant_id)` |
| tenant_settings | tenant_settings_pkey | `CREATE UNIQUE INDEX tenant_settings_pkey ON public.tenant_settings USING btree (id)` |
| tenant_settings | uq_tenant_settings_key | `CREATE UNIQUE INDEX uq_tenant_settings_key ON public.tenant_settings USING btree (tenant_id, key)` |
| tenants | tenants_pkey | `CREATE UNIQUE INDEX tenants_pkey ON public.tenants USING btree (id)` |
| units | idx_units_tenant | `CREATE INDEX idx_units_tenant ON public.units USING btree (tenant_id)` |
| units | units_pkey | `CREATE UNIQUE INDEX units_pkey ON public.units USING btree (id)` |
| units | uq_units_tenant_code | `CREATE UNIQUE INDEX uq_units_tenant_code ON public.units USING btree (tenant_id, short_code)` |
| users | idx_users_tenant | `CREATE INDEX idx_users_tenant ON public.users USING btree (tenant_id)` |
| users | uq_users_tenant_username | `CREATE UNIQUE INDEX uq_users_tenant_username ON public.users USING btree (tenant_id, username)` |
| users | users_pkey | `CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)` |
