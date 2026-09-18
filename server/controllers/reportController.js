const { db } = require('../config/database');

// Dashboard Overview Metrics
exports.getDashboardMetrics = (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Today's Sales
    const todaySales = db.prepare(`
      SELECT
        COUNT(*) as invoice_count,
        COALESCE(SUM(grand_total), 0) as total_sales,
        COALESCE(SUM(paid_amount), 0) as cash_received,
        COALESCE(SUM(balance_due), 0) as credit_sales
      FROM sales
      WHERE sale_date = ?
    `).get(today);

    // Today's Purchases
    const todayPurchases = db.prepare(`
      SELECT
        COUNT(*) as bill_count,
        COALESCE(SUM(grand_total), 0) as total_purchases,
        COALESCE(SUM(paid_amount), 0) as cash_paid
      FROM purchases
      WHERE purchase_date = ?
    `).get(today);

    // Today's Expenses
    const todayExpenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses
      WHERE expense_date = ?
    `).get(today);

    // Outstanding Receivables from all customers
    const totalReceivables = db.prepare(`
      SELECT COALESCE(SUM(current_balance), 0) as balance FROM customers
    `).get().balance;

    // Outstanding Payables to all suppliers
    const totalPayables = db.prepare(`
      SELECT COALESCE(SUM(current_balance), 0) as balance FROM suppliers
    `).get().balance;

    // Total Inventory Valuation
    const inventoryValuation = db.prepare(`
      SELECT
        COALESCE(SUM(b.quantity * b.purchase_price), 0) as total_cost_value,
        COALESCE(SUM(b.quantity * p.sale_price), 0) as total_retail_value,
        COALESCE(SUM(b.quantity), 0) as total_items_stock
      FROM batches b
      JOIN products p ON b.product_id = p.id
      WHERE b.status = 'active'
    `).get();

    // Alert thresholds
    const nearExpirySetting = db.prepare("SELECT value FROM settings WHERE key = 'near_expiry_days'").get();
    const alertDays = nearExpirySetting ? parseInt(nearExpirySetting.value, 10) : 15;
    const alertDate = new Date(Date.now() + alertDays * 86400000).toISOString().split('T')[0];

    // Low stock items
    const lowStockItems = db.prepare(`
      SELECT p.id, p.name, p.sku, p.min_stock_level, p.unit,
        COALESCE(SUM(b.quantity), 0) as current_stock
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id AND b.status = 'active'
      WHERE p.status = 'active'
      GROUP BY p.id
      HAVING current_stock <= p.min_stock_level
      ORDER BY current_stock ASC
      LIMIT 10
    `).all();

    // Near expiry batches
    const nearExpiryBatches = db.prepare(`
      SELECT b.id, b.batch_no, b.expiry_date, b.quantity, p.name as product_name, p.unit,
        ROUND((julianday(b.expiry_date) - julianday(?))) as days_remaining
      FROM batches b
      JOIN products p ON b.product_id = p.id
      WHERE b.status = 'active' AND b.quantity > 0 AND b.expiry_date <= ?
      ORDER BY b.expiry_date ASC
      LIMIT 10
    `).all(today, alertDate);

    // Top Selling Products (Last 30 Days)
    const topProducts = db.prepare(`
      SELECT p.name, p.unit,
        SUM(si.quantity) as total_qty,
        SUM(si.total_price) as total_revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.sale_date >= date('now', '-30 days')
      GROUP BY p.id
      ORDER BY total_revenue DESC
      LIMIT 5
    `).all();

    // Recent Sales
    const recentSales = db.prepare(`
      SELECT s.id, s.invoice_no, s.sale_date, s.grand_total, s.paid_amount, s.balance_due,
        COALESCE(c.name, 'Counter Retail') as customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.id DESC
      LIMIT 6
    `).all();

    // Estimated Today Net Profit:
    // Today's COGS for sold items
    const todayCOGS = db.prepare(`
      SELECT COALESCE(SUM(si.quantity * si.cost_price), 0) as cogs
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.sale_date = ?
    `).get(today).cogs;

    const estimatedGrossProfit = todaySales.total_sales - todayCOGS;
    const estimatedNetProfit = estimatedGrossProfit - todayExpenses.total_expenses;

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
        recent_sales: recentSales
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
      WHERE sale_date >= ? AND sale_date <= ?
    `).get(sDate, eDate);

    // 2. Sales Returns
    const returnsData = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as return_total
      FROM returns
      WHERE type = 'SALE_RETURN' AND date(created_at) >= ? AND date(created_at) <= ?
    `).get(sDate, eDate);

    // 3. Cost of Goods Sold (COGS)
    const cogsData = db.prepare(`
      SELECT COALESCE(SUM(si.quantity * si.cost_price), 0) as cogs
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.sale_date >= ? AND s.sale_date <= ?
    `).get(sDate, eDate);

    const adjustedRevenue = salesData.net_revenue - returnsData.return_total;
    const grossProfit = adjustedRevenue - cogsData.cogs;
    const grossMarginPct = adjustedRevenue > 0 ? (grossProfit / adjustedRevenue) * 100 : 0;

    // 4. Operating Expenses breakdown
    const expensesByCategory = db.prepare(`
      SELECT ec.name as category, COALESCE(SUM(e.amount), 0) as amount
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.expense_date >= ? AND e.expense_date <= ?
      GROUP BY ec.id
      ORDER BY amount DESC
    `).all(sDate, eDate);

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
      WHERE sale_date >= ? AND sale_date <= ?
      GROUP BY sale_date
      ORDER BY sale_date DESC
    `).all(sDate, eDate);

    return res.json({ success: true, daily_summary: dailySummary });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch daily sales report.' });
  }
};

