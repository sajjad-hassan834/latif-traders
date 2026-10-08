const { db } = require('../config/database');
const { logAudit } = require('../middleware/audit');

// List payments with filters
exports.getPayments = (req, res) => {
  try {
    const { type, party_type, start_date, end_date, payment_method } = req.query;

    let query = `
      SELECT p.*, u.full_name as user_name,
        CASE
          WHEN p.party_type = 'CUSTOMER' THEN (SELECT name FROM customers WHERE id = p.party_id)
          WHEN p.party_type = 'SUPPLIER' THEN (SELECT name FROM suppliers WHERE id = p.party_id)
          ELSE 'Other'
        END as party_name
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      query += ` AND p.type = ?`;
      params.push(type);
    }
    if (party_type) {
      query += ` AND p.party_type = ?`;
      params.push(party_type);
    }
    if (start_date) {
      query += ` AND p.payment_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND p.payment_date <= ?`;
      params.push(end_date);
    }
    if (payment_method) {
      query += ` AND p.payment_method = ?`;
      params.push(payment_method);
    }

    query += ` ORDER BY p.id DESC`;
    const payments = db.prepare(query).all(...params);

    return res.json({ success: true, payments });
  } catch (err) {
    console.error('Error fetching payments:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch payments.' });
  }
};

// Record Customer Receipt
exports.recordCustomerReceipt = (req, res) => {
  const transaction = db.transaction(() => {
    const { customer_id, amount, payment_method, payment_date, reference_no, notes } = req.body;

    if (!customer_id || !amount || Number(amount) <= 0) {
      throw new Error('Customer and a valid amount greater than 0 are required.');
    }

    const customer = db.prepare('SELECT id, name, current_balance FROM customers WHERE id = ?').get(customer_id);
    if (!customer) throw new Error('Customer not found.');

    const amt = Number(amount);
    const date = payment_date || new Date().toISOString().split('T')[0];
    const refNo = reference_no || `REC-${Date.now().toString().slice(-6)}`;

    const stmt = db.prepare(`
      INSERT INTO payments (type, party_type, party_id, reference_no, amount, payment_method, payment_date, notes, user_id)
      VALUES ('CUSTOMER_RECEIPT', 'CUSTOMER', ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(customer_id, refNo, amt, payment_method || 'Cash', date, notes || null, req.user.id);

    // Reduce customer receivable balance
    db.prepare('UPDATE customers SET current_balance = current_balance - ? WHERE id = ?').run(amt, customer_id);

    logAudit(req.user.id, req.user.full_name, 'RECEIPT', 'PAYMENT', result.lastInsertRowid, `Received ₨ ${amt} from customer ${customer.name} (${payment_method || 'Cash'})`, req);

    return { id: result.lastInsertRowid, ref_no: refNo, new_balance: customer.current_balance - amt };
  });

  try {
    const data = transaction();
    return res.status(201).json({ success: true, message: 'Customer payment receipt recorded.', data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Record Supplier Payment
exports.recordSupplierPayment = (req, res) => {
  const transaction = db.transaction(() => {
    const { supplier_id, amount, payment_method, payment_date, reference_no, notes } = req.body;

    if (!supplier_id || !amount || Number(amount) <= 0) {
      throw new Error('Supplier and a valid amount greater than 0 are required.');
    }

    const supplier = db.prepare('SELECT id, name, current_balance FROM suppliers WHERE id = ?').get(supplier_id);
    if (!supplier) throw new Error('Supplier not found.');

    const amt = Number(amount);
    const date = payment_date || new Date().toISOString().split('T')[0];
    const refNo = reference_no || `PAY-${Date.now().toString().slice(-6)}`;

    const stmt = db.prepare(`
      INSERT INTO payments (type, party_type, party_id, reference_no, amount, payment_method, payment_date, notes, user_id)
      VALUES ('SUPPLIER_PAYMENT', 'SUPPLIER', ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(supplier_id, refNo, amt, payment_method || 'Cash', date, notes || null, req.user.id);

    // Reduce supplier payable balance
    db.prepare('UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?').run(amt, supplier_id);

    logAudit(req.user.id, req.user.full_name, 'DISBURSEMENT', 'PAYMENT', result.lastInsertRowid, `Paid ₨ ${amt} to supplier ${supplier.name} (${payment_method || 'Cash'})`, req);

    return { id: result.lastInsertRowid, ref_no: refNo, new_balance: supplier.current_balance - amt };
  });

  try {
    const data = transaction();
    return res.status(201).json({ success: true, message: 'Supplier payment recorded.', data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Cashbook (Cash in, Cash out, Closing Cash)
exports.getCashbook = (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const today = new Date().toISOString().split('T')[0];
    const sDate = start_date || today;
    const eDate = end_date || today;

    // 1. Cash In:
    // - Customer Receipts in Cash (Ledger payments not tied to sale invoices)
    const receipts = db.prepare(`
      SELECT p.id, p.payment_date as date, p.reference_no as ref_no, 'Customer Receipt' as title,
        c.name as party_name, p.amount, 'IN' as flow, p.notes, 'CUSTOMER_RECEIPT' as source_type
      FROM payments p
      JOIN customers c ON p.party_id = c.id
      WHERE p.type = 'CUSTOMER_RECEIPT' AND p.payment_method = 'Cash'
        AND (p.reference_no IS NULL OR p.reference_no NOT LIKE 'INV-%')
        AND p.reference_id IS NULL
        AND (p.notes IS NULL OR (p.notes NOT LIKE '%Receipt for Invoice%' AND p.notes NOT LIKE '%INV-%'))
        AND p.payment_date >= ? AND p.payment_date <= ?
    `).all(sDate, eDate);

    // - Direct Cash Sales (POS Counter / Invoices)
    const cashSales = db.prepare(`
      SELECT s.id, s.sale_date as date, s.invoice_no as ref_no, 'Cash Sale (POS)' as title,
        COALESCE(c.name, 'Walk-in Customer') as party_name, s.paid_amount as amount, 'IN' as flow,
        ('Sale Invoice: ' || s.invoice_no) as notes, 'SALE' as source_type
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.payment_method = 'Cash' AND s.paid_amount > 0
        AND s.sale_date >= ? AND s.sale_date <= ?
    `).all(sDate, eDate);

    // 2. Cash Out:
    // - Supplier Payments in Cash (Ledger disbursements not tied to purchase bills)
    const disbursements = db.prepare(`
      SELECT p.id, p.payment_date as date, p.reference_no as ref_no, 'Supplier Payment' as title,
        s.name as party_name, p.amount, 'OUT' as flow, p.notes, 'SUPPLIER_PAYMENT' as source_type
      FROM payments p
      JOIN suppliers s ON p.party_id = s.id
      WHERE p.type = 'SUPPLIER_PAYMENT' AND p.payment_method = 'Cash'
        AND (p.reference_no IS NULL OR p.reference_no NOT LIKE 'PUR-%')
        AND p.reference_id IS NULL
        AND (p.notes IS NULL OR (p.notes NOT LIKE '%purchase bill%' AND p.notes NOT LIKE '%PUR-%'))
        AND p.payment_date >= ? AND p.payment_date <= ?
    `).all(sDate, eDate);

    // - Direct Cash Purchases / Restock
    const cashPurchases = db.prepare(`
      SELECT pu.id, pu.purchase_date as date, pu.invoice_no as ref_no, 'Cash Purchase' as title,
        s.name as party_name, pu.paid_amount as amount, 'OUT' as flow,
        ('Supplier Bill: ' || pu.invoice_no) as notes, 'PURCHASE' as source_type
      FROM purchases pu
      JOIN suppliers s ON pu.supplier_id = s.id
      WHERE pu.payment_method = 'Cash' AND pu.paid_amount > 0
        AND pu.purchase_date >= ? AND pu.purchase_date <= ?
    `).all(sDate, eDate);

    // - Expenses in Cash
    const cashExpenses = db.prepare(`
      SELECT e.id, e.expense_date as date, ('EXP-' || e.id) as ref_no, e.title,
        ec.name as party_name, e.amount, 'OUT' as flow, e.description as notes, 'EXPENSE' as source_type
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.payment_method = 'Cash'
        AND e.expense_date >= ? AND e.expense_date <= ?
    `).all(sDate, eDate);

    const entries = [...receipts, ...cashSales, ...disbursements, ...cashPurchases, ...cashExpenses];
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    let totalIn = 0;
    let totalOut = 0;
    for (const e of entries) {
      if (e.flow === 'IN') totalIn += e.amount;
      else totalOut += e.amount;
    }

    return res.json({
      success: true,
      start_date: sDate,
      end_date: eDate,
      total_in: totalIn,
      total_out: totalOut,
      net_cash_flow: totalIn - totalOut,
      entries
    });
  } catch (err) {
    console.error('Cashbook error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate cashbook.' });
  }
};

// Delete payment record (Admin / Accountant) - Reverses customer/supplier balance adjustment
exports.deletePayment = (req, res) => {
  const transaction = db.transaction(() => {
    const { id } = req.params;
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
    if (!payment) {
      throw new Error('Payment record not found.');
    }

    // Revert balance adjustments
    if (payment.party_type === 'CUSTOMER' && payment.party_id) {
      // Revert customer receipt by adding amount back to customer balance
      db.prepare('UPDATE customers SET current_balance = current_balance + ? WHERE id = ?')
        .run(payment.amount, payment.party_id);
    } else if (payment.party_type === 'SUPPLIER' && payment.party_id) {
      // Revert supplier payment by adding amount back to supplier payable balance
      db.prepare('UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?')
        .run(payment.amount, payment.party_id);
    }

    db.prepare('DELETE FROM payments WHERE id = ?').run(id);

    logAudit(
      req.user.id,
      req.user.full_name,
      'DELETE',
      'PAYMENT',
      payment.id,
      `Deleted payment record ${payment.reference_no || ('#' + payment.id)} for ₨ ${payment.amount}`,
      req
    );

    return { success: true, message: `Payment ${payment.reference_no || ('#' + payment.id)} deleted and balance reverted.` };
  });

  try {
    const result = transaction();
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
