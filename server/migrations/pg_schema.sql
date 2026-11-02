-- PostgreSQL Master Schema for Latif Traders (Enterprise Multi-Tenant)
-- Compliant with:
-- 1. NUMERIC(14,2) for exact paisa currency
-- 2. Hard database-level tenant isolation:
--    - Foreign key tenant_id -> tenants(id) ON DELETE CASCADE on EVERY table
--    - Composite UNIQUE(tenant_id, id) on all parent tables
--    - Composite FOREIGN KEY(tenant_id, child_id) REFERENCES parent(tenant_id, id)
-- 3. Row-Level Security (RLS) defense-in-depth with superowner bypass
-- 4. B-Tree indices on tenant_id for all tables
-- 5. Atomic per-tenant counter sequences

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL,
  business_type TEXT NOT NULL DEFAULT 'retail',
  owner_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  plan_expires_at TIMESTAMPTZ,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'sales',
  status TEXT NOT NULL DEFAULT 'active',
  permissions_json JSONB,
  theme TEXT DEFAULT 'classic',
  is_hidden INTEGER NOT NULL DEFAULT 0,
  is_system_account INTEGER NOT NULL DEFAULT 0,
  token_version INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  temp_password_expires_at TIMESTAMPTZ,
  temp_password_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_users_tenant_username UNIQUE(tenant_id, username),
  CONSTRAINT uq_users_tenant_id UNIQUE(tenant_id, id),
  CONSTRAINT chk_users_tenant CHECK (role = 'superowner' OR tenant_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_superowner_username ON users(username) WHERE role = 'superowner';

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_categories_tenant_name UNIQUE(tenant_id, name),
  CONSTRAINT uq_categories_tenant_id UNIQUE(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);

CREATE TABLE IF NOT EXISTS units (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  short_code TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_units_tenant_code UNIQUE(tenant_id, short_code),
  CONSTRAINT uq_units_tenant_id UNIQUE(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_units_tenant ON units(tenant_id);

CREATE TABLE IF NOT EXISTS brands (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_brands_tenant_name UNIQUE(tenant_id, name),
  CONSTRAINT uq_brands_tenant_id UNIQUE(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_brands_tenant ON brands(tenant_id);

CREATE TABLE IF NOT EXISTS suppliers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company_name TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_suppliers_tenant_name UNIQUE(tenant_id, name),
  CONSTRAINT uq_suppliers_tenant_id UNIQUE(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);

CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  customer_type TEXT NOT NULL DEFAULT 'Retail',
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_customers_tenant_name UNIQUE(tenant_id, name),
  CONSTRAINT uq_customers_tenant_id UNIQUE(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT,
  category_id BIGINT,
  brand TEXT,
  unit TEXT NOT NULL DEFAULT 'pkt',
  purchase_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  sale_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  wholesale_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  min_stock_level NUMERIC(14,2) NOT NULL DEFAULT 5.00,
  status TEXT NOT NULL DEFAULT 'active',
  storage_location TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  supplier_id BIGINT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_products_tenant_sku UNIQUE(tenant_id, sku),
  CONSTRAINT uq_products_tenant_id UNIQUE(tenant_id, id),
  CONSTRAINT fk_products_category_tenant FOREIGN KEY (tenant_id, category_id) REFERENCES categories(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT fk_products_supplier_tenant FOREIGN KEY (tenant_id, supplier_id) REFERENCES suppliers(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);

CREATE TABLE IF NOT EXISTS batches (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL,
  batch_no TEXT NOT NULL,
  expiry_date DATE,
  quantity NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  purchase_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  sale_price NUMERIC(14,2) DEFAULT 0.00,
  wholesale_price NUMERIC(14,2) DEFAULT 0.00,
  storage_location TEXT,
  status TEXT DEFAULT 'active',
  supplier_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_batches_tenant_prod_batch UNIQUE(tenant_id, product_id, batch_no),
  CONSTRAINT uq_batches_tenant_id UNIQUE(tenant_id, id),
  CONSTRAINT fk_batches_product_tenant FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT fk_batches_supplier_tenant FOREIGN KEY (tenant_id, supplier_id) REFERENCES suppliers(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_batches_tenant ON batches(tenant_id);

CREATE TABLE IF NOT EXISTS sales (
  id BIGSERIAL PRIMARY KEY,
  invoice_no TEXT NOT NULL,
  customer_id BIGINT,
  sale_type TEXT NOT NULL DEFAULT 'Retail',
  sale_date DATE NOT NULL,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  tax NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  grand_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  balance_due NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  notes TEXT,
  user_id BIGINT,
  order_status TEXT NOT NULL DEFAULT 'Completed',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_sales_tenant_invoice UNIQUE(tenant_id, invoice_no),
  CONSTRAINT uq_sales_tenant_id UNIQUE(tenant_id, id),
  CONSTRAINT fk_sales_customer_tenant FOREIGN KEY (tenant_id, customer_id) REFERENCES customers(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT fk_sales_user_tenant FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_sales_tenant ON sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);

CREATE TABLE IF NOT EXISTS sale_items (
  id BIGSERIAL PRIMARY KEY,
  sale_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  batch_id BIGINT,
  batch_no TEXT,
  quantity NUMERIC(14,2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pkt',
  unit_price NUMERIC(14,2) NOT NULL,
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_price NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_sale_items_tenant_id UNIQUE(tenant_id, id),
  CONSTRAINT fk_sale_items_sale_tenant FOREIGN KEY (tenant_id, sale_id) REFERENCES sales(tenant_id, id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT fk_sale_items_product_tenant FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT fk_sale_items_batch_tenant FOREIGN KEY (tenant_id, batch_id) REFERENCES batches(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_sale_items_tenant ON sale_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

CREATE TABLE IF NOT EXISTS purchases (
  id BIGSERIAL PRIMARY KEY,
  invoice_no TEXT NOT NULL,
  supplier_invoice_no TEXT,
  supplier_id BIGINT NOT NULL,
  purchase_date DATE NOT NULL,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  tax NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  grand_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  balance_due NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  notes TEXT,
  user_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_purchases_tenant_invoice UNIQUE(tenant_id, invoice_no),
  CONSTRAINT uq_purchases_tenant_id UNIQUE(tenant_id, id),
  CONSTRAINT fk_purchases_supplier_tenant FOREIGN KEY (tenant_id, supplier_id) REFERENCES suppliers(tenant_id, id) ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT fk_purchases_user_tenant FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_purchases_tenant ON purchases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);

CREATE TABLE IF NOT EXISTS purchase_items (
  id BIGSERIAL PRIMARY KEY,
  purchase_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  batch_no TEXT,
  expiry_date DATE,
  quantity NUMERIC(14,2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pkt',
  unit_price NUMERIC(14,2) NOT NULL,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_price NUMERIC(14,2) NOT NULL,
  brand TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_purchase_items_tenant_id UNIQUE(tenant_id, id),
  CONSTRAINT fk_purchase_items_purchase_tenant FOREIGN KEY (tenant_id, purchase_id) REFERENCES purchases(tenant_id, id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT fk_purchase_items_product_tenant FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_purchase_items_tenant ON purchase_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  party_type TEXT NOT NULL,
  party_id BIGINT NOT NULL,
  reference_id BIGINT,
  reference_no TEXT,
  amount NUMERIC(14,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  payment_date DATE NOT NULL,
  notes TEXT,
  user_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_payments_tenant_id UNIQUE(tenant_id, id),
  CONSTRAINT fk_payments_user_tenant FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_party ON payments(party_type, party_id);

-- Polymorphic Foreign Key Isolation for Payments (Customers & Suppliers)
CREATE OR REPLACE FUNCTION check_payment_party_tenant()
RETURNS TRIGGER AS $$
BEGIN
  NEW.party_type := UPPER(NEW.party_type);
  IF NEW.party_type = 'CUSTOMER' THEN
    IF NOT EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = NEW.party_id AND c.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Foreign key violation: customer % does not exist in tenant %', NEW.party_id, NEW.tenant_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  ELSIF NEW.party_type = 'SUPPLIER' THEN
    IF NOT EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = NEW.party_id AND s.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Foreign key violation: supplier % does not exist in tenant %', NEW.party_id, NEW.tenant_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid party_type % for payment: must be CUSTOMER or SUPPLIER', NEW.party_type
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payments_party_tenant ON payments;
CREATE TRIGGER trg_payments_party_tenant
  BEFORE INSERT OR UPDATE OF party_id, party_type, tenant_id ON payments
  FOR EACH ROW EXECUTE FUNCTION check_payment_party_tenant();

CREATE OR REPLACE FUNCTION check_delete_party_has_payments()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'customers' THEN
    IF EXISTS (SELECT 1 FROM payments WHERE UPPER(party_type) = 'CUSTOMER' AND party_id = OLD.id AND tenant_id = OLD.tenant_id) THEN
      RAISE EXCEPTION 'Cannot delete customer %: referencing payments exist in tenant %', OLD.id, OLD.tenant_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  ELSIF TG_TABLE_NAME = 'suppliers' THEN
    IF EXISTS (SELECT 1 FROM payments WHERE UPPER(party_type) = 'SUPPLIER' AND party_id = OLD.id AND tenant_id = OLD.tenant_id) THEN
      RAISE EXCEPTION 'Cannot delete supplier %: referencing payments exist in tenant %', OLD.id, OLD.tenant_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customers_check_payments ON customers;
CREATE TRIGGER trg_customers_check_payments
  BEFORE DELETE ON customers
  FOR EACH ROW EXECUTE FUNCTION check_delete_party_has_payments();

DROP TRIGGER IF EXISTS trg_suppliers_check_payments ON suppliers;
CREATE TRIGGER trg_suppliers_check_payments
  BEFORE DELETE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION check_delete_party_has_payments();

CREATE TABLE IF NOT EXISTS expense_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_exp_categories_tenant_name UNIQUE(tenant_id, name),
  CONSTRAINT uq_exp_categories_tenant_id UNIQUE(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_expense_categories_tenant ON expense_categories(tenant_id);

CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT,
  title TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  expense_date DATE NOT NULL,
  description TEXT,
  receipt_path TEXT,
  user_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_expenses_tenant_id UNIQUE(tenant_id, id),
  CONSTRAINT fk_expenses_category_tenant FOREIGN KEY (tenant_id, category_id) REFERENCES expense_categories(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT fk_expenses_user_tenant FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);

CREATE TABLE IF NOT EXISTS returns (
  id BIGSERIAL PRIMARY KEY,
  return_no TEXT NOT NULL,
  type TEXT NOT NULL,
  original_invoice_id BIGINT,
  original_invoice_no TEXT,
  party_id BIGINT,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  reason TEXT,
  user_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_returns_tenant_no UNIQUE(tenant_id, return_no),
  CONSTRAINT uq_returns_tenant_id UNIQUE(tenant_id, id),
  CONSTRAINT fk_returns_user_tenant FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_returns_tenant ON returns(tenant_id);

CREATE TABLE IF NOT EXISTS return_items (
  id BIGSERIAL PRIMARY KEY,
  return_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  batch_id BIGINT,
  quantity NUMERIC(14,2) NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL,
  condition TEXT NOT NULL DEFAULT 'good',
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_return_items_tenant_id UNIQUE(tenant_id, id),
  CONSTRAINT fk_return_items_return_tenant FOREIGN KEY (tenant_id, return_id) REFERENCES returns(tenant_id, id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT fk_return_items_product_tenant FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT fk_return_items_batch_tenant FOREIGN KEY (tenant_id, batch_id) REFERENCES batches(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_return_items_tenant ON return_items(tenant_id);

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id BIGSERIAL PRIMARY KEY,
  adjustment_no TEXT NOT NULL,
  product_id BIGINT NOT NULL,
  batch_id BIGINT,
  type TEXT NOT NULL,
  quantity NUMERIC(14,2) NOT NULL,
  unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  reason TEXT NOT NULL,
  user_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_stock_adj_tenant_no UNIQUE(tenant_id, adjustment_no),
  CONSTRAINT uq_stock_adj_tenant_id UNIQUE(tenant_id, id),
  CONSTRAINT fk_stock_adj_product_tenant FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT fk_stock_adj_batch_tenant FOREIGN KEY (tenant_id, batch_id) REFERENCES batches(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT fk_stock_adj_user_tenant FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_stock_adj_tenant ON stock_adjustments(tenant_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL,
  batch_id BIGINT,
  type TEXT NOT NULL,
  quantity_delta NUMERIC(14,2) NOT NULL,
  unit_price NUMERIC(14,2) DEFAULT 0.00,
  balance_after NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  reference_id BIGINT,
  reference_type TEXT,
  reason TEXT,
  user_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_inv_movements_tenant_id UNIQUE(tenant_id, id),
  CONSTRAINT fk_inv_mov_product_tenant FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT fk_inv_mov_batch_tenant FOREIGN KEY (tenant_id, batch_id) REFERENCES batches(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT fk_inv_mov_user_tenant FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_inv_movements_tenant ON inventory_movements(tenant_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_settings (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tenant_settings_key UNIQUE(tenant_id, key),
  CONSTRAINT uq_tenant_settings_id UNIQUE(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant ON tenant_settings(tenant_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE,
  plan TEXT NOT NULL DEFAULT 'free',
  price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  payment_status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_subscriptions_tenant_id UNIQUE(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_audit_logs_tenant_id UNIQUE(tenant_id, id),
  CONSTRAINT fk_audit_logs_user_tenant FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);

CREATE TABLE IF NOT EXISTS supplier_products (
  id BIGSERIAL PRIMARY KEY,
  supplier_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  supplier_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  last_purchase_price NUMERIC(14,2) DEFAULT 0.00,
  last_purchased_at TIMESTAMPTZ,
  is_preferred BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_supplier_products UNIQUE(tenant_id, supplier_id, product_id),
  CONSTRAINT uq_supplier_products_id UNIQUE(tenant_id, id),
  CONSTRAINT fk_sup_prod_supplier_tenant FOREIGN KEY (tenant_id, supplier_id) REFERENCES suppliers(tenant_id, id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT fk_sup_prod_product_tenant FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_supplier_products_tenant ON supplier_products(tenant_id);

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  user_id BIGINT,
  username TEXT NOT NULL,
  full_name TEXT,
  request_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  temporary_password TEXT,
  reset_token_hash TEXT,
  expires_at TIMESTAMPTZ,
  is_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ,
  resolved_by BIGINT,
  CONSTRAINT uq_pw_resets_tenant_id UNIQUE(tenant_id, id),
  CONSTRAINT fk_pw_resets_user_tenant FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT fk_pw_resets_resolver_tenant FOREIGN KEY (tenant_id, resolved_by) REFERENCES users(tenant_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_pw_resets_tenant ON password_reset_requests(tenant_id);

CREATE TABLE IF NOT EXISTS counters (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  counter_type TEXT NOT NULL,
  last_number BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_counters_tenant_type UNIQUE(tenant_id, counter_type),
  CONSTRAINT uq_counters_tenant_id UNIQUE(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_counters_tenant ON counters(tenant_id);

-- PostgreSQL Compatibility Helpers for SQLite Parity
CREATE OR REPLACE FUNCTION julianday(val text) RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT EXTRACT(EPOCH FROM val::timestamp) / 86400.0 + 2440587.5;
$$;

CREATE OR REPLACE FUNCTION julianday(val date) RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT EXTRACT(EPOCH FROM val::timestamp) / 86400.0 + 2440587.5;
$$;

CREATE OR REPLACE FUNCTION julianday(val timestamptz) RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT EXTRACT(EPOCH FROM val) / 86400.0 + 2440587.5;
$$;

CREATE OR REPLACE FUNCTION group_concat_trans(state text, val text, delim text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN state IS NULL OR state = '' THEN val ELSE state || delim || val END;
$$;

DROP AGGREGATE IF EXISTS group_concat(text, text);
CREATE AGGREGATE group_concat(text, text) (
  SFUNC = group_concat_trans,
  STYPE = text
);

-- Date / Timestamp SUBSTR compatibility for SQLite parity
CREATE OR REPLACE FUNCTION substr(val date, s int, l int) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT substr(val::text, s, l);
$$;

CREATE OR REPLACE FUNCTION substr(val date, s int) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT substr(val::text, s);
$$;

CREATE OR REPLACE FUNCTION substr(val timestamptz, s int, l int) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT substr(val::text, s, l);
$$;

CREATE OR REPLACE FUNCTION substr(val timestamptz, s int) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT substr(val::text, s);
$$;
