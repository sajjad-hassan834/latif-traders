const { db } = require('../config/database');

// Dashboard Overview Metrics
exports.getDashboardMetrics = (req, res) => {
  try {
    const tenantId = req.tenant_id || 'latif_001';
    const today = new Date().toISOString().split('T')[0];

    // Today's Sales
    const todaySales = db.prepare(`
      SELECT
        COUNT(*) as invoice_count,
        COALESCE(SUM(grand_total), 0) as total_sales,
        COALESCE(SUM(paid_amount), 0) as cash_received,
        COALESCE(SUM(balance_due), 0) as credit_sales
      FROM sales
      WHERE sale_date = ? AND tenant_id = ?
    `).get(today, tenantId);

    // Today's Purchases
    const todayPurchases = db.prepare(`
      SELECT
        COUNT(p.id) as bill_count,
        COALESCE(SUM(
          MAX(0, p.grand_total - COALESCE((
            SELECT SUM(total_amount) FROM returns WHERE original_invoice_id = p.id AND tenant_id = p.tenant_id
          ), 0))
        ), 0) as total_purchases,
        COALESCE(SUM(p.paid_amount), 0) as cash_paid
      FROM purchases p
      WHERE p.purchase_date = ? AND p.tenant_id = ?
    `).get(today, tenantId);

    // Today's Expenses
    const todayExpenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses
      WHERE expense_date = ? AND tenant_id = ?
    `).get(today, tenantId);

    // Outstanding Receivables from this tenant's customers
    const totalReceivables = db.prepare(`
      SELECT COALESCE(SUM(current_balance), 0) as balance FROM customers WHERE tenant_id = ?
    `).get(tenantId).balance;

    // Outstanding Payables to this tenant's suppliers
    const totalPayables = db.prepare(`
      SELECT COALESCE(SUM(current_balance), 0) as balance FROM suppliers WHERE tenant_id = ?
    `).get(tenantId).balance;

    // Total Inventory Valuation
    const inventoryValuation = db.prepare(`
      SELECT
        COALESCE(SUM(b.quantity * b.purchase_price), 0) as total_cost_value,
        COALESCE(SUM(b.quantity * p.sale_price), 0) as total_retail_value,
        COALESCE(SUM(b.quantity), 0) as total_items_stock
      FROM batches b
      JOIN products p ON b.product_id = p.id AND p.tenant_id = b.tenant_id
      WHERE b.status = 'active' AND b.tenant_id = ?
    `).get(tenantId);

    // Alert thresholds
    const nearExpirySetting = db.prepare("SELECT value FROM tenant_settings WHERE tenant_id = ? AND key = 'near_expiry_days'").get(tenantId);
    const alertDays = nearExpirySetting ? parseInt(nearExpirySetting.value, 10) : 15;
    const alertDate = new Date(Date.now() + alertDays * 86400000).toISOString().split('T')[0];

    // Low stock items
    const lowStockItems = db.prepare(`
      SELECT p.id, p.name, p.sku, p.min_stock_level, p.unit,
        COALESCE(SUM(b.quantity), 0) as current_stock
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id AND b.status = 'active' AND b.tenant_id = p.tenant_id
      WHERE p.status = 'active' AND p.tenant_id = ?
      GROUP BY p.id
      HAVING current_stock <= p.min_stock_level
      ORDER BY current_stock ASC
      LIMIT 10
    `).all(tenantId);

    // Near expiry batches
    const nearExpiryBatches = db.prepare(`
      SELECT b.id, b.batch_no, b.expiry_date, b.quantity, p.name as product_name, p.unit,
        ROUND((julianday(b.expiry_date) - julianday(?))) as days_remaining
      FROM batches b
      JOIN products p ON b.product_id = p.id AND p.tenant_id = b.tenant_id
      WHERE b.status = 'active' AND b.quantity > 0 AND b.expiry_date <= ? AND b.tenant_id = ?
      ORDER BY b.expiry_date ASC
      LIMIT 10
    `).all(today, alertDate, tenantId);

    // Top Selling Products (Last 30 Days)
    const topProducts = db.prepare(`
      SELECT p.name, p.unit,
        SUM(si.quantity) as total_qty,
        SUM(si.total_price) as total_revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id AND p.tenant_id = si.tenant_id
      JOIN sales s ON si.sale_id = s.id AND s.tenant_id = si.tenant_id
      WHERE s.sale_date >= date('now', '-30 days') AND si.tenant_id = ?
      GROUP BY p.id
      ORDER BY total_revenue DESC
      LIMIT 5
    `).all(tenantId);

    // Recent Sales
    const recentSales = db.prepare(`
      SELECT s.id, s.invoice_no, s.sale_date, s.grand_total, s.paid_amount, s.balance_due,
        s.payment_method, s.sale_type,
        COALESCE(c.name, 'Counter Walk-in') as customer_name,
        COALESCE((
          SELECT p.name FROM sale_items si JOIN products p ON si.product_id = p.id WHERE si.sale_id = s.id LIMIT 1
        ), 'Product Item') as product_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id AND c.tenant_id = s.tenant_id
      WHERE s.tenant_id = ?
      ORDER BY s.id DESC
      LIMIT 8
    `).all(tenantId);

    // Today's COGS
    const todayCOGS = db.prepare(`
      SELECT COALESCE(SUM(si.quantity * si.cost_price), 0) as cogs
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id AND s.tenant_id = si.tenant_id
      WHERE s.sale_date = ? AND si.tenant_id = ?
    `).get(today, tenantId).cogs;

    const estimatedGrossProfit = todaySales.total_sales - todayCOGS;
    const estimatedNetProfit = estimatedGrossProfit - todayExpenses.total_expenses;

    // 60-day sales & margin trend with robust date normalization
    const salesTrend = db.prepare(`
      SELECT
        SUBSTR(s.sale_date, 1, 10) as sale_date,
        COALESCE(SUM(s.grand_total), 0) as total_sales,
        COALESCE(SUM(s.grand_total - COALESCE(cogs.total_cogs, 0)), 0) as gross_margin
      FROM sales s
      LEFT JOIN (
        SELECT sale_id, SUM(quantity * cost_price) as total_cogs
        FROM sale_items
        WHERE (tenant_id = ? OR tenant_id IS NULL)
        GROUP BY sale_id
      ) cogs ON s.id = cogs.sale_id
      WHERE (s.tenant_id = ? OR s.tenant_id IS NULL)
        AND SUBSTR(s.sale_date, 1, 10) >= date('now', '-60 days')
      GROUP BY SUBSTR(s.sale_date, 1, 10)
      ORDER BY SUBSTR(s.sale_date, 1, 10) ASC
    `).all(tenantId, tenantId);

    // Top / Recent customer accounts with receivables or recent activity
    let topCustomers = [];
    try {
      topCustomers = db.prepare(`
        SELECT c.id, c.name, c.phone, c.customer_type, c.current_balance,
               MAX(s.created_at) as last_sale_at
        FROM customers c
        LEFT JOIN sales s ON s.customer_id = c.id AND COALESCE(s.tenant_id, 'latif_001') = ?
        WHERE COALESCE(c.tenant_id, 'latif_001') = ?
          AND NOT (c.name LIKE '%Walk-in%' OR c.name LIKE '%Counter%')
        GROUP BY c.id
        ORDER BY
          CASE WHEN c.current_balance > 0 THEN 1 ELSE 2 END,
          c.current_balance DESC,
          last_sale_at DESC,
          c.id DESC
        LIMIT 6
      `).all(tenantId, tenantId);

      // Fallback: if all non-walkin customers are filtered or none exist, fetch any customers for this tenant
      if (topCustomers.length === 0) {
        topCustomers = db.prepare(`
          SELECT id, name, phone, customer_type, current_balance
          FROM customers
          WHERE COALESCE(tenant_id, 'latif_001') = ?
          ORDER BY current_balance DESC, id DESC
          LIMIT 6
        `).all(tenantId);
      }
    } catch (custErr) {
      console.warn('top_customers query warning:', custErr.message);
      topCustomers = db.prepare(`
        SELECT id, name, phone, customer_type, current_balance
        FROM customers
        WHERE COALESCE(tenant_id, 'latif_001') = ?
        ORDER BY id DESC
        LIMIT 6
      `).all(tenantId);
    }

    return res.json({
      success: true,
      data: {
        today_sales: todaySales.total_sales,
        today_invoices: todaySales.invoice_count,
        today_cash_received: todaySales.cash_received,
        today_credit_sales: todaySales.credit_sales,
        today_purchases: todayPurchases.total_purchases,
        today_expenses: todayExpenses.total_expenses,
        estimated_gross_profit: estimatedGrossProfit,
        estimated_net_profit: estimatedNetProfit,
        total_receivables: totalReceivables,
        total_payables: totalPayables,
        inventory_valuation: inventoryValuation,
        low_stock_count: lowStockItems.length,
        near_expiry_count: nearExpiryBatches.length,
        low_stock_items: lowStockItems,
        near_expiry_batches: nearExpiryBatches,
        top_products: topProducts,
        recent_sales: recentSales,
        sales_trend: salesTrend,
        top_customers: topCustomers
      }
    });
  } catch (err) {
    console.error('Dashboard metrics error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch dashboard metrics.' });
  }
};

// Profit & Loss Report
exports.getProfitAndLoss = (req, res) => {
  try {
    const tenantId = req.tenant_id || 'latif_001';
    const { start_date, end_date } = req.query;
    const sDate = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const eDate = end_date || new Date().toISOString().split('T')[0];

    // 1. Total Sales Revenue
    const salesData = db.prepare(`
      SELECT
        COUNT(*) as invoice_count,
        COALESCE(SUM(subtotal), 0) as gross_sales,
        COALESCE(SUM(discount), 0) as total_discounts,
        COALESCE(SUM(grand_total), 0) as net_revenue
      FROM sales
      WHERE sale_date >= ? AND sale_date <= ? AND tenant_id = ?
    `).get(sDate, eDate, tenantId);

    // 2. Sales Returns
    const returnsData = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as return_total
      FROM returns
      WHERE type = 'SALE_RETURN' AND date(created_at) >= ? AND date(created_at) <= ? AND tenant_id = ?
    `).get(sDate, eDate, tenantId);

    // 3. Cost of Goods Sold (COGS)
    const cogsData = db.prepare(`
      SELECT COALESCE(SUM(si.quantity * si.cost_price), 0) as cogs
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id AND s.tenant_id = si.tenant_id
      WHERE s.sale_date >= ? AND s.sale_date <= ? AND si.tenant_id = ?
    `).get(sDate, eDate, tenantId);

    const adjustedRevenue = salesData.net_revenue - returnsData.return_total;
    const grossProfit = adjustedRevenue - cogsData.cogs;
    const grossMarginPct = adjustedRevenue > 0 ? (grossProfit / adjustedRevenue) * 100 : 0;

    // 4. Operating Expenses breakdown
    const expensesByCategory = db.prepare(`
      SELECT ec.name as category, COALESCE(SUM(e.amount), 0) as amount
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id AND ec.tenant_id = e.tenant_id
      WHERE e.expense_date >= ? AND e.expense_date <= ? AND e.tenant_id = ?
      GROUP BY ec.id
      ORDER BY amount DESC
    `).all(sDate, eDate, tenantId);

    const totalExpenses = expensesByCategory.reduce((sum, item) => sum + item.amount, 0);
    const netProfit = grossProfit - totalExpenses;
    const netMarginPct = adjustedRevenue > 0 ? (netProfit / adjustedRevenue) * 100 : 0;

    return res.json({
      success: true,
      date_range: { start_date: sDate, end_date: eDate },
      metrics: {
        invoice_count: salesData.invoice_count,
        gross_sales: salesData.gross_sales,
        discounts: salesData.total_discounts,
        sales_revenue: salesData.net_revenue,
        sales_returns: returnsData.return_total,
        net_sales: adjustedRevenue,
        cogs: cogsData.cogs,
        gross_profit: grossProfit,
        gross_margin_percent: grossMarginPct.toFixed(2),
        total_expenses: totalExpenses,
        net_profit: netProfit,
        net_margin_percent: netMarginPct.toFixed(2)
      },
      revenue: {
        invoice_count: salesData.invoice_count,
        gross_sales: salesData.gross_sales,
        discounts: salesData.total_discounts,
        net_sales: adjustedRevenue
      },
      cogs: {
        total_cogs: cogsData.cogs
      },
      expenses: {
        total_expenses: totalExpenses,
        category_breakdown: expensesByCategory.map(e => ({
          category_name: e.category,
          total_amount: e.amount
        }))
      },
      gross_profit: grossProfit,
      net_profit: netProfit,
      expense_breakdown: expensesByCategory
    });
  } catch (err) {
    console.error('P&L report error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate Profit & Loss statement.' });
  }
};

