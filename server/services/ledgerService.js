const { db } = require('../config/database');

/**
 * Single Source of Truth for Ledger Calculations (Customers & Suppliers)
 * Enforces strict double-entry accounting rules across the platform:
 *  - Invoices debit customer (credit supplier)
 *  - Payments & receipts credit customer (debit supplier)
 *  - Returns credit customer (debit supplier)
 *  - Opening balance debits/credits according to sign
 *  - Running balance is chronologically calculated oldest-to-newest
 */

function calculateCustomerLedger(customerId, tenantId, options = {}) {
  const { startDate, endDate, reverse = true } = options;

  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND tenant_id = ?').get(customerId, tenantId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  // 1. Fetch sales invoices
  const sales = db.prepare(`
    SELECT id, invoice_no as ref_no, sale_date as date, 'SALE' as type,
           grand_total, paid_amount, balance_due, payment_method, notes
    FROM sales
    WHERE customer_id = ? AND tenant_id = ?
    ORDER BY sale_date ASC, id ASC
  `).all(customerId, tenantId);

  // 2. Fetch payments (both POS payments and standalone customer receipts/refunds)
  const payments = db.prepare(`
    SELECT id, type, reference_id, reference_no as ref_no, payment_date as date,
           amount, payment_method, notes
    FROM payments
    WHERE party_type = 'CUSTOMER' AND party_id = ? AND tenant_id = ?
    ORDER BY payment_date ASC, id ASC
  `).all(customerId, tenantId);

  // 3. Fetch returns
  const returns = db.prepare(`
    SELECT id, return_no as ref_no, created_at as date, 'RETURN' as type,
           total_amount as amount, reason as notes
    FROM returns
    WHERE type = 'SALE_RETURN' AND party_id = ? AND tenant_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(customerId, tenantId);

  // Build unified chronological entry pool
  const rawEntries = [];

  // Opening Balance
  const opnBal = Number(customer.opening_balance) || 0;
  if (opnBal !== 0) {
    const isDebit = opnBal > 0;
    rawEntries.push({
      id: 'opn-' + customer.id,
      date: customer.created_at ? customer.created_at.split(' ')[0] : '2026-01-01',
      ref_no: 'OPN-BAL',
      type: 'OPENING',
      debit: isDebit ? opnBal : 0,
      credit: !isDebit ? Math.abs(opnBal) : 0,
      bill_amount: isDebit ? opnBal : 0,
      received_amount: !isDebit ? Math.abs(opnBal) : 0,
      notes: 'Initial account starting balance',
      payment_method: null,
      sort_order: 1
    });
  }

  // Sales Invoices
  // Map of sale id to sale row for reference
  const salesMap = new Map();
  for (const s of sales) {
    salesMap.set(s.id, s);
    const grandTotal = Number(s.grand_total) || 0;
    const paidAmt = Number(s.paid_amount) || 0;
    const dueAmt = Number(s.balance_due) || 0;

    let statusChip = 'UNPAID';
    let statusLabel = 'Unpaid';
    if (paidAmt >= grandTotal && grandTotal > 0) {
      if (paidAmt > grandTotal) {
        statusChip = 'OVERPAID';
        statusLabel = 'Overpaid';
      } else {
        statusChip = 'PAID';
        statusLabel = 'Paid in Full';
      }
    } else if (paidAmt > 0) {
      statusChip = 'PARTIAL';
      statusLabel = `Partial (₨ ${dueAmt.toLocaleString()} due)`;
    }

    rawEntries.push({
      id: s.id,
      sale_id: s.id,
      date: s.date,
      ref_no: s.ref_no,
      type: 'SALE_INVOICE',
      debit: grandTotal,
      credit: 0, // Invoice itself only debits; payments are distinct credit rows
      bill_amount: grandTotal,
      received_amount: 0,
      invoice_grand_total: grandTotal,
      invoice_paid: paidAmt,
      invoice_due: dueAmt,
      status_chip: statusChip,
      status_label: statusLabel,
      payment_method: s.payment_method,
      notes: s.notes || (dueAmt > 0 ? `Credit Sale (₨ ${dueAmt.toLocaleString()} due)` : `Settled Sale`),
      sort_order: 2
    });
  }

  // Payments / Receipts
  // Check which sales already have explicit payment rows in `payments`
  const saleIdsWithPayments = new Set();
  for (const p of payments) {
    if (p.reference_id && p.type !== 'CUSTOMER_REFUND') {
      saleIdsWithPayments.add(Number(p.reference_id));
    }
  }

  // Include explicit payment rows
  for (const p of payments) {
    const pAmt = Number(p.amount) || 0;
    const isRefund = p.type === 'CUSTOMER_REFUND';
    const linkedSale = p.reference_id ? salesMap.get(Number(p.reference_id)) : null;

    if (isRefund) {
      rawEntries.push({
        id: p.id,
        payment_id: p.id,
        reference_id: p.reference_id || null,
        date: p.date,
        ref_no: p.ref_no,
        type: 'CUSTOMER_REFUND',
        debit: pAmt, // Refund paid to customer increases their receivable/debit
        credit: 0,
        bill_amount: 0,
        received_amount: 0,
        payment_method: p.payment_method || 'Cash',
        notes: p.notes || `Cash Refund paid on Return ${p.ref_no}`,
        sort_order: 3
      });
      continue;
    }

    let desc = p.notes || `Payment received - ${p.payment_method || 'Cash'}`;
    let isExtraPayment = false;
    let extraAmount = 0;

    if (linkedSale) {
      const saleTotal = Number(linkedSale.grand_total) || 0;
      if (pAmt > saleTotal) {
        isExtraPayment = true;
        extraAmount = pAmt - saleTotal;
        desc = `Payment received - ${p.payment_method || 'Cash'} (Bill ${linkedSale.ref_no} settled + ₨ ${extraAmount.toLocaleString()} extra applied to account)`;
      } else {
        desc = `Payment received - ${p.payment_method || 'Cash'} (Bill ${linkedSale.ref_no})`;
      }
    }

    rawEntries.push({
      id: p.id,
      payment_id: p.id,
      reference_id: p.reference_id || null,
      date: p.date,
      ref_no: p.ref_no,
      type: 'PAYMENT_RECEIPT',
      debit: 0,
      credit: pAmt,
      bill_amount: 0,
      received_amount: pAmt,
      is_extra_payment: isExtraPayment,
      extra_amount: extraAmount,
      payment_method: p.payment_method || 'Cash',
      notes: desc,
      sort_order: 3
    });
  }

  // Backfill synthetic payment receipt rows for any legacy sales that have `paid_amount > 0`
  // but were created before the dual-write to `payments` table was introduced.
  for (const s of sales) {
    const paidAmt = Number(s.paid_amount) || 0;
    if (paidAmt > 0 && !saleIdsWithPayments.has(s.id)) {
      const grandTotal = Number(s.grand_total) || 0;
      let isExtraPayment = false;
      let extraAmount = 0;
      let desc = `Payment received - ${s.payment_method || 'Cash'} (Bill ${s.ref_no})`;
      if (paidAmt > grandTotal) {
        isExtraPayment = true;
        extraAmount = paidAmt - grandTotal;
        desc = `Payment received - ${s.payment_method || 'Cash'} (Bill ${s.ref_no} settled + ₨ ${extraAmount.toLocaleString()} extra applied to account)`;
      }

      rawEntries.push({
        id: `legacy-sale-pay-${s.id}`,
        payment_id: null,
        reference_id: s.id,
        date: s.date,
        ref_no: `REC-${s.ref_no.replace('INV-', '')}`,
        type: 'PAYMENT_RECEIPT',
        debit: 0,
        credit: paidAmt,
        bill_amount: 0,
        received_amount: paidAmt,
        is_extra_payment: isExtraPayment,
        extra_amount: extraAmount,
        payment_method: s.payment_method || 'Cash',
        notes: desc,
        sort_order: 3
      });
    }
  }

  // Returns
  for (const r of returns) {
    const rAmt = Number(r.amount) || 0;
    rawEntries.push({
      id: r.id,
      return_id: r.id,
      date: r.date ? r.date.split('T')[0] : '',
      ref_no: r.ref_no,
      type: 'SALE_RETURN',
      debit: 0,
      credit: rAmt,
      bill_amount: 0,
      received_amount: 0,
      return_amount: rAmt,
      payment_method: null,
      notes: r.notes || 'Returned Products Credit',
      sort_order: 4
    });
  }

  // Sort chronological: oldest to newest
  rawEntries.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  // Calculate chronological running balance
  let running = 0;
  const fullChronologicalLedger = rawEntries.map(entry => {
    running += (entry.debit - entry.credit);
    return {
      ...entry,
      running_balance: running,
      balance: running
    };
  });

  // Overall totals across entire history
  const totalBilled = fullChronologicalLedger.reduce((acc, l) => acc + (l.type === 'SALE_INVOICE' ? l.debit : (l.type === 'OPENING' && l.debit > 0 ? l.debit : 0)), 0);
  const totalReceived = fullChronologicalLedger.reduce((acc, l) => acc + (l.type === 'PAYMENT_RECEIPT' ? l.credit : (l.type === 'OPENING' && l.credit > 0 ? l.credit : 0)), 0);
  const totalReturns = fullChronologicalLedger.reduce((acc, l) => acc + (l.type === 'SALE_RETURN' ? l.credit : 0), 0);
  const closingBalance = running;

  // Filter for requested date window if specified
  let displayedLedger = fullChronologicalLedger;
  if (startDate || endDate) {
    displayedLedger = fullChronologicalLedger.filter(entry => {
      if (startDate && entry.date < startDate) return false;
      if (endDate && entry.date > endDate) return false;
      return true;
    });
  }

  const resultLedger = reverse ? [...displayedLedger].reverse() : displayedLedger;

  return {
    customer,
    ledger: resultLedger,
    chronological_ledger: fullChronologicalLedger,
    summary: {
      total_purchased: totalBilled,
      total_billed: totalBilled,
      total_paid: totalReceived,
      total_received: totalReceived,
      total_returns: totalReturns,
      total_debit: totalBilled,
      total_credit: totalReceived + totalReturns,
      closing_balance: closingBalance,
      pending_balance: closingBalance
    }
  };
}

function calculateSupplierLedger(supplierId, tenantId, options = {}) {
  const { startDate, endDate, reverse = true } = options;

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ? AND tenant_id = ?').get(supplierId, tenantId);
  if (!supplier) {
    throw new Error('Supplier not found');
  }

  const purchases = db.prepare(`
    SELECT id, invoice_no as ref_no, purchase_date as date, 'PURCHASE' as type,
           grand_total, paid_amount, balance_due, notes
    FROM purchases
    WHERE supplier_id = ? AND tenant_id = ?
    ORDER BY purchase_date ASC, id ASC
  `).all(supplierId, tenantId);

  const payments = db.prepare(`
    SELECT id, reference_id, reference_no as ref_no, payment_date as date, 'PAYMENT' as type,
           amount, notes, payment_method
    FROM payments
    WHERE party_type = 'SUPPLIER' AND party_id = ? AND tenant_id = ?
    ORDER BY payment_date ASC, id ASC
  `).all(supplierId, tenantId);

  const returns = db.prepare(`
    SELECT id, return_no as ref_no, created_at as date, 'RETURN' as type,
           total_amount as amount, reason as notes
    FROM returns
    WHERE type = 'PURCHASE_RETURN' AND party_id = ? AND tenant_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(supplierId, tenantId);

  const rawEntries = [];

  // Opening Balance
  const opnBal = Number(supplier.opening_balance) || 0;
  if (opnBal !== 0) {
    const isCredit = opnBal > 0;
    rawEntries.push({
      id: 'opn-' + supplier.id,
      date: supplier.created_at ? supplier.created_at.split(' ')[0] : '2026-01-01',
      ref_no: 'OPN-BAL',
      type: 'OPENING',
      debit: !isCredit ? Math.abs(opnBal) : 0,
      credit: isCredit ? opnBal : 0,
      notes: 'Initial opening payable balance',
      sort_order: 1
    });
  }

  // Purchases
  const purchasesMap = new Map();
  for (const p of purchases) {
    purchasesMap.set(p.id, p);
    const grandTotal = Number(p.grand_total) || 0;
    const paidAmt = Number(p.paid_amount) || 0;
    const dueAmt = Number(p.balance_due) || 0;

    rawEntries.push({
      id: p.id,
      purchase_id: p.id,
      date: p.date,
      ref_no: p.ref_no,
      type: 'PURCHASE_BILL',
      debit: 0,
      credit: grandTotal,
      bill_amount: grandTotal,
      paid_amount: 0,
      balance_due: dueAmt,
      notes: `Purchase Bill ${p.ref_no}${dueAmt > 0 ? ` (₨ ${dueAmt.toLocaleString()} due)` : ''}`,
      sort_order: 2
    });
  }

  // Payments to Supplier
  const purchaseIdsWithPayments = new Set();
  for (const pay of payments) {
    if (pay.reference_id) {
      purchaseIdsWithPayments.add(Number(pay.reference_id));
    }
  }

  for (const pay of payments) {
    const pAmt = Number(pay.amount) || 0;
    const linkedPurchase = pay.reference_id ? purchasesMap.get(Number(pay.reference_id)) : null;

    let desc = pay.notes || `Payment to supplier - ${pay.payment_method || 'Cash'}`;
    if (linkedPurchase) {
      desc = `Payment to supplier (${linkedPurchase.ref_no})`;
    }

    rawEntries.push({
      id: pay.id,
      payment_id: pay.id,
      reference_id: pay.reference_id || null,
      date: pay.date,
      ref_no: pay.ref_no,
      type: 'SUPPLIER_PAYMENT',
      debit: pAmt,
      credit: 0,
      received_amount: pAmt,
      notes: desc,
      sort_order: 3
    });
  }

  // Backfill synthetic payments for any legacy purchases where paid_amount > 0 and no row in payments
  for (const p of purchases) {
    const paidAmt = Number(p.paid_amount) || 0;
    if (paidAmt > 0 && !purchaseIdsWithPayments.has(p.id)) {
      rawEntries.push({
        id: `legacy-purchase-pay-${p.id}`,
        payment_id: null,
        reference_id: p.id,
        date: p.date,
        ref_no: `PAY-${p.ref_no.replace('PUR-', '')}`,
        type: 'SUPPLIER_PAYMENT',
        debit: paidAmt,
        credit: 0,
        received_amount: paidAmt,
        notes: `Payment on purchase ${p.ref_no}`,
        sort_order: 3
      });
    }
  }

  // Returns to Supplier
  for (const r of returns) {
    const rAmt = Number(r.amount) || 0;
    rawEntries.push({
      id: r.id,
      return_id: r.id,
      date: r.date ? r.date.split('T')[0] : '',
      ref_no: r.ref_no,
      type: 'PURCHASE_RETURN',
      debit: rAmt,
      credit: 0,
      notes: r.notes || 'Purchase return credit',
      sort_order: 4
    });
  }

  // Sort chronological
  rawEntries.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  // Running balance for supplier: credit increases payable, debit decreases payable
  let running = 0;
  const fullChronologicalLedger = rawEntries.map(entry => {
    running += (entry.credit - entry.debit);
    return {
      ...entry,
      running_balance: running,
      balance: running
    };
  });

  const totalBilled = fullChronologicalLedger.reduce((acc, l) => acc + (l.type === 'PURCHASE_BILL' ? l.credit : (l.type === 'OPENING' && l.credit > 0 ? l.credit : 0)), 0);
  const totalPaid = fullChronologicalLedger.reduce((acc, l) => acc + (l.type === 'SUPPLIER_PAYMENT' ? l.debit : (l.type === 'OPENING' && l.debit > 0 ? l.debit : 0)), 0);
  const totalReturns = fullChronologicalLedger.reduce((acc, l) => acc + (l.type === 'PURCHASE_RETURN' ? l.debit : 0), 0);
  const closingBalance = running;

  let displayedLedger = fullChronologicalLedger;
  if (startDate || endDate) {
    displayedLedger = fullChronologicalLedger.filter(entry => {
      if (startDate && entry.date < startDate) return false;
      if (endDate && entry.date > endDate) return false;
      return true;
    });
  }

  const resultLedger = reverse ? [...displayedLedger].reverse() : displayedLedger;

  return {
    supplier,
    ledger: resultLedger,
    chronological_ledger: fullChronologicalLedger,
    summary: {
      total_purchased: totalBilled,
      total_billed: totalBilled,
      total_paid: totalPaid,
      total_returns: totalReturns,
      total_credit: totalBilled,
      total_debit: totalPaid + totalReturns,
      closing_balance: closingBalance,
      pending_balance: closingBalance
    }
  };
}

/**
 * Audit Customer Balances
 * Compares stored `customers.current_balance` against true ledger calculation
 * Returns list of discrepancies without mutating data.
 */
function auditCustomerBalances(tenantId) {
  const customers = db.prepare('SELECT id, name, phone, opening_balance, current_balance FROM customers WHERE tenant_id = ?').all(tenantId);
  const discrepancies = [];

  for (const c of customers) {
    const calc = calculateCustomerLedger(c.id, tenantId, { reverse: false });
    const stored = Number(c.current_balance) || 0;
    const computed = Number(calc.summary.closing_balance) || 0;
    const diff = computed - stored;

    if (Math.abs(diff) > 0.01) {
      discrepancies.push({
        id: c.id,
        name: c.name,
        phone: c.phone,
        stored_balance: stored,
        calculated_balance: computed,
        diff: diff
      });
    }
  }

  return {
    total_checked: customers.length,
    discrepancies_count: discrepancies.length,
    discrepancies
  };
}

/**
 * Sync Customer Balances
 * Requires admin authorization. Safely updates stored balances to match true ledger.
 */
function syncCustomerBalances(tenantId, customerIds = null) {
  const audit = auditCustomerBalances(tenantId);
  const toSync = customerIds && Array.isArray(customerIds)
    ? audit.discrepancies.filter(d => customerIds.includes(d.id))
    : audit.discrepancies;

  if (toSync.length === 0) {
    return { success: true, updated_count: 0, details: [] };
  }

  const syncTx = db.transaction(() => {
    const updateStmt = db.prepare('UPDATE customers SET current_balance = ? WHERE id = ? AND tenant_id = ?');
    for (const d of toSync) {
      updateStmt.run(d.calculated_balance, d.id, tenantId);
    }
  });

  syncTx();

  return {
    success: true,
    updated_count: toSync.length,
    details: toSync
  };
}

/**
 * Audit Supplier Balances
 */
function auditSupplierBalances(tenantId) {
  const suppliers = db.prepare('SELECT id, name, phone, opening_balance, current_balance FROM suppliers WHERE tenant_id = ?').all(tenantId);
  const discrepancies = [];

  for (const s of suppliers) {
    const calc = calculateSupplierLedger(s.id, tenantId, { reverse: false });
    const stored = Number(s.current_balance) || 0;
    const computed = Number(calc.summary.closing_balance) || 0;
    const diff = computed - stored;

    if (Math.abs(diff) > 0.01) {
      discrepancies.push({
        id: s.id,
        name: s.name,
        phone: s.phone,
        stored_balance: stored,
        calculated_balance: computed,
        diff: diff
      });
    }
  }

  return {
    total_checked: suppliers.length,
    discrepancies_count: discrepancies.length,
    discrepancies
  };
}

/**
 * Sync Supplier Balances
 */
function syncSupplierBalances(tenantId, supplierIds = null) {
  const audit = auditSupplierBalances(tenantId);
  const toSync = supplierIds && Array.isArray(supplierIds)
    ? audit.discrepancies.filter(d => supplierIds.includes(d.id))
    : audit.discrepancies;

  if (toSync.length === 0) {
    return { success: true, updated_count: 0, details: [] };
  }

  const syncTx = db.transaction(() => {
    const updateStmt = db.prepare('UPDATE suppliers SET current_balance = ? WHERE id = ? AND tenant_id = ?');
    for (const d of toSync) {
      updateStmt.run(d.calculated_balance, d.id, tenantId);
    }
  });

  syncTx();

  return {
    success: true,
    updated_count: toSync.length,
    details: toSync
  };
}

module.exports = {
  calculateCustomerLedger,
  calculateSupplierLedger,
  auditCustomerBalances,
  syncCustomerBalances,
  auditSupplierBalances,
  syncSupplierBalances
};