// Current Stock & Valuation Report
exports.getStockReport = (req, res) => {
  try {
    const stockReport = db.prepare(`
      SELECT p.id, p.name, p.sku, p.barcode, p.brand, p.unit, p.min_stock_level,
        c.name as category_name,
        p.purchase_price, p.sale_price,
        COALESCE(SUM(b.quantity), 0) as available_qty,
        COALESCE(SUM(b.quantity * p.purchase_price), 0) as total_cost_value,
        COALESCE(SUM(b.quantity * p.sale_price), 0) as total_retail_value,
        COALESCE(SUM(b.quantity * (p.sale_price - p.purchase_price)), 0) as potential_profit
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN batches b ON p.id = b.product_id AND b.status = 'active'
      GROUP BY p.id
      ORDER BY p.name ASC
    `).all();

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
    const today = new Date().toISOString().split('T')[0];
    const nearExpirySetting = db.prepare("SELECT value FROM settings WHERE key = 'near_expiry_days'").get();
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
      JOIN products p ON b.product_id = p.id
      WHERE b.status = 'active' AND b.quantity > 0
      ORDER BY b.expiry_date ASC
    `).all(today, today, alertDate);

    return res.json({ success: true, alert_days: alertDays, batches });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch expiry report.' });
  }
};

// End-of-Day / Shift Register Z-Report
exports.getDayRegister = (req, res) => {
  try {
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
      WHERE sale_date = ?
    `).get(date);

    // Items sold count
    const itemsSold = db.prepare(`
      SELECT COALESCE(SUM(si.quantity), 0) as total_qty
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.sale_date = ?
    `).get(date).total_qty;

    // Direct Customer Payments collected on account (ledger recoveries)
    const customerReceipts = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN amount ELSE 0 END), 0) as cash_recovered,
        COALESCE(SUM(CASE WHEN payment_method != 'Cash' THEN amount ELSE 0 END), 0) as bank_recovered
      FROM payments
      WHERE payment_date = ? AND party_type = 'Customer' AND (reference_type IS NULL OR reference_type != 'SALE')
    `).get(date);

    // Cash Expenses paid today
    const expenseData = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN amount ELSE 0 END), 0) as cash_expenses,
        COALESCE(SUM(CASE WHEN payment_method != 'Cash' THEN amount ELSE 0 END), 0) as bank_expenses,
        COUNT(*) as expense_count
      FROM expenses
      WHERE expense_date = ?
    `).get(date);

    // Detailed expenses list
    const expenseList = db.prepare(`
      SELECT e.id, e.title, e.amount, e.payment_method, ec.name as category_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.expense_date = ?
      ORDER BY e.id ASC
    `).all(date);

    // Supplier Disbursements paid in cash today
    const supplierDisbursements = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN amount ELSE 0 END), 0) as cash_disbursed,
        COALESCE(SUM(CASE WHEN payment_method != 'Cash' THEN amount ELSE 0 END), 0) as bank_disbursed
      FROM payments
      WHERE payment_date = ? AND party_type = 'Supplier' AND (reference_type IS NULL OR reference_type != 'PURCHASE')
    `).get(date);

    // Net Cash in Drawer
    const totalCashIn = Number(salesData.cash_sales) + Number(customerReceipts.cash_recovered);
    const totalCashOut = Number(expenseData.cash_expenses) + Number(supplierDisbursements.cash_disbursed);
    const netDrawerCash = totalCashIn - totalCashOut;

    // Shop settings
    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
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
    return res.status(500).json({ success: false, message: 'Failed to generate register report.' });
  }
};
