const { db } = require('../config/database');

// Dashboard Overview Metrics
exports.getDashboardMetrics = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const today = new Date().toISOString().split('T')[0];

    // Today's Sales
    const todaySales = await db.get(`
      SELECT
        COUNT(*) as invoice_count,
        COALESCE(SUM(grand_total), 0) as total_sales,
        COALESCE(SUM(paid_amount), 0) as cash_received,
        COALESCE(SUM(balance_due), 0) as credit_sales
      FROM sales
      WHERE sale_date = ? AND tenant_id = ?
    `, [today, tenantId]) || { invoice_count: 0, total_sales: 0, cash_received: 0, credit_sales: 0 };

    // Today's Purchases
    const todayPurchases = await db.get(`
      SELECT
        COUNT(p.id) as bill_count,
        COALESCE(SUM(
          GREATEST(0, p.grand_total - COALESCE((
            SELECT SUM(total_amount) FROM returns WHERE original_invoice_id = p.id AND tenant_id = p.tenant_id
          ), 0))
        ), 0) as total_purchases,
        COALESCE(SUM(p.paid_amount), 0) as cash_paid
      FROM purchases p
      WHERE p.purchase_date = ? AND p.tenant_id = ?
    `, [today, tenantId]) || { bill_count: 0, total_purchases: 0, cash_paid: 0 };

    // Today's Expenses
    const todayExpenses = await db.get(`
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses
      WHERE expense_date = ? AND tenant_id = ?
    `, [today, tenantId]) || { total_expenses: 0 };

    // Outstanding Receivables
    const recRow = await db.get(`
      SELECT COALESCE(SUM(current_balance), 0) as balance 
      FROM customers 
      WHERE tenant_id = ? AND LOWER(name) NOT LIKE '%walk-in%' AND LOWER(name) NOT LIKE '%counter%'
    `, [tenantId]);
    const totalReceivables = Number(recRow?.balance || 0);

    // Outstanding Payables
    const payRow = await db.get(`
      SELECT COALESCE(SUM(current_balance), 0) as balance FROM suppliers WHERE tenant_id = ?
    `, [tenantId]);
    const totalPayables = Number(payRow?.balance || 0);

    // Total Inventory Valuation
    const inventoryValuation = await db.get(`
      SELECT
        COALESCE(SUM(b.quantity * b.purchase_price), 0) as total_cost_value,
        COALESCE(SUM(b.quantity * p.sale_price), 0) as total_retail_value,
        COALESCE(SUM(b.quantity), 0) as total_items_stock
      FROM batches b
      JOIN products p ON b.product_id = p.id AND p.tenant_id = b.tenant_id
      WHERE b.status = 'active' AND b.tenant_id = ?
    `, [tenantId]) || { total_cost_value: 0, total_retail_value: 0, total_items_stock: 0 };

    // Alert thresholds
    const nearExpirySetting = await db.get("SELECT value FROM tenant_settings WHERE tenant_id = ? AND key = 'near_expiry_days'", [tenantId]);
    const alertDays = nearExpirySetting ? parseInt(nearExpirySetting.value, 10) : 15;
    const alertDate = new Date(Date.now() + alertDays * 86400000).toISOString().split('T')[0];

    // Low stock items
    const lowStockItems = await db.all(`
      SELECT p.id, p.name, p.sku, p.min_stock_level, p.unit,
        COALESCE(SUM(b.quantity), 0) as current_stock
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id AND b.status = 'active' AND b.tenant_id = p.tenant_id
      WHERE p.status = 'active' AND p.tenant_id = ?
      GROUP BY p.id, p.name, p.sku, p.min_stock_level, p.unit
      HAVING COALESCE(SUM(b.quantity), 0) <= p.min_stock_level
      ORDER BY current_stock ASC
      LIMIT 10
    `, [tenantId]);

    // Near expiry batches
    const nearExpiryBatches = await db.all(`
      SELECT b.id, b.batch_no, b.expiry_date, b.quantity, p.name as product_name, p.unit,
        ROUND((julianday(b.expiry_date) - julianday(?))) as days_remaining
      FROM batches b
      JOIN products p ON b.product_id = p.id AND p.tenant_id = b.tenant_id
      WHERE b.status = 'active' AND b.quantity > 0 AND b.expiry_date <= ? AND b.tenant_id = ?
      ORDER BY b.expiry_date ASC
      LIMIT 10
    `, [today, alertDate, tenantId]);

    // Top Selling Products (Last 30 Days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const topProducts = await db.all(`
      SELECT p.name, p.unit,
        SUM(si.quantity) as total_qty,
        SUM(si.total_price) as total_revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id AND p.tenant_id = si.tenant_id
      JOIN sales s ON si.sale_id = s.id AND s.tenant_id = si.tenant_id
      WHERE s.sale_date >= ? AND si.tenant_id = ?
      GROUP BY p.id, p.name, p.unit
      ORDER BY total_revenue DESC
      LIMIT 5
    `, [thirtyDaysAgo, tenantId]);

    // Recent Sales
    const recentSales = await db.all(`
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
    `, [tenantId]);

    // Today's COGS
    const cogsRow = await db.get(`
      SELECT COALESCE(SUM(si.quantity * si.cost_price), 0) as cogs
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id AND s.tenant_id = si.tenant_id
      WHERE s.sale_date = ? AND si.tenant_id = ?
    `, [today, tenantId]);
    const todayCOGS = Number(cogsRow?.cogs || 0);

    const estimatedGrossProfit = Number(todaySales.total_sales) - todayCOGS;
    const estimatedNetProfit = estimatedGrossProfit - Number(todayExpenses.total_expenses);

    // 60-day sales & margin trend
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];
    const salesTrend = await db.all(`
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
        AND SUBSTR(s.sale_date, 1, 10) >= ?
      GROUP BY SUBSTR(s.sale_date, 1, 10)
      ORDER BY SUBSTR(s.sale_date, 1, 10) ASC
    `, [tenantId, tenantId, sixtyDaysAgo]);

    // Top / Recent customer accounts
    let topCustomers = [];
    try {
      topCustomers = await db.all(`
        SELECT c.id, c.name, c.phone, c.customer_type, c.current_balance,
               MAX(s.created_at) as last_sale_at
        FROM customers c

        LEFT JOIN sales s ON s.customer_id = c.id AND s.tenant_id = ?
        WHERE c.tenant_id = ?
          AND NOT (c.name ILIKE '%Walk-in%' OR c.name ILIKE '%Counter%')
        GROUP BY c.id, c.name, c.phone, c.customer_type, c.current_balance
        ORDER BY
          CASE WHEN c.current_balance > 0 THEN 1 ELSE 2 END,
          c.current_balance DESC,
          last_sale_at DESC,
          c.id DESC
        LIMIT 6
      `, [tenantId, tenantId]);

      if (topCustomers.length === 0) {
        topCustomers = await db.all(`
          SELECT id, name, phone, customer_type, current_balance
          FROM customers
          WHERE tenant_id = ?
          ORDER BY current_balance DESC, id DESC
          LIMIT 6
        `, [tenantId]);
      }
    } catch (_) {
      topCustomers = await db.all(`
        SELECT id, name, phone, customer_type, current_balance
        FROM customers
        WHERE tenant_id = ?
        ORDER BY id DESC
        LIMIT 6
      `, [tenantId]);
    }

    return res.json({
      success: true,
      data: {
        today_sales: Number(todaySales.total_sales),
        today_invoices: Number(todaySales.invoice_count),
        today_cash_received: Number(todaySales.cash_received),
        today_credit_sales: Number(todaySales.credit_sales),
        today_purchases: Number(todayPurchases.total_purchases),
        today_expenses: Number(todayExpenses.total_expenses),
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
exports.getProfitAndLoss = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { start_date, end_date } = req.query;
    const sDate = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const eDate = end_date || new Date().toISOString().split('T')[0];

    // 1. Total Sales Revenue
    const salesData = await db.get(`
      SELECT
        COUNT(*) as invoice_count,
        COALESCE(SUM(subtotal), 0) as gross_sales,
        COALESCE(SUM(discount), 0) as total_discounts,
        COALESCE(SUM(grand_total), 0) as net_revenue
      FROM sales
      WHERE sale_date >= ? AND sale_date <= ? AND tenant_id = ?
    `, [sDate, eDate, tenantId]) || { invoice_count: 0, gross_sales: 0, total_discounts: 0, net_revenue: 0 };

    // 2. Sales Returns
    const returnsData = await db.get(`
      SELECT COALESCE(SUM(total_amount), 0) as return_total
      FROM returns
      WHERE type = 'SALE_RETURN' AND date(created_at) >= ? AND date(created_at) <= ? AND tenant_id = ?
    `, [sDate, eDate, tenantId]) || { return_total: 0 };

    // 3. Cost of Goods Sold (COGS)
    const cogsData = await db.get(`
      SELECT COALESCE(SUM(si.quantity * si.cost_price), 0) as cogs
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id AND s.tenant_id = si.tenant_id
      WHERE s.sale_date >= ? AND s.sale_date <= ? AND si.tenant_id = ?
    `, [sDate, eDate, tenantId]) || { cogs: 0 };

    const adjustedRevenue = Number(salesData.net_revenue) - Number(returnsData.return_total);
    const grossProfit = adjustedRevenue - Number(cogsData.cogs);
    const grossMarginPct = adjustedRevenue > 0 ? (grossProfit / adjustedRevenue) * 100 : 0;

    // 4. Operating Expenses breakdown
    const expensesByCategory = await db.all(`
      SELECT ec.name as category, COALESCE(SUM(e.amount), 0) as amount
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id AND ec.tenant_id = e.tenant_id
      WHERE e.expense_date >= ? AND e.expense_date <= ? AND e.tenant_id = ?
      GROUP BY ec.id, ec.name
      ORDER BY amount DESC
    `, [sDate, eDate, tenantId]);

    const totalExpenses = expensesByCategory.reduce((sum, item) => sum + Number(item.amount), 0);
    const netProfit = grossProfit - totalExpenses;
    const netMarginPct = adjustedRevenue > 0 ? (netProfit / adjustedRevenue) * 100 : 0;

    return res.json({
      success: true,
      date_range: { start_date: sDate, end_date: eDate },
      metrics: {
        invoice_count: Number(salesData.invoice_count),
        gross_sales: Number(salesData.gross_sales),
        discounts: Number(salesData.total_discounts),
        sales_revenue: Number(salesData.net_revenue),
        sales_returns: Number(returnsData.return_total),
        net_sales: adjustedRevenue,
        cogs: Number(cogsData.cogs),
        gross_profit: grossProfit,
        gross_margin_percent: grossMarginPct.toFixed(2),
        total_expenses: totalExpenses,
        net_profit: netProfit,
        net_margin_percent: netMarginPct.toFixed(2)
      },
      revenue: {
        invoice_count: Number(salesData.invoice_count),
        gross_sales: Number(salesData.gross_sales),
        discounts: Number(salesData.total_discounts),
        net_sales: adjustedRevenue
      },
      cogs: {
        total_cogs: Number(cogsData.cogs)
      },
      expenses: {
        total_expenses: totalExpenses,
        category_breakdown: expensesByCategory.map(e => ({
          category_name: e.category,
          total_amount: Number(e.amount)
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
exports.getDailySalesReport = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { start_date, end_date } = req.query;
    const sDate = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const eDate = end_date || new Date().toISOString().split('T')[0];

    const dailySummary = await db.all(`
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
    `, [sDate, eDate, tenantId]);

    return res.json({ success: true, daily_summary: dailySummary });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch daily sales report.' });
  }
};

// Current Stock & Valuation Report
exports.getStockReport = async (req, res) => {
  try {

    const tenantId = req.tenantId || req.tenant_id;
    const stockReport = await db.all(`
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
      GROUP BY p.id, c.name
      ORDER BY p.name ASC
    `, [tenantId]);

    const totals = {
      total_items: stockReport.length,
      total_quantity: stockReport.reduce((sum, item) => sum + Number(item.available_qty), 0),
      total_cost_value: stockReport.reduce((sum, item) => sum + Number(item.total_cost_value), 0),
      total_retail_value: stockReport.reduce((sum, item) => sum + Number(item.total_retail_value), 0),
      total_potential_profit: stockReport.reduce((sum, item) => sum + Number(item.potential_profit), 0)
    };

    return res.json({ success: true, stock: stockReport, totals });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch stock report.' });
  }
};

// Expiry Alert Report
exports.getExpiryReport = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const today = new Date().toISOString().split('T')[0];
    const nearExpirySetting = await db.get("SELECT value FROM tenant_settings WHERE tenant_id = ? AND key = 'near_expiry_days'", [tenantId]);
    const alertDays = nearExpirySetting ? parseInt(nearExpirySetting.value, 10) : (parseInt(req.query.days, 10) || 15);
    const alertDate = new Date(Date.now() + alertDays * 86400000).toISOString().split('T')[0];

    const rawBatches = await db.all(`
      SELECT b.*, p.name as product_name, p.sku, p.unit
      FROM batches b
      JOIN products p ON b.product_id = p.id AND p.tenant_id = b.tenant_id
      WHERE b.status = 'active' AND b.quantity > 0 AND b.expiry_date <= ? AND b.tenant_id = ?
      ORDER BY b.expiry_date ASC
    `, [alertDate, tenantId]);

    const todayMs = new Date(today).getTime();
    const batches = rawBatches.map(b => {
      const expStr = b.expiry_date ? String(b.expiry_date).split('T')[0] : today;
      const expMs = new Date(expStr).getTime();
      const daysRemaining = Math.round((expMs - todayMs) / 86400000);
      let statusIndicator = 'GOOD';
      if (expStr < today) statusIndicator = 'EXPIRED';
      else if (expStr <= alertDate) statusIndicator = 'NEAR_EXPIRY';

      return {
        ...b,
        days_remaining: daysRemaining,
        status_indicator: statusIndicator
      };
    });

    return res.json({ success: true, alert_days: alertDays, batches });
  } catch (err) {
    console.error('Expiry report error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch expiry report.' });
  }
};

// End-of-Day / Shift Register Z-Report
exports.getDayRegister = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const salesData = await db.get(`
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
    `, [date, tenantId]) || { total_bills: 0, total_sales: 0, total_discount: 0, cash_sales: 0, bank_sales: 0, card_sales: 0, credit_sales: 0 };

    const itemsSoldRow = await db.get(`
      SELECT COALESCE(SUM(si.quantity), 0) as total_qty
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id AND s.tenant_id = si.tenant_id
      WHERE s.sale_date = ? AND si.tenant_id = ?
    `, [date, tenantId]);
    const itemsSold = Number(itemsSoldRow?.total_qty || 0);

    const customerReceipts = await db.get(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN amount ELSE 0 END), 0) as cash_recovered,
        COALESCE(SUM(CASE WHEN payment_method != 'Cash' THEN amount ELSE 0 END), 0) as bank_recovered
      FROM payments
      WHERE payment_date = ? AND UPPER(party_type) = 'CUSTOMER' AND reference_id IS NULL AND tenant_id = ?
    `, [date, tenantId]) || { cash_recovered: 0, bank_recovered: 0 };

    const expenseData = await db.get(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN amount ELSE 0 END), 0) as cash_expenses,
        COALESCE(SUM(CASE WHEN payment_method != 'Cash' THEN amount ELSE 0 END), 0) as bank_expenses,
        COUNT(*) as expense_count
      FROM expenses
      WHERE expense_date = ? AND tenant_id = ?
    `, [date, tenantId]) || { cash_expenses: 0, bank_expenses: 0, expense_count: 0 };

    const expenseList = await db.all(`
      SELECT e.id, e.title, e.amount, e.payment_method, ec.name as category_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id AND ec.tenant_id = e.tenant_id
      WHERE e.expense_date = ? AND e.tenant_id = ?
      ORDER BY e.id ASC
    `, [date, tenantId]);

    const supplierDisbursements = await db.get(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN amount ELSE 0 END), 0) as cash_disbursed,
        COALESCE(SUM(CASE WHEN payment_method != 'Cash' THEN amount ELSE 0 END), 0) as bank_disbursed
      FROM payments
      WHERE payment_date = ? AND UPPER(party_type) = 'SUPPLIER' AND reference_id IS NULL AND tenant_id = ?
    `, [date, tenantId]) || { cash_disbursed: 0, bank_disbursed: 0 };

    const totalCashIn = Number(salesData.cash_sales) + Number(customerReceipts.cash_recovered);
    const totalCashOut = Number(expenseData.cash_expenses) + Number(supplierDisbursements.cash_disbursed);
    const netDrawerCash = totalCashIn - totalCashOut;

    const settingsRows = await db.all('SELECT key, value FROM tenant_settings WHERE tenant_id = ?', [tenantId]);
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
exports.getPurchasesReport = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
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

    const purchases = await db.all(query, params);

    const qtyRow = await db.get(`
      SELECT COALESCE(SUM(pi.quantity), 0) as total_qty
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id AND p.tenant_id = pi.tenant_id
      WHERE p.purchase_date >= ? AND p.purchase_date <= ? AND p.tenant_id = ?
      ${supplier_id ? 'AND p.supplier_id = ?' : ''}
    `, params);
    const totalQty = Number(qtyRow?.total_qty || 0);

    const summary = {
      total_purchases: purchases.reduce((sum, p) => sum + Number(p.grand_total), 0),
      total_paid: purchases.reduce((sum, p) => sum + Number(p.paid_amount), 0),
      total_balance_due: purchases.reduce((sum, p) => sum + Number(p.balance_due), 0),
      total_quantity: totalQty,
      invoice_count: purchases.length
    };

    return res.json({ success: true, purchases, summary });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to generate purchase report.' });
  }
};

