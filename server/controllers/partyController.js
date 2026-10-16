const { db } = require('../config/database');
const { logAudit } = require('../middleware/audit');

// Customers CRUD
exports.getCustomers = (req, res) => {
  try {
    const { search, customer_type } = req.query;
    let query = 'SELECT * FROM customers WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ? OR address LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (customer_type) {
      query += ' AND customer_type = ?';
      params.push(customer_type);
    }

    query += ' ORDER BY name ASC';
    const customers = db.prepare(query).all(...params);
    return res.json({ success: true, customers });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch customers.' });
  }
};

exports.createCustomer = (req, res) => {
  try {
    const { name, phone, address, customer_type, opening_balance, credit_limit, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Customer name is required.' });

    const openBal = Number(opening_balance) || 0;
    const stmt = db.prepare(`
      INSERT INTO customers (name, phone, address, customer_type, opening_balance, credit_limit, current_balance, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name.trim(),
      phone ? phone.trim() : null,
      address ? address.trim() : null,
      customer_type || 'Retail',
      openBal,
      Number(credit_limit) || 0,
      openBal, // Initial current balance = opening balance
      notes ? notes.trim() : null
    );

    logAudit(req.user.id, req.user.full_name, 'CREATE', 'CUSTOMER', result.lastInsertRowid, `Added customer ${name}`, req);
    return res.status(201).json({ success: true, id: result.lastInsertRowid, message: 'Customer created.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateCustomer = (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, customer_type, credit_limit, notes } = req.body;

    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Customer not found.' });

    db.prepare(`
      UPDATE customers SET
        name = ?, phone = ?, address = ?, customer_type = ?, credit_limit = ?, notes = ?
      WHERE id = ?
    `).run(
      name ? name.trim() : existing.name,
      phone !== undefined ? phone : existing.phone,
      address !== undefined ? address : existing.address,
      customer_type || existing.customer_type,
      credit_limit !== undefined ? Number(credit_limit) : existing.credit_limit,
      notes !== undefined ? notes : existing.notes,
      id
    );

    logAudit(req.user.id, req.user.full_name, 'UPDATE', 'CUSTOMER', id, `Updated customer #${id}`, req);
    return res.json({ success: true, message: 'Customer updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update customer.' });
  }
};

exports.deleteCustomer = (req, res) => {
  try {
    const { id } = req.params;
    if (Number(id) === 1) {
      return res.status(400).json({ success: false, message: 'Cannot delete the default Walk-in / Counter customer.' });
    }

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    if (Math.abs(Number(customer.current_balance) || 0) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete customer "${customer.name}" with an active balance of ₨ ${customer.current_balance}. Please settle the balance first.`
      });
    }

    const deleteTransaction = db.transaction(() => {
      // Nullify customer reference in historical sales so sale invoices remain valid
      db.prepare('UPDATE sales SET customer_id = NULL WHERE customer_id = ?').run(id);
      // Delete party payment ledger records
      db.prepare("DELETE FROM payments WHERE party_type = 'CUSTOMER' AND party_id = ?").run(id);
      // Delete customer record
      db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    });

    deleteTransaction();

    logAudit(req.user.id, req.user.full_name, 'DELETE', 'CUSTOMER', id, `Deleted customer ${customer.name}`, req);
    return res.json({ success: true, message: `Customer "${customer.name}" deleted successfully.` });
  } catch (err) {
    console.error('Error deleting customer:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to delete customer.' });
  }
};

// Customer Ledger (Date-wise statement)
exports.getCustomerLedger = (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    // Collect Sales (Debit to customer), Payments/Receipts (Credit from customer), Returns (Credit to customer)
    let salesQuery = "SELECT id, invoice_no as ref_no, sale_date as date, 'SALE' as type, grand_total as amount, paid_amount, balance_due, notes FROM sales WHERE customer_id = ?";
    let paymentsQuery = "SELECT id, reference_no as ref_no, payment_date as date, 'RECEIPT' as type, amount, 0 as paid_amount, 0 as balance_due, notes, payment_method FROM payments WHERE party_type = 'CUSTOMER' AND party_id = ?";
    let returnsQuery = "SELECT id, return_no as ref_no, created_at as date, 'RETURN' as type, total_amount as amount, 0 as paid_amount, 0 as balance_due, reason as notes FROM returns WHERE type = 'SALE_RETURN' AND party_id = ?";

    const sParams = [id];
    const pParams = [id];
    const rParams = [id];

    if (start_date) {
      salesQuery += ' AND sale_date >= ?';
      paymentsQuery += ' AND payment_date >= ?';
      returnsQuery += ' AND date(created_at) >= ?';
      sParams.push(start_date);
      pParams.push(start_date);
      rParams.push(start_date);
    }

    if (end_date) {
      salesQuery += ' AND sale_date <= ?';
      paymentsQuery += ' AND payment_date <= ?';
      returnsQuery += ' AND date(created_at) <= ?';
      sParams.push(end_date);
      pParams.push(end_date);
      rParams.push(end_date);
    }

    const sales = db.prepare(salesQuery).all(...sParams);
    const payments = db.prepare(paymentsQuery).all(...pParams);
    const returns = db.prepare(returnsQuery).all(...rParams);

    // Combine and sort chronologically
    const allEntries = [];

    // Add opening balance
    const opnBal = Number(customer.opening_balance) || 0;
    allEntries.push({
      date: customer.created_at ? customer.created_at.split(' ')[0] : '2026-01-01',
      ref_no: 'OPN-BAL',
      type: 'OPENING',
      bill_amount: opnBal > 0 ? opnBal : 0,
      paid_amount: opnBal < 0 ? Math.abs(opnBal) : 0,
      balance_due: opnBal > 0 ? opnBal : 0,
      debit: opnBal > 0 ? opnBal : 0,
      credit: opnBal < 0 ? Math.abs(opnBal) : 0,
      notes: 'Initial account starting balance'
    });

    for (const s of sales) {
      const billTotal = Number(s.amount) || 0;
      const paidOnBill = Number(s.paid_amount) || 0;
      const unpaidDue = Number(s.balance_due) || 0;

      allEntries.push({
        id: s.id,
        date: s.date,
        ref_no: s.ref_no,
        type: 'SALE_INVOICE',
        bill_amount: billTotal,
        paid_amount: paidOnBill,
        balance_due: unpaidDue,
        debit: billTotal,
        credit: paidOnBill,
        notes: unpaidDue > 0
          ? `Bill: ${s.ref_no} (Paid: ₨ ${paidOnBill}, Debt Left: ₨ ${unpaidDue})`
          : `Bill: ${s.ref_no} (Paid in Full in Cash)`
      });
    }

    for (const p of payments) {
      const pAmt = Number(p.amount) || 0;
      allEntries.push({
        id: p.id,
        date: p.date,
        ref_no: p.ref_no,
        type: 'PAYMENT_RECEIPT',
        bill_amount: 0,
        paid_amount: pAmt,
        balance_due: 0,
        debit: 0,
        credit: pAmt,
        notes: p.notes || `Direct Payment Received (${p.payment_method || 'Cash'})`
      });
    }

    for (const r of returns) {
      const rAmt = Number(r.amount) || 0;
      allEntries.push({
        id: r.id,
        date: r.date ? r.date.split('T')[0] : '',
        ref_no: r.ref_no,
        type: 'SALE_RETURN',
        bill_amount: 0,
        paid_amount: rAmt,
        balance_due: 0,
        debit: 0,
        credit: rAmt,
        notes: r.notes || 'Returned Products Credit'
      });
    }

    // Sort by date ascending
    allEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    let running = 0;
    const ledger = allEntries.map(entry => {
      running += (entry.debit - entry.credit);
      return {
        ...entry,
        balance: running
      };
    });

    const totalPurchased = ledger.reduce((acc, l) => acc + (l.bill_amount || 0), 0);
    const totalPaid = ledger.reduce((acc, l) => acc + (l.paid_amount || 0), 0);

    return res.json({
      success: true,
      customer,
      ledger,
      summary: {
        total_purchased: totalPurchased,
        total_paid: totalPaid,
        total_debit: totalPurchased,
        total_credit: totalPaid,
        closing_balance: running
      }
    });
  } catch (err) {
    console.error('Customer ledger error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate customer ledger.' });
  }
};

// Suppliers CRUD
exports.getSuppliers = (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM suppliers WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ? OR contact_person LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY name ASC';
    const suppliers = db.prepare(query).all(...params);
    return res.json({ success: true, suppliers });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch suppliers.' });
  }
};

exports.createSupplier = (req, res) => {
  try {
    const { name, phone, address, contact_person, opening_balance, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Supplier name is required.' });

    const openBal = Number(opening_balance) || 0;
    const stmt = db.prepare(`
      INSERT INTO suppliers (name, phone, address, contact_person, opening_balance, current_balance, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name.trim(),
      phone ? phone.trim() : null,
      address ? address.trim() : null,
      contact_person ? contact_person.trim() : null,
      openBal,
      openBal,
      notes ? notes.trim() : null
    );

    logAudit(req.user.id, req.user.full_name, 'CREATE', 'SUPPLIER', result.lastInsertRowid, `Added supplier ${name}`, req);
    return res.status(201).json({ success: true, id: result.lastInsertRowid, message: 'Supplier created.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateSupplier = (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, contact_person, notes } = req.body;

    const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Supplier not found.' });

    db.prepare(`
      UPDATE suppliers SET
        name = ?, phone = ?, address = ?, contact_person = ?, notes = ?
      WHERE id = ?
    `).run(
      name ? name.trim() : existing.name,
      phone !== undefined ? phone : existing.phone,
      address !== undefined ? address : existing.address,
      contact_person !== undefined ? contact_person : existing.contact_person,
      notes !== undefined ? notes : existing.notes,
      id
    );

    logAudit(req.user.id, req.user.full_name, 'UPDATE', 'SUPPLIER', id, `Updated supplier #${id}`, req);
    return res.json({ success: true, message: 'Supplier updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update supplier.' });
  }
};

exports.deleteSupplier = (req, res) => {
  try {
    const { id } = req.params;

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found.' });
    }

    if (Math.abs(Number(supplier.current_balance) || 0) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete supplier "${supplier.name}" with an active payable balance of ₨ ${supplier.current_balance}. Please settle the balance first.`
      });
    }

    const deleteTransaction = db.transaction(() => {
      // Nullify supplier reference in historical purchases so purchase records remain valid
      db.prepare('UPDATE purchases SET supplier_id = NULL WHERE supplier_id = ?').run(id);
      // Delete party payment ledger records
      db.prepare("DELETE FROM payments WHERE party_type = 'SUPPLIER' AND party_id = ?").run(id);
      // Delete supplier record
      db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
    });

    deleteTransaction();

    logAudit(req.user.id, req.user.full_name, 'DELETE', 'SUPPLIER', id, `Deleted supplier ${supplier.name}`, req);
    return res.json({ success: true, message: `Supplier "${supplier.name}" deleted successfully.` });
  } catch (err) {
    console.error('Error deleting supplier:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to delete supplier.' });
  }
};

// Supplier Ledger (Date-wise statement)
exports.getSupplierLedger = (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });

    let purchasesQuery = "SELECT id, invoice_no as ref_no, purchase_date as date, 'PURCHASE' as type, grand_total as amount, paid_amount, balance_due, notes FROM purchases WHERE supplier_id = ?";
    let paymentsQuery = "SELECT id, reference_no as ref_no, payment_date as date, 'PAYMENT' as type, amount, notes FROM payments WHERE party_type = 'SUPPLIER' AND party_id = ?";
    let returnsQuery = "SELECT id, return_no as ref_no, created_at as date, 'RETURN' as type, total_amount as amount, reason as notes FROM returns WHERE type = 'PURCHASE_RETURN' AND party_id = ?";

    const purParams = [id];
    const payParams = [id];
    const retParams = [id];

    if (start_date) {
      purchasesQuery += ' AND purchase_date >= ?';
      paymentsQuery += ' AND payment_date >= ?';
      returnsQuery += ' AND date(created_at) >= ?';
      purParams.push(start_date);
      payParams.push(start_date);
      retParams.push(start_date);
    }

    if (end_date) {
      purchasesQuery += ' AND purchase_date <= ?';
      paymentsQuery += ' AND payment_date <= ?';
      returnsQuery += ' AND date(created_at) <= ?';
      purParams.push(end_date);
      payParams.push(end_date);
      retParams.push(end_date);
    }

    const purchases = db.prepare(purchasesQuery).all(...purParams);
    const payments = db.prepare(paymentsQuery).all(...payParams);
    const returns = db.prepare(returnsQuery).all(...retParams);

    const allEntries = [];

    // Opening balance
    allEntries.push({
      date: supplier.created_at ? supplier.created_at.split(' ')[0] : '2026-01-01',
      ref_no: 'OPN-BAL',
      type: 'OPENING',
      debit: 0,
      credit: supplier.opening_balance,
      notes: 'Initial opening payable'
    });

    for (const p of purchases) {
      allEntries.push({
        id: p.id,
        date: p.date,
        ref_no: p.ref_no,
        type: 'PURCHASE_BILL',
        debit: 0,
        credit: p.amount,
        notes: `Purchase Bill ${p.ref_no} (Paid: ₨ ${p.paid_amount})`
      });
    }

    for (const pay of payments) {
      allEntries.push({
        id: pay.id,
        date: pay.date,
        ref_no: pay.ref_no,
        type: 'SUPPLIER_PAYMENT',
        debit: pay.amount,
        credit: 0,
        notes: pay.notes || 'Payment to supplier'
      });
    }

    for (const r of returns) {
      allEntries.push({
        id: r.id,
        date: r.date ? r.date.split('T')[0] : '',
        ref_no: r.ref_no,
        type: 'PURCHASE_RETURN',
        debit: r.amount,
        credit: 0,
        notes: r.notes || 'Purchase return to supplier'
      });
    }

    allEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Running balance (Credit increases payable, Debit decreases payable)
    let running = 0;
    const ledger = allEntries.map(entry => {
      running += (entry.credit - entry.debit);
      return {
        ...entry,
        balance: running
      };
    });

    return res.json({
      success: true,
      supplier,
      ledger,
      summary: {
        total_credit: ledger.reduce((acc, l) => acc + l.credit, 0),
        total_debit: ledger.reduce((acc, l) => acc + l.debit, 0),
        closing_balance: running
      }
    });
  } catch (err) {
    console.error('Supplier ledger error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate supplier ledger.' });
  }
};

// Recalculate all supplier current_balance from actual purchase/payment/return data (Admin fix)
exports.recalculateSupplierBalances = (req, res) => {
  try {
    const suppliers = db.prepare('SELECT * FROM suppliers').all();
    let fixed = 0;

    const recalcTransaction = db.transaction(() => {
      for (const sup of suppliers) {
        // Correct balance = opening_balance + SUM(balance_due from purchases) - SUM(payments) - SUM(returns)
        const purchaseCredit = db.prepare(`
          SELECT COALESCE(SUM(balance_due), 0) as total FROM purchases WHERE supplier_id = ?
        `).get(sup.id).total;

        const paymentsMade = db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE party_type = 'SUPPLIER' AND party_id = ?
        `).get(sup.id).total;

        const returnsMade = db.prepare(`
          SELECT COALESCE(SUM(total_amount), 0) as total FROM returns WHERE type = 'PURCHASE_RETURN' AND party_id = ?
        `).get(sup.id).total;

        const correctBalance = (Number(sup.opening_balance) || 0) + purchaseCredit - paymentsMade - returnsMade;
        const oldBalance = Number(sup.current_balance) || 0;

        if (Math.abs(correctBalance - oldBalance) > 0.01) {
          db.prepare('UPDATE suppliers SET current_balance = ? WHERE id = ?').run(correctBalance, sup.id);
          fixed++;
        }
      }
    });

    recalcTransaction();

    logAudit(req.user.id, req.user.full_name, 'RECALCULATE', 'SUPPLIER', null, `Recalculated all supplier balances. Fixed ${fixed} suppliers.`, req);
    return res.json({ success: true, message: `Recalculated supplier balances. ${fixed} supplier(s) were corrected.`, fixed });
  } catch (err) {
    console.error('Recalculate supplier balances error:', err);
    return res.status(500).json({ success: false, message: 'Failed to recalculate supplier balances.' });
  }
};