// Daily Sales Report
exports.getDailySalesReport = (req, res) => {
  try {
    const tenantId = req.tenant_id || 'latif_001';
    const { start_date, end_date } = req.query;
    const sDate = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const eDate = end_date || new Date().toISOString().split('T')[0];

    const dailySummary = db.prepare(`
      SELECT
        sale_date as date,
        sale_date,
        COUNT(*) as invoice_count,
        COALESCE(SUM(subtotal), 0) as subtotal,
        COALESCE(SUM(discount), 0) as discount,
        COALESCE(SUM(grand_total), 0) as total_sales,
        COALESCE(SUM(paid_amount), 0) as cash_collected,
        COALESCE(SUM(paid_amount), 0) as cash_received,
        COALESCE(SUM(balance_due), 0) as credit_issued,
        COALESCE(SUM(balance_due), 0) as credit_sales
      FROM sales
      WHERE sale_date >= ? AND sale_date <= ? AND tenant_id = ?
      GROUP BY sale_date
      ORDER BY sale_date DESC
    `).all(sDate, eDate, tenantId);

    return res.json({ success: true, daily_summary: dailySummary });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch daily sales report.' });
  }
};

// Current Stock & Valuation Report
exports.getStockReport = (req, res) => {
  try {
    const tenantId = req.tenant_id || 'latif_001';
    const stockReport = db.prepare(`
      SELECT p.id, p.name, p.sku, p.barcode, p.brand, p.unit, p.min_stock_level,
        c.name as category_name,
        p.purchase_price, p.sale_price,
        COALESCE(SUM(b.quantity), 0) as available_qty,
        COALESCE(SUM(b.quantity * p.purchase_price), 0) as total_cost_value,
        COALESCE(SUM(b.quantity * p.sale_price), 0) as total_retail_value,
        COALESCE(SUM(b.quantity * (p.sale_price - p.purchase_price)), 0) as potential_profit
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id AND c.tenant_id = p.tenant_id
      LEFT JOIN batches b ON p.id = b.product_id AND b.status = 'active' AND b.tenant_id = p.tenant_id
      WHERE p.tenant_id = ?
      GROUP BY p.id
      ORDER BY p.name ASC
    `).all(tenantId);

    const totals = {
      total_items: stockReport.length,
      total_quantity: stockReport.reduce((sum, item) => sum + item.available_qty, 0),
      total_cost_value: stockReport.reduce((sum, item) => sum + item.total_cost_value, 0),
      total_retail_value: stockReport.reduce((sum, item) => sum + item.total_retail_value, 0),
      total_potential_profit: stockReport.reduce((sum, item) => sum + item.potential_profit, 0)
    };

    return res.json({ success: true, stock: stockReport, totals });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch stock report.' });
  }
};