// Supplier-wise Purchase Report
exports.getSupplierWisePurchaseReport = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { start_date, end_date } = req.query;
    const sDate = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const eDate = end_date || new Date().toISOString().split('T')[0];

    const suppliers = await db.all(`
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
      GROUP BY s.id, s.name, s.phone, s.contact_person, s.current_balance
      ORDER BY total_purchase_amount DESC
    `, [sDate, eDate, tenantId, tenantId]);

    for (const sup of suppliers) {
      sup.products = await db.all(`
        SELECT pr.name as product_name, COALESCE(pi.brand, pr.brand, '-') as brand,
          pi.unit,
          SUM(pi.quantity) as quantity,
          AVG(pi.unit_price) as avg_rate,
          SUM(pi.total_price) as total_amount
        FROM purchase_items pi
        JOIN purchases p ON pi.purchase_id = p.id AND p.tenant_id = pi.tenant_id
        JOIN products pr ON pi.product_id = pr.id AND pr.tenant_id = pi.tenant_id
        WHERE p.supplier_id = ? AND p.purchase_date >= ? AND p.purchase_date <= ? AND p.tenant_id = ?
        GROUP BY pr.id, pr.name, pi.unit, pi.brand, pr.brand
        ORDER BY total_amount DESC
      `, [sup.id, sDate, eDate, tenantId]);
    }

    const summary = {
      total_purchases: suppliers.reduce((sum, s) => sum + Number(s.total_purchase_amount), 0),
      total_paid: suppliers.reduce((sum, s) => sum + Number(s.total_paid), 0),
      total_balance_due: suppliers.reduce((sum, s) => sum + Number(s.total_credit_due), 0),
      total_quantity: suppliers.reduce((sum, s) => sum + Number(s.total_quantity), 0),
      supplier_count: suppliers.length
    };

    return res.json({ success: true, report: suppliers, summary });
  } catch (err) {
    console.error('getSupplierWisePurchaseReport error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate supplier-wise purchase report.' });
  }
};

