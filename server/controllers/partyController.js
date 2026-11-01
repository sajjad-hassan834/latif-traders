const { db } = require('../config/database');
const { logAudit } = require('../middleware/audit');
const ledgerService = require('../services/ledgerService');

// Customers CRUD
exports.getCustomers = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { search, customer_type } = req.query;
    let query = 'SELECT * FROM customers WHERE tenant_id = ?';
    const params = [tenantId];

    if (search) {
      query += ' AND (name ILIKE ? OR phone ILIKE ? OR address ILIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (customer_type) {
      query += ' AND customer_type = ?';
      params.push(customer_type);
    }

    query += ' ORDER BY name ASC';
    const customers = await db.all(query, params);
    return res.json({ success: true, customers });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch customers.' });
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { name, phone, address, customer_type, opening_balance, credit_limit, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Customer name is required.' });

    const openBal = Number(opening_balance) || 0;
    const result = await db.run(`
      INSERT INTO customers (tenant_id, name, phone, address, customer_type, opening_balance, credit_limit, current_balance, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId,
      name.trim(),
      phone ? phone.trim() : null,
      address ? address.trim() : null,
      customer_type || 'Retail',
      openBal,
      Number(credit_limit) || 0,
      openBal,
      notes ? notes.trim() : null
    ]);

    await logAudit(req.user.id, req.user.full_name, 'CREATE', 'CUSTOMER', result.lastInsertRowid, `Added customer ${name}`, req);
    return res.status(201).json({ success: true, id: result.lastInsertRowid, message: 'Customer created.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { id } = req.params;
    const { name, phone, address, customer_type, credit_limit, opening_balance, notes } = req.body;

    const existing = await db.get('SELECT * FROM customers WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    if (!existing) return res.status(404).json({ success: false, message: 'Customer not found.' });

    await db.run(`
      UPDATE customers SET
        name = ?, phone = ?, address = ?, customer_type = ?, credit_limit = ?, opening_balance = ?, notes = ?
      WHERE id = ? AND tenant_id = ?
    `, [
      name ? name.trim() : existing.name,
      phone !== undefined ? phone : existing.phone,
      address !== undefined ? address : existing.address,
      customer_type || existing.customer_type,
      credit_limit !== undefined ? Number(credit_limit) : existing.credit_limit,
      opening_balance !== undefined ? Number(opening_balance) : existing.opening_balance,
      notes !== undefined ? notes : existing.notes,
      id,
      tenantId
    ]);

    if (opening_balance !== undefined) {
      try {
        await ledgerService.syncCustomerBalances(tenantId, [id]);
      } catch (_) {}
    }

    await logAudit(req.user.id, req.user.full_name, 'UPDATE', 'CUSTOMER', id, `Updated customer #${id}`, req);
    return res.json({ success: true, message: 'Customer updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update customer.' });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { id } = req.params;

    const customer = await db.get('SELECT * FROM customers WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    if (customer.name.toLowerCase().includes('walk-in') || customer.name.toLowerCase().includes('counter')) {
      return res.status(400).json({ success: false, message: 'Cannot delete the default Walk-in / Counter customer.' });
    }

    if (Math.abs(Number(customer.current_balance) || 0) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete customer "${customer.name}" with an active balance of ₨ ${customer.current_balance}. Please settle the balance first.`
      });
    }

    await db.transaction(async () => {
      await db.run('UPDATE sales SET customer_id = NULL WHERE customer_id = ? AND tenant_id = ?', [id, tenantId]);
      await db.run("DELETE FROM payments WHERE party_type = 'CUSTOMER' AND party_id = ? AND tenant_id = ?", [id, tenantId]);
      await db.run('DELETE FROM customers WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    });

    await logAudit(req.user.id, req.user.full_name, 'DELETE', 'CUSTOMER', id, `Deleted customer ${customer.name}`, req);
    return res.json({ success: true, message: `Customer "${customer.name}" deleted successfully.` });
  } catch (err) {
    console.error('Error deleting customer:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to delete customer.' });
  }
};

// Customer Ledger (Date-wise statement using Single Source of Truth ledgerService)
exports.getCustomerLedger = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    const result = await ledgerService.calculateCustomerLedger(id, tenantId, {
      startDate: start_date,
      endDate: end_date,
      reverse: true
    });

    return res.json({
      success: true,
      customer: result.customer,
      ledger: result.ledger,
      chronological_ledger: result.chronological_ledger,
      summary: result.summary
    });
  } catch (err) {
    console.error('Customer ledger error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to generate customer ledger.' });
  }
};

// Suppliers CRUD
exports.getSuppliers = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { search } = req.query;
    let query = 'SELECT * FROM suppliers WHERE tenant_id = ?';
    const params = [tenantId];

    if (search) {
      query += ' AND (name ILIKE ? OR phone ILIKE ? OR contact_person ILIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY name ASC';
    const suppliers = await db.all(query, params);
    return res.json({ success: true, suppliers });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch suppliers.' });
  }
};

exports.createSupplier = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { name, phone, address, contact_person, opening_balance, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Supplier name is required.' });

    const openBal = Number(opening_balance) || 0;
    const result = await db.run(`
      INSERT INTO suppliers (tenant_id, name, phone, address, contact_person, opening_balance, current_balance, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId,
      name.trim(),
      phone ? phone.trim() : null,
      address ? address.trim() : null,
      contact_person ? contact_person.trim() : null,
      openBal,
      openBal,
      notes ? notes.trim() : null
    ]);

    await logAudit(req.user.id, req.user.full_name, 'CREATE', 'SUPPLIER', result.lastInsertRowid, `Added supplier ${name}`, req);
    return res.status(201).json({ success: true, id: result.lastInsertRowid, message: 'Supplier created.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateSupplier = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { id } = req.params;
    const { name, phone, address, contact_person, opening_balance, notes } = req.body;

    const existing = await db.get('SELECT * FROM suppliers WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    if (!existing) return res.status(404).json({ success: false, message: 'Supplier not found.' });

    await db.run(`
      UPDATE suppliers SET
        name = ?, phone = ?, address = ?, contact_person = ?, opening_balance = ?, notes = ?
      WHERE id = ? AND tenant_id = ?
    `, [
      name ? name.trim() : existing.name,
      phone !== undefined ? phone : existing.phone,
      address !== undefined ? address : existing.address,
      contact_person !== undefined ? contact_person : existing.contact_person,
      opening_balance !== undefined ? Number(opening_balance) : existing.opening_balance,
      notes !== undefined ? notes : existing.notes,
      id,
      tenantId
    ]);

    if (opening_balance !== undefined) {
      try {
        await ledgerService.syncSupplierBalances(tenantId, [id]);
      } catch (_) {}
    }

    await logAudit(req.user.id, req.user.full_name, 'UPDATE', 'SUPPLIER', id, `Updated supplier #${id}`, req);
    return res.json({ success: true, message: 'Supplier updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update supplier.' });
  }
};

exports.deleteSupplier = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { id } = req.params;

    const supplier = await db.get('SELECT * FROM suppliers WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found.' });
    }

    if (Math.abs(Number(supplier.current_balance) || 0) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete supplier "${supplier.name}" with an active payable balance of ₨ ${supplier.current_balance}. Please settle the balance first.`
      });
    }

    await db.transaction(async () => {
      await db.run('UPDATE purchases SET supplier_id = NULL WHERE supplier_id = ? AND tenant_id = ?', [id, tenantId]);
      await db.run("DELETE FROM payments WHERE party_type = 'SUPPLIER' AND party_id = ? AND tenant_id = ?", [id, tenantId]);
      await db.run('DELETE FROM suppliers WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    });

    await logAudit(req.user.id, req.user.full_name, 'DELETE', 'SUPPLIER', id, `Deleted supplier ${supplier.name}`, req);
    return res.json({ success: true, message: `Supplier "${supplier.name}" deleted successfully.` });
  } catch (err) {
    console.error('Error deleting supplier:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to delete supplier.' });
  }
};

// Supplier Ledger (Date-wise statement using Single Source of Truth ledgerService)
exports.getSupplierLedger = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    const result = await ledgerService.calculateSupplierLedger(id, tenantId, {
      startDate: start_date,
      endDate: end_date,
      reverse: true
    });

    return res.json({
      success: true,
      supplier: result.supplier,
      ledger: result.ledger,
      chronological_ledger: result.chronological_ledger,
      summary: result.summary
    });
  } catch (err) {
    console.error('Supplier ledger error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to generate supplier ledger.' });
  }
};

// Customer Balances Audit (Read-Only Diff Preview)
exports.auditCustomerBalances = async (req, res) => {
  try {

    const tenantId = req.tenantId || req.tenant_id;
    const audit = await ledgerService.auditCustomerBalances(tenantId);
    return res.json({ success: true, ...audit });
  } catch (err) {
    console.error('Audit customer balances error:', err);
    return res.status(500).json({ success: false, message: 'Failed to audit customer balances.' });
  }
};

// Customer Balances Sync (Admin-Confirmed Action)
exports.syncCustomerBalances = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { customer_ids } = req.body;
    const syncRes = await ledgerService.syncCustomerBalances(tenantId, customer_ids);

    await logAudit(
      req.user.id,
      req.user.full_name,
      'SYNC',
      'CUSTOMER_BALANCES',
      null,
      `Audited & synchronized balances for ${syncRes.updated_count} customer(s).`,
      req
    );

    return res.json({
      success: true,
      message: `Synchronized ${syncRes.updated_count} customer balance(s) with verified ledger entries.`,
      ...syncRes
    });
  } catch (err) {
    console.error('Sync customer balances error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to sync customer balances.' });
  }
};

// Supplier Balances Audit (Read-Only Diff Preview)
exports.auditSupplierBalances = async (req, res) => {
  try {

    const tenantId = req.tenantId || req.tenant_id;
    const audit = await ledgerService.auditSupplierBalances(tenantId);
    return res.json({ success: true, ...audit });
  } catch (err) {
    console.error('Audit supplier balances error:', err);
    return res.status(500).json({ success: false, message: 'Failed to audit supplier balances.' });
  }
};

// Supplier Balances Sync (Admin-Confirmed Action)
exports.syncSupplierBalances = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { supplier_ids } = req.body;
    const syncRes = await ledgerService.syncSupplierBalances(tenantId, supplier_ids);

    await logAudit(
      req.user.id,
      req.user.full_name,
      'SYNC',
      'SUPPLIER_BALANCES',
      null,
      `Audited & synchronized balances for ${syncRes.updated_count} supplier(s).`,
      req
    );

    return res.json({
      success: true,
      message: `Synchronized ${syncRes.updated_count} supplier balance(s) with verified ledger entries.`,
      ...syncRes
    });
  } catch (err) {
    console.error('Sync supplier balances error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to sync supplier balances.' });
  }
};

// Backwards-compatible endpoints for recalculate buttons
exports.recalculateCustomerBalances = (req, res) => {
  return exports.syncCustomerBalances(req, res);
};

exports.recalculateSupplierBalances = (req, res) => {
  return exports.syncSupplierBalances(req, res);
};