// Expiry Alert Report
exports.getExpiryReport = (req, res) => {
  try {
    const tenantId = req.tenant_id || 'latif_001';
    const today = new Date().toISOString().split('T')[0];
    const nearExpirySetting = db.prepare("SELECT value FROM tenant_settings WHERE tenant_id = ? AND key = 'near_expiry_days'").get(tenantId);
    const alertDays = nearExpirySetting ? parseInt(nearExpirySetting.value, 10) : 15;
    const alertDate = new Date(Date.now() + alertDays * 86400000).toISOString().split('T')[0];

    const batches = db.prepare(`
      SELECT b.*, p.name as product_name, p.sku, p.unit,
        ROUND(julianday(b.expiry_date) - julianday(?)) as days_remaining,
        CASE
          WHEN b.expiry_date < ? THEN 'EXPIRED'
          WHEN b.expiry_date <= ? THEN 'NEAR_EXPIRY'
          ELSE 'GOOD'
        END as status_indicator
      FROM batches b
      JOIN products p ON b.product_id = p.id AND p.tenant_id = b.tenant_id
      WHERE b.status = 'active' AND b.quantity > 0 AND b.tenant_id = ?
      ORDER BY b.expiry_date ASC
    `).all(today, today, alertDate, tenantId);

    return res.json({ success: true, alert_days: alertDays, batches });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch expiry report.' });
  }
};