// Product-wise Purchase Report
exports.getProductWisePurchaseReport = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { start_date, end_date } = req.query;
    const sDate = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const eDate = end_date || new Date().toISOString().split('T')[0];

    const products = await db.all(`
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
      GROUP BY pr.id, pr.name, pr.sku, pi.unit, pi.brand, pr.brand
      ORDER BY total_purchase_amount DESC
    `, [sDate, eDate, tenantId]);

    for (const prod of products) {
      prod.suppliers = await db.all(`
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
      `, [prod.product_id, sDate, eDate, tenantId]);
    }

    const summary = {
      total_purchases: products.reduce((sum, p) => sum + Number(p.total_purchase_amount), 0),
      total_quantity: products.reduce((sum, p) => sum + Number(p.total_quantity), 0),
      product_count: products.length
    };

    return res.json({ success: true, report: products, summary });
  } catch (err) {
    console.error('getProductWisePurchaseReport error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate product-wise purchase report.' });
  }
};

// Product-wise Sales Report
exports.getProductSalesReport = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { start_date, end_date } = req.query;
    const sDate = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const eDate = end_date || new Date().toISOString().split('T')[0];

    const report = await db.all(`
      SELECT
        p.id, p.name, p.sku, p.unit, c.name as category_name,
        COALESCE(SUM(si.quantity), 0) as total_qty_sold,
        COALESCE(SUM(si.total_price), 0) as total_revenue,
        COALESCE(AVG(si.unit_price), 0) as avg_sale_rate,
        COALESCE(SUM(si.quantity * si.cost_price), 0) as total_cost,
        COALESCE(SUM(si.total_price - (si.quantity * si.cost_price)), 0) as total_profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id AND s.sale_date >= ? AND s.sale_date <= ? AND s.tenant_id = ?
      JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id

      WHERE p.tenant_id = ?
      GROUP BY p.id, p.name, p.sku, p.unit, c.name
      HAVING COALESCE(SUM(si.quantity), 0) > 0
      ORDER BY total_revenue DESC
    `, [sDate, eDate, tenantId, tenantId]);

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
exports.getStockMovementsReport = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
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

    const movements = await db.all(query, params);

    return res.json({ success: true, movements });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch stock movements.' });
  }
};