// End-of-Day / Shift Register Z-Report
exports.getDayRegister = (req, res) => {
  try {
    const tenantId = req.tenant_id || 'latif_001';
    const date = req.query.date || new Date().toISOString().split('T')[0];

    // Sales metrics
    const salesData = db.prepare(`
      SELECT
        COUNT(*) as total_bills,
        COALESCE(SUM(grand_total), 0) as total_sales,
        COALESCE(SUM(discount), 0) as total_discount,
        COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN paid_amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'Bank Transfer' THEN paid_amount ELSE 0 END), 0) as bank_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'Card' THEN paid_amount ELSE 0 END), 0) as card_sales,
        COALESCE(SUM(balance_due), 0) as credit_sales
      FROM sales
      WHERE sale_date = ? AND tenant_id = ?
    `).get(date, tenantId);

    // Items sold count
    const itemsSold = db.prepare(`
      SELECT COALESCE(SUM(si.quantity), 0) as total_qty
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id AND s.tenant_id = si.tenant_id
      WHERE s.sale_date = ? AND si.tenant_id = ?
    `).get(date, tenantId).total_qty;

    // Direct Customer Payments collected on account
    const customerReceipts = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN amount ELSE 0 END), 0) as cash_recovered,
        COALESCE(SUM(CASE WHEN payment_method != 'Cash' THEN amount ELSE 0 END), 0) as bank_recovered
      FROM payments
      WHERE payment_date = ? AND UPPER(party_type) = 'CUSTOMER' AND reference_id IS NULL AND tenant_id = ?
    `).get(date, tenantId);

    // Cash Expenses paid today
    const expenseData = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN amount ELSE 0 END), 0) as cash_expenses,
        COALESCE(SUM(CASE WHEN payment_method != 'Cash' THEN amount ELSE 0 END), 0) as bank_expenses,
        COUNT(*) as expense_count
      FROM expenses
      WHERE expense_date = ? AND tenant_id = ?
    `).get(date, tenantId);

    // Detailed expenses list
    const expenseList = db.prepare(`
      SELECT e.id, e.title, e.amount, e.payment_method, ec.name as category_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id AND ec.tenant_id = e.tenant_id
      WHERE e.expense_date = ? AND e.tenant_id = ?
      ORDER BY e.id ASC
    `).all(date, tenantId);

    // Supplier Disbursements
    const supplierDisbursements = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN amount ELSE 0 END), 0) as cash_disbursed,
        COALESCE(SUM(CASE WHEN payment_method != 'Cash' THEN amount ELSE 0 END), 0) as bank_disbursed
      FROM payments
      WHERE payment_date = ? AND UPPER(party_type) = 'SUPPLIER' AND reference_id IS NULL AND tenant_id = ?
    `).get(date, tenantId);

    // Net Cash in Drawer
    const totalCashIn = Number(salesData.cash_sales) + Number(customerReceipts.cash_recovered);
    const totalCashOut = Number(expenseData.cash_expenses) + Number(supplierDisbursements.cash_disbursed);
    const netDrawerCash = totalCashIn - totalCashOut;

    // Shop settings
    const settingsRows = db.prepare('SELECT key, value FROM tenant_settings WHERE tenant_id = ?').all(tenantId);
    const settings = settingsRows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    return res.json({
      success: true,
      date,
      sales: {
        ...salesData,
        items_sold: itemsSold
      },
      customer_receipts: customerReceipts,
      expenses: {
        ...expenseData,
        list: expenseList
      },
      supplier_disbursements: supplierDisbursements,
      cash_summary: {
        total_cash_in: totalCashIn,
        total_cash_out: totalCashOut,
        net_drawer_cash: netDrawerCash
      },
      settings
    });
  } catch (err) {
    console.error('getDayRegister error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate register report: ' + err.message });
  }
};

// Purchases Report
exports.getPurchasesReport = (req, res) => {
  try {
    const tenantId = req.tenant_id || 'latif_001';
    const { start_date, end_date, supplier_id } = req.query;
    const sDate = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const eDate = end_date || new Date().toISOString().split('T')[0];

    let query = `
      SELECT p.*, s.name as supplier_name,
        (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id AND pi.tenant_id = p.tenant_id) as item_count
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id AND s.tenant_id = p.tenant_id
      WHERE p.purchase_date >= ? AND p.purchase_date <= ? AND p.tenant_id = ?
    `;
    const params = [sDate, eDate, tenantId];

    if (supplier_id) {
      query += ' AND p.supplier_id = ?';
      params.push(supplier_id);
    }

    query += ' ORDER BY p.purchase_date DESC, p.id DESC';

    const purchases = db.prepare(query).all(...params);

    const totalQty = db.prepare(`
      SELECT COALESCE(SUM(pi.quantity), 0) as total_qty
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id AND p.tenant_id = pi.tenant_id
      WHERE p.purchase_date >= ? AND p.purchase_date <= ? AND p.tenant_id = ?
      ${supplier_id ? 'AND p.supplier_id = ?' : ''}
    `).get(...params).total_qty;

    const summary = {
      total_purchases: purchases.reduce((sum, p) => sum + p.grand_total, 0),
      total_paid: purchases.reduce((sum, p) => sum + p.paid_amount, 0),
      total_balance_due: purchases.reduce((sum, p) => sum + p.balance_due, 0),
      total_quantity: totalQty,
      invoice_count: purchases.length
    };

    return res.json({ success: true, purchases, summary });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to generate purchase report.' });
  }
};

// Supplier-wise Purchase Report
exports.getSupplierWisePurchaseReport = (req, res) => {
  try {
    const tenantId = req.tenant_id || 'latif_001';
    const { start_date, end_date } = req.query;
    const sDate = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const eDate = end_date || new Date().toISOString().split('T')[0];

    const suppliers = db.prepare(`
      SELECT s.id, s.name as supplier_name, s.phone, s.contact_person, s.current_balance as outstanding_balance,
        COUNT(DISTINCT p.id) as invoice_count,
        COALESCE(SUM(p.grand_total), 0) as total_purchase_amount,
        COALESCE(SUM(p.paid_amount), 0) as total_paid,
        COALESCE(SUM(p.balance_due), 0) as total_credit_due,
        COALESCE(SUM(pi.quantity), 0) as total_quantity
      FROM suppliers s
      JOIN purchases p ON s.id = p.supplier_id AND p.purchase_date >= ? AND p.purchase_date <= ? AND p.tenant_id = ?
      LEFT JOIN purchase_items pi ON p.id = pi.purchase_id AND pi.tenant_id = p.tenant_id
      WHERE s.tenant_id = ?
      GROUP BY s.id
      ORDER BY total_purchase_amount DESC
    `).all(sDate, eDate, tenantId, tenantId);

    for (const sup of suppliers) {
      sup.products = db.prepare(`
        SELECT pr.name as product_name, COALESCE(pi.brand, pr.brand, '-') as brand,
          pi.unit,
          SUM(pi.quantity) as quantity,
          AVG(pi.unit_price) as avg_rate,
          SUM(pi.total_price) as total_amount
        FROM purchase_items pi
        JOIN purchases p ON pi.purchase_id = p.id AND p.tenant_id = pi.tenant_id
        JOIN products pr ON pi.product_id = pr.id AND pr.tenant_id = pi.tenant_id
        WHERE p.supplier_id = ? AND p.purchase_date >= ? AND p.purchase_date <= ? AND p.tenant_id = ?
        GROUP BY pr.id, pi.unit
        ORDER BY total_amount DESC
      `).all(sup.id, sDate, eDate, tenantId);
    }

    const summary = {
      total_purchases: suppliers.reduce((sum, s) => sum + s.total_purchase_amount, 0),
      total_paid: suppliers.reduce((sum, s) => sum + s.total_paid, 0),
      total_balance_due: suppliers.reduce((sum, s) => sum + s.total_credit_due, 0),
      total_quantity: suppliers.reduce((sum, s) => sum + s.total_quantity, 0),
      supplier_count: suppliers.length
    };

    return res.json({ success: true, report: suppliers, summary });
  } catch (err) {
    console.error('getSupplierWisePurchaseReport error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate supplier-wise purchase report.' });
  }
};

// Product-wise Purchase Report
exports.getProductWisePurchaseReport = (req, res) => {
  try {
    const tenantId = req.tenant_id || 'latif_001';
    const { start_date, end_date } = req.query;
    const sDate = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const eDate = end_date || new Date().toISOString().split('T')[0];

    const products = db.prepare(`
      SELECT pr.id as product_id, pr.name as product_name, pr.sku, COALESCE(pi.brand, pr.brand, '-') as brand, pi.unit,
        SUM(pi.quantity) as total_quantity,
        AVG(pi.unit_price) as avg_purchase_rate,
        MIN(pi.unit_price) as min_purchase_rate,
        MAX(pi.unit_price) as max_purchase_rate,
        SUM(pi.total_price) as total_purchase_amount,
        COUNT(DISTINCT p.supplier_id) as supplier_count
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id AND p.tenant_id = pi.tenant_id
      JOIN products pr ON pi.product_id = pr.id AND pr.tenant_id = pi.tenant_id
      WHERE p.purchase_date >= ? AND p.purchase_date <= ? AND p.tenant_id = ?
      GROUP BY pr.id, pi.unit
      ORDER BY total_purchase_amount DESC
    `).all(sDate, eDate, tenantId);

    for (const prod of products) {
      prod.suppliers = db.prepare(`
        SELECT s.name as supplier_name,
          pi.quantity,
          pi.unit,
          pi.unit_price as rate,
          pi.total_price as total_amount,
          p.invoice_no,
          p.purchase_date
        FROM purchase_items pi
        JOIN purchases p ON pi.purchase_id = p.id AND p.tenant_id = pi.tenant_id
        JOIN suppliers s ON p.supplier_id = s.id AND s.tenant_id = p.tenant_id
        WHERE pi.product_id = ? AND p.purchase_date >= ? AND p.purchase_date <= ? AND p.tenant_id = ?
        ORDER BY p.purchase_date DESC
      `).all(prod.product_id, sDate, eDate, tenantId);
    }

    const summary = {
      total_purchases: products.reduce((sum, p) => sum + p.total_purchase_amount, 0),
      total_quantity: products.reduce((sum, p) => sum + p.total_quantity, 0),
      product_count: products.length
    };

    return res.json({ success: true, report: products, summary });
  } catch (err) {
    console.error('getProductWisePurchaseReport error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate product-wise purchase report.' });
  }
};

// Product-wise Sales Report
exports.getProductSalesReport = (req, res) => {
  try {
    const tenantId = req.tenant_id || 'latif_001';
    const { start_date, end_date } = req.query;
    const sDate = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const eDate = end_date || new Date().toISOString().split('T')[0];

    const report = db.prepare(`
      SELECT
        p.id, p.name, p.sku, p.unit, c.name as category_name,
        COALESCE(SUM(si.quantity), 0) as total_qty_sold,
        COALESCE(SUM(si.total_price), 0) as total_revenue,
        COALESCE(AVG(si.unit_price), 0) as avg_sale_rate,
        COALESCE(SUM(si.quantity * si.cost_price), 0) as total_cost,
        COALESCE(SUM(si.total_price - (si.quantity * si.cost_price)), 0) as total_profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id AND s.sale_date >= ? AND s.sale_date <= ? AND COALESCE(s.tenant_id, 'latif_001') = ?
      JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE COALESCE(p.tenant_id, 'latif_001') = ?
      GROUP BY p.id
      HAVING total_qty_sold > 0
      ORDER BY total_revenue DESC
    `).all(sDate, eDate, tenantId, tenantId);

    const summary = {
      total_revenue: report.reduce((sum, r) => sum + Number(r.total_revenue || 0), 0),
      total_profit: report.reduce((sum, r) => sum + Number(r.total_profit || 0), 0),
      total_units: report.reduce((sum, r) => sum + Number(r.total_qty_sold || 0), 0),
      product_count: report.length
    };

    return res.json({ success: true, report, summary });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to generate product sales report.' });
  }
};

// Full Stock Movement Audit Ledger
exports.getStockMovementsReport = (req, res) => {
  try {
    const tenantId = req.tenant_id || 'latif_001';
    const { start_date, end_date, product_id, type } = req.query;
    const sDate = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const eDate = end_date || new Date().toISOString().split('T')[0];

    let query = `
      SELECT im.*, p.name as product_name, p.sku, p.unit, b.batch_no, u.full_name as user_name
      FROM inventory_movements im
      JOIN products p ON im.product_id = p.id AND p.tenant_id = im.tenant_id
      LEFT JOIN batches b ON im.batch_id = b.id AND b.tenant_id = im.tenant_id
      LEFT JOIN users u ON im.user_id = u.id AND u.tenant_id = im.tenant_id
      WHERE date(im.created_at) >= ? AND date(im.created_at) <= ? AND im.tenant_id = ?
    `;
    const params = [sDate, eDate, tenantId];

    if (product_id) {
      query += ' AND im.product_id = ?';
      params.push(product_id);
    }
    if (type) {
      query += ' AND im.type = ?';
      params.push(type);
    }

    query += ' ORDER BY im.created_at DESC, im.id DESC LIMIT 200';

    const movements = db.prepare(query).all(...params);

    return res.json({ success: true, movements });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch stock movements.' });
  }
};
