import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Printer,
  AlertTriangle,
  Package,
  Clock,
  Download,
  Receipt,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  ArrowDownToLine,
  X,
  ArrowRight
} from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate, formatDateTime } from '../utils/formatters';
import { exportToCSV } from '../utils/exportCsv';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { useAuth } from '../context/AuthContext';
import ReportPrintHeader from '../components/common/ReportPrintHeader';
import ReportPrintFooter from '../components/common/ReportPrintFooter';

function ReportsContent({ initialReport }) {
  const { user, isAdmin, canSell, canManageInventory, canViewFinances, role } = useAuth();

  const [activeReport, setActiveReport] = useState(() => {
    if (initialReport) return initialReport;
    if (role === 'sales') return 'register';
    if (role === 'inventory') return 'stock';
    return 'pnl';
  });

  useEffect(() => {
    if (initialReport) {
      setActiveReport(initialReport);
    }
  }, [initialReport]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; // 1st of month
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [registerDate, setRegisterDate] = useState(new Date().toISOString().split('T')[0]);

  // Data states
  const [settings, setSettings] = useState(() => ({
    shop_name: localStorage.getItem('lt_shop_name') || 'Latif Traders',
    tagline: localStorage.getItem('lt_shop_tagline') || 'CHICKEN SUPPLIER',
    phone: localStorage.getItem('lt_phone') || '',
    address: localStorage.getItem('lt_address') || '',
    email: localStorage.getItem('lt_email') || ''
  }));

  useEffect(() => {
    api.get('/settings').then(res => {
      if (res && res.success && res.settings) {
        setSettings(res.settings);
        if (res.settings.shop_name) localStorage.setItem('lt_shop_name', res.settings.shop_name);
        if (res.settings.tagline) localStorage.setItem('lt_shop_tagline', res.settings.tagline);
      }
    }).catch(() => {});
  }, []);

  const [pnl, setPnl] = useState(null);
  const [dailySales, setDailySales] = useState([]);
  const [stockReport, setStockReport] = useState(null);
  const [expiryReport, setExpiryReport] = useState(null);
  const [dayRegister, setDayRegister] = useState(null);
  const [purchasesReport, setPurchasesReport] = useState(null);
  const [supplierPurchasesReport, setSupplierPurchasesReport] = useState([]);
  const [productPurchasesReport, setProductPurchasesReport] = useState([]);
  const [purchasesView, setPurchasesView] = useState('summary'); // 'summary' | 'supplier' | 'product'
  const [productSalesReport, setProductSalesReport] = useState(null);
  const [movementsReport, setMovementsReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedMovement, setSelectedMovement] = useState(null);

  const getReportMeta = () => {
    switch (activeReport) {
      case 'pnl':
        return {
          title: 'PROFIT & LOSS (P&L) FINANCIAL STATEMENT',
          subtitle: 'Net operating margin, gross sales turnover, cost of goods sold & operational expenses',
          period: `${formatDate(startDate)} to ${formatDate(endDate)}`,
          ref: `PNL-${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`
        };
      case 'daily':
        return {
          title: 'DAILY SALES AUDIT LEDGER',
          subtitle: 'Daily transaction logs, revenue totals, cash collections, and credit receivables',
          period: `${formatDate(startDate)} to ${formatDate(endDate)}`,
          ref: `DSL-${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`
        };
      case 'register':
        return {
          title: 'END-OF-DAY SHIFT CLOSING REGISTER (Z-REPORT)',
          subtitle: 'Counter cash reconciliation, debt recoveries, disbursements & cash drawer verification',
          period: `Shift Date: ${formatDate(registerDate)}`,
          ref: `ZREG-${registerDate.replace(/-/g, '')}`
        };
      case 'stock':
        return {
          title: 'INVENTORY STOCK VALUATION & ASSET AUDIT',
          subtitle: 'Certified physical stock count, unit purchase valuation, retail value & gross potential margin',
          period: `Valuation As Of: ${formatDate(new Date().toISOString().split('T')[0])}`,
          ref: `STK-VAL-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`
        };
      case 'expiry':
        return {
          title: 'BATCH EXPIRATION & QUALITY CONTROL STATEMENT',
          subtitle: `Inventory batch health and near-expiry risk tracking within 15-day alert threshold`,
          period: `Inspection Date: ${formatDate(new Date().toISOString().split('T')[0])}`,
          ref: `EXP-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`
        };
      case 'purchases':
        return {
          title: 'SUPPLIER RESTOCKING & PURCHASES LEDGER',
          subtitle: 'Vendor procurement records, trade payables, cash disbursements & balance dues',
          period: `${formatDate(startDate)} to ${formatDate(endDate)}`,
          ref: `PUR-${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`
        };
      case 'product-sales':
        return {
          title: 'PRODUCT-WISE SALES & MARGIN BREAKDOWN',
          subtitle: 'Ranking of sold merchandise by gross revenue contribution, unit dispatch, and profit margin',
          period: `${formatDate(startDate)} to ${formatDate(endDate)}`,
          ref: `PRD-SLS-${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`
        };
      case 'movements':
        return {
          title: 'MASTER STOCK MOVEMENT AUDIT TRAIL',
          subtitle: 'Traceable history of all inventory restocks, sales deductions, returns & damage adjustments',
          period: `${formatDate(startDate)} to ${formatDate(endDate)}`,
          ref: `STK-MOV-${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`
        };
      default:
        return {
          title: 'BUSINESS AUDIT REPORT',
          subtitle: '',
          period: `${formatDate(startDate)} to ${formatDate(endDate)}`,
          ref: `REP-${Date.now().toString().slice(-6)}`
        };
    }
  };

  const currentMeta = getReportMeta();

  const loadReportData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      if (activeReport === 'pnl') {
        const res = await api.get(`/reports/profit-loss?start_date=${startDate}&end_date=${endDate}`);
        if (res && res.success) {
          setPnl(res);
        } else {
          setErrorMessage(res?.message || 'Unable to compute Profit & Loss statement.');
        }
      } else if (activeReport === 'daily') {
        const res = await api.get(`/reports/daily-sales?start_date=${startDate}&end_date=${endDate}`);
        if (res && res.success) {
          const list = Array.isArray(res.daily_summary) ? res.daily_summary : (Array.isArray(res.data) ? res.data : []);
          setDailySales(list);
        } else {
          setErrorMessage(res?.message || 'Unable to load daily sales ledger.');
        }
      } else if (activeReport === 'stock') {
        const res = await api.get('/reports/stock');
        if (res && res.success) {
          setStockReport(res);
        } else {
          setErrorMessage(res?.message || 'Unable to load stock valuation.');
        }
      } else if (activeReport === 'expiry') {
        const res = await api.get('/reports/expiry');
        if (res && res.success) {
          setExpiryReport(res);
        } else {
          setErrorMessage(res?.message || 'Unable to load expiry warnings.');
        }
      } else if (activeReport === 'register') {
        const res = await api.get(`/reports/day-register?date=${registerDate}`);
        if (res && res.success) {
          setDayRegister(res);
        } else {
          setErrorMessage(res?.message || 'Unable to load day register closing report.');
        }
      } else if (activeReport === 'purchases') {
        const [pRes, sRes, prdRes] = await Promise.all([
          api.get(`/reports/purchases?start_date=${startDate}&end_date=${endDate}`),
          api.get(`/reports/purchases/supplier-wise?start_date=${startDate}&end_date=${endDate}`),
          api.get(`/reports/purchases/product-wise?start_date=${startDate}&end_date=${endDate}`)
        ]);
        if (pRes && pRes.success) {
          setPurchasesReport(pRes);
        } else {
          setErrorMessage(pRes?.message || 'Unable to load purchases report.');
        }
        if (sRes && sRes.success) {
          setSupplierPurchasesReport(sRes.report || []);
        }
        if (prdRes && prdRes.success) {
          setProductPurchasesReport(prdRes.report || []);
        }
      } else if (activeReport === 'product-sales') {
        const res = await api.get(`/reports/product-sales?start_date=${startDate}&end_date=${endDate}`);
        if (res && res.success) {
          setProductSalesReport(res);
        } else {
          setErrorMessage(res?.message || 'Unable to load product sales report.');
        }
      } else if (activeReport === 'movements') {
        const res = await api.get(`/reports/movements?start_date=${startDate}&end_date=${endDate}`);
        if (res && res.success) {
          setMovementsReport(res.movements || []);
        } else {
          setErrorMessage(res?.message || 'Unable to load stock movements.');
        }
      }
    } catch (err) {
      console.error('Failed to load report:', err);
      setErrorMessage(err?.message || 'Network error while contacting reporting server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [activeReport, startDate, endDate, registerDate]);

  // Safe normalized P&L variables
  const m = pnl?.metrics || {};
  const grossSales = pnl?.revenue?.gross_sales ?? m.gross_sales ?? 0;
  const invoiceCount = pnl?.revenue?.invoice_count ?? m.invoice_count ?? 0;
  const discounts = pnl?.revenue?.discounts ?? m.discounts ?? 0;
  const netSales = pnl?.revenue?.net_sales ?? m.net_sales ?? (grossSales - discounts);
  const cogs = pnl?.cogs?.total_cogs ?? m.cogs ?? 0;
  const grossProfit = pnl?.gross_profit ?? m.gross_profit ?? (netSales - cogs);
  const totalExpenses = pnl?.expenses?.total_expenses ?? m.total_expenses ?? 0;
  const netProfit = pnl?.net_profit ?? m.net_profit ?? (grossProfit - totalExpenses);

  const rawExpenseBreakdown = pnl?.expenses?.category_breakdown || pnl?.expense_breakdown || [];
  const categoryBreakdown = Array.isArray(rawExpenseBreakdown)
    ? rawExpenseBreakdown.map(e => ({
        category_name: e.category_name || e.category || 'General',
        total_amount: Number(e.total_amount ?? e.amount ?? 0)
      }))
    : [];

  // Safe normalized Day Register variables
  const regSales = dayRegister?.sales || {};
  const regCustomerReceipts = dayRegister?.customer_receipts || {};
  const regExpenses = dayRegister?.expenses || {};
  const regSupplier = dayRegister?.supplier_disbursements || {};
  const regCash = dayRegister?.cash_summary || {};
  const regSettings = dayRegister?.settings || {};
  const regExpenseList = Array.isArray(regExpenses.list) ? regExpenses.list : [];

  // Safe normalized Stock variables
  const stockItems = Array.isArray(stockReport?.stock) ? stockReport.stock : [];
  const stockTotals = stockReport?.totals || {};

  // Safe normalized Expiry variables
  const expiryBatches = Array.isArray(expiryReport?.batches) ? expiryReport.batches : [];
  const expiryAlertDays = expiryReport?.alert_days ?? 15;

  // CSV Export Handlers
  const handleExportCSV = () => {
    if (activeReport === 'daily' && dailySales.length) {
      exportToCSV(`Daily_Sales_${startDate}_${endDate}`, dailySales, [
        { label: 'Date', key: 'sale_date' },
        { label: 'Invoices', key: 'invoice_count' },
        { label: 'Total Sales (PKR)', key: 'total_sales' },
        { label: 'Cash Collected (PKR)', key: 'cash_received' },
        { label: 'Credit Sales (PKR)', key: 'credit_sales' }
      ]);
    } else if (activeReport === 'stock' && stockItems.length) {
      exportToCSV('Stock_Valuation_Report', stockItems, [
        { label: 'Product Name', key: 'name' },
        { label: 'Category', key: 'category_name' },
        { label: 'Available Qty', key: 'available_qty' },
        { label: 'Unit', key: 'unit' },
        { label: 'Cost Price (PKR)', key: 'purchase_price' },
        { label: 'Retail Price (PKR)', key: 'sale_price' },
        { label: 'Total Cost Value (PKR)', key: 'total_cost_value' },
        { label: 'Total Retail Value (PKR)', key: 'total_retail_value' },
        { label: 'Potential Profit (PKR)', key: 'potential_profit' }
      ]);
    } else if (activeReport === 'expiry' && expiryBatches.length) {
      exportToCSV('Batch_Expiry_Report', expiryBatches, [
        { label: 'Product Name', key: 'product_name' },
        { label: 'Batch No', key: 'batch_no' },
        { label: 'Expiry Date', key: 'expiry_date' },
        { label: 'Remaining Qty', key: 'quantity' },
        { label: 'Unit', key: 'unit' },
        { label: 'Days Remaining', key: 'days_remaining' },
        { label: 'Status', key: 'status_indicator' }
      ]);
    } else if (activeReport === 'register' && dayRegister) {
      const rows = [
        { Metric: 'Date', Amount: dayRegister.date || registerDate },
        { Metric: 'Total Bills Count', Amount: regSales.total_bills || 0 },
        { Metric: 'Total Items Sold', Amount: regSales.items_sold || 0 },
        { Metric: 'Total Gross Sales', Amount: regSales.total_sales || 0 },
        { Metric: 'Cash Sales', Amount: regSales.cash_sales || 0 },
        { Metric: 'Bank/Card Sales', Amount: Number(regSales.bank_sales || 0) + Number(regSales.card_sales || 0) },
        { Metric: 'Credit Sales (Receivable)', Amount: regSales.credit_sales || 0 },
        { Metric: 'Customer Recoveries (Debt Cash Collected)', Amount: regCustomerReceipts.cash_recovered || 0 },
        { Metric: 'Total Cash In', Amount: regCash.total_cash_in || 0 },
        { Metric: 'Cash Expenses Paid', Amount: regExpenses.cash_expenses || 0 },
        { Metric: 'Supplier Cash Disbursements', Amount: regSupplier.cash_disbursed || 0 },
        { Metric: 'Total Cash Out', Amount: regCash.total_cash_out || 0 },
        { Metric: 'Net Drawer Cash Balance', Amount: regCash.net_drawer_cash || 0 }
      ];
      exportToCSV(`Day_Register_${registerDate}`, rows, [
        { label: 'Register Metric', key: 'Metric' },
        { label: 'Value / Amount (PKR)', key: 'Amount' }
      ]);
    } else if (activeReport === 'pnl' && (pnl || m)) {
      const rows = [
        { Category: 'Gross Sales Revenue', Amount: grossSales },
        { Category: 'Discounts Allowed', Amount: -discounts },
        { Category: 'Net Sales Revenue', Amount: netSales },
        { Category: 'Cost of Goods Sold (COGS)', Amount: -cogs },
        { Category: 'Gross Profit', Amount: grossProfit },
        { Category: 'Total Operating Expenses', Amount: -totalExpenses },
        { Category: 'Net Business Profit', Amount: netProfit }
      ];
      exportToCSV(`Profit_and_Loss_${startDate}_${endDate}`, rows, [
        { label: 'Financial Category', key: 'Category' },
        { label: 'Amount (PKR)', key: 'Amount' }
      ]);
    } else if (activeReport === 'purchases') {
      if (purchasesView === 'supplier' && supplierPurchasesReport.length) {
        exportToCSV(`Supplier_Wise_Purchases_${startDate}_${endDate}`, supplierPurchasesReport, [
          { label: 'Supplier Name', key: 'supplier_name' },
          { label: 'Company Name', key: 'company_name' },
          { label: 'Phone', key: 'phone' },
          { label: 'Products Purchased', key: 'products_bought' },
          { label: 'Total Quantity (KG / Packets)', key: 'total_quantity' },
          { label: 'Avg Rate / Unit (PKR)', key: 'avg_unit_rate' },
          { label: 'Total Purchases (PKR)', key: 'total_purchased' },
          { label: 'Total Paid (PKR)', key: 'total_paid' },
          { label: 'Balance Due / Payable (PKR)', key: 'total_due' },
          { label: 'Bills Count', key: 'bills_count' }
        ]);
      } else if (purchasesView === 'product' && productPurchasesReport.length) {
        exportToCSV(`Product_Wise_Purchases_${startDate}_${endDate}`, productPurchasesReport, [
          { label: 'Product Name', key: 'product_name' },
          { label: 'Brand', key: 'brand' },
          { label: 'Suppliers / Vendors', key: 'suppliers' },
          { label: 'Total Quantity (KG / Packets)', key: 'total_quantity' },
          { label: 'Avg Rate / Unit (PKR)', key: 'avg_rate' },
          { label: 'Total Amount (PKR)', key: 'total_amount' }
        ]);
      } else if (purchasesReport?.purchases?.length) {
        exportToCSV(`Purchases_Invoices_${startDate}_${endDate}`, purchasesReport.purchases, [
          { label: 'Invoice No', key: 'invoice_no' },
          { label: 'Date', key: 'purchase_date' },
          { label: 'Supplier', key: 'supplier_name' },
          { label: 'Items Count', key: 'item_count' },
          { label: 'Grand Total (PKR)', key: 'grand_total' },
          { label: 'Paid (PKR)', key: 'paid_amount' },
          { label: 'Balance Due (PKR)', key: 'balance_due' },
          { label: 'Payment Method', key: 'payment_method' }
        ]);
      }
    } else if (activeReport === 'product-sales' && productSalesReport?.report?.length) {
      exportToCSV(`Product_Sales_Report_${startDate}_${endDate}`, productSalesReport.report, [
        { label: 'Product Name', key: 'name' },
        { label: 'SKU', key: 'sku' },
        { label: 'Category', key: 'category_name' },
        { label: 'Units Sold', key: 'total_qty_sold' },
        { label: 'Unit', key: 'unit' },
        { label: 'Total Revenue (PKR)', key: 'total_revenue' },
        { label: 'Total Cost (PKR)', key: 'total_cost' },
        { label: 'Net Profit (PKR)', key: 'total_profit' }
      ]);
    } else if (activeReport === 'movements' && movementsReport?.length) {
      exportToCSV(`Stock_Movements_${startDate}_${endDate}`, movementsReport, [
        { label: 'Date', key: 'created_at' },
        { label: 'Product Name', key: 'product_name' },
        { label: 'SKU', key: 'sku' },
        { label: 'Batch No', key: 'batch_no' },
        { label: 'Movement Type', key: 'type' },
        { label: 'Delta Qty', key: 'quantity_delta' },
        { label: 'Balance After', key: 'balance_after' },
        { label: 'Reason', key: 'reason' },
        { label: 'Logged By', key: 'user_name' }
      ]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 1. CLEAN PAGE HEADER */}
      <div className="page-header no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            {activeReport === 'stock' ? 'Inventory Stock Valuation' : 'Financial Reports & Analytics'}
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0' }}>
            {activeReport === 'stock'
              ? 'Real-time asset valuation, unit purchase costs, retail margins, and warehouse holding value'
              : 'Certified profit & loss, daily sales audit, cash register closing, and product analytics'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button onClick={loadReportData} className="btn btn-secondary btn-sm" style={{ height: '34px', fontSize: '0.8rem', padding: '0 0.85rem' }} title="Refresh Report Data">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button onClick={handleExportCSV} className="btn btn-secondary btn-sm" style={{ height: '34px', fontSize: '0.8rem', padding: '0 0.85rem' }} title="Download Excel / CSV">
            <Download size={13} />
            <span>Export CSV</span>
          </button>

          <button onClick={() => window.print()} className="btn btn-primary btn-sm" style={{ height: '34px', fontSize: '0.8rem', fontWeight: 600, padding: '0 1rem' }} title="Print Official Report">
            <Printer size={14} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* 2. REPORT NAVIGATION TABS & FILTER TOOLBAR */}
      <div className="card no-print" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.85rem 1.15rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          {(isAdmin || canViewFinances) && (
            <button
              onClick={() => setActiveReport('pnl')}
              className={`filter-pill ${activeReport === 'pnl' ? 'active' : ''}`}
            >
              <TrendingUp size={13} />
              <span>P&L Statement</span>
            </button>
          )}

          {(isAdmin || canSell || canViewFinances) && (
            <button
              onClick={() => setActiveReport('daily')}
              className={`filter-pill ${activeReport === 'daily' ? 'active' : ''}`}
            >
              <BarChart3 size={13} />
              <span>Daily Sales</span>
            </button>
          )}

          {(isAdmin || canSell || canViewFinances) && (
            <button
              onClick={() => setActiveReport('register')}
              className={`filter-pill ${activeReport === 'register' ? 'active' : ''}`}
            >
              <Receipt size={13} />
              <span>Day-End Z-Register</span>
            </button>
          )}

          {(isAdmin || canManageInventory || canViewFinances) && (
            <button
              onClick={() => setActiveReport('stock')}
              className={`filter-pill ${activeReport === 'stock' ? 'active' : ''}`}
            >
              <Package size={13} />
              <span>Stock Valuation</span>
            </button>
          )}

          {(isAdmin || canManageInventory || canViewFinances) && (
            <button
              onClick={() => setActiveReport('expiry')}
              className={`filter-pill ${activeReport === 'expiry' ? 'active' : ''}`}
            >
              <Clock size={13} />
              <span>Batch Expiry</span>
            </button>
          )}

          {(isAdmin || canManageInventory || canViewFinances) && (
            <button
              onClick={() => setActiveReport('purchases')}
              className={`filter-pill ${activeReport === 'purchases' ? 'active' : ''}`}
            >
              <ArrowDownToLine size={13} />
              <span>Purchases Ledger</span>
            </button>
          )}

          {(isAdmin || canSell || canViewFinances) && (
            <button
              onClick={() => setActiveReport('product-sales')}
              className={`filter-pill ${activeReport === 'product-sales' ? 'active' : ''}`}
            >
              <DollarSign size={13} />
              <span>Product Sales</span>
            </button>
          )}

          {(isAdmin || canManageInventory || canViewFinances) && (
            <button
              onClick={() => setActiveReport('movements')}
              className={`filter-pill ${activeReport === 'movements' ? 'active' : ''}`}
            >
              <RefreshCw size={13} />
              <span>Stock Movements</span>
            </button>
          )}
        </div>

        {/* DATE RANGE FILTER ROW (If applicable to report) */}
        {((activeReport === 'pnl' || activeReport === 'daily' || activeReport === 'purchases' || activeReport === 'product-sales' || activeReport === 'movements') || activeReport === 'register') && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.65rem',
            flexWrap: 'wrap',
            borderTop: '1px solid #f1f5f9',
            paddingTop: '0.65rem'
          }}>
            {(activeReport === 'pnl' || activeReport === 'daily' || activeReport === 'purchases' || activeReport === 'product-sales' || activeReport === 'movements') && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '2px 8px',
                height: '32px'
              }}>
                <Calendar size={13} color="#64748b" />
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>From:</span>
                <input
                  type="date"
                  style={{ border: 'none', background: 'transparent', height: '24px', fontSize: '0.775rem', color: '#0f172a' }}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>to</span>
                <input
                  type="date"
                  style={{ border: 'none', background: 'transparent', height: '24px', fontSize: '0.775rem', color: '#0f172a' }}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            )}

            {activeReport === 'register' && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '2px 8px',
                height: '32px'
              }}>
                <Calendar size={13} color="#64748b" />
                <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Shift Date:</span>
                <input
                  type="date"
                  style={{ border: 'none', background: 'transparent', height: '24px', fontSize: '0.775rem', color: '#0f172a' }}
                  value={registerDate}
                  onChange={(e) => setRegisterDate(e.target.value)}
                />
              </div>
            )}

            {activeReport === 'purchases' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>View:</span>
                <button
                  type="button"
                  onClick={() => setPurchasesView('summary')}
                  className={`filter-pill ${purchasesView === 'summary' ? 'active' : ''}`}
                >
                  Summary
                </button>
                <button
                  type="button"
                  onClick={() => setPurchasesView('supplier')}
                  className={`filter-pill ${purchasesView === 'supplier' ? 'active' : ''}`}
                >
                  By Supplier
                </button>
                <button
                  type="button"
                  onClick={() => setPurchasesView('product')}
                  className={`filter-pill ${purchasesView === 'product' ? 'active' : ''}`}
                >
                  By Product
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ERROR BANNER IF ANY */}
      {errorMessage && (
        <div style={{
          padding: '0.75rem 1rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#991b1b',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} />
            <span>{errorMessage}</span>
          </div>
          <button onClick={loadReportData} className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* REPORT DISPLAY AREA */}
      <div className="printable-area">
        {/* Subtle diagonal background watermark for authentic business branding */}
        <div className="report-watermark">
          {settings.shop_name || 'Latif Traders'}™ • OFFICIAL BUSINESS RECORD
        </div>

        <div className="report-print-container">
          <ReportPrintHeader
            settings={settings}
            reportTitle={currentMeta.title}
            reportSubtitle={currentMeta.subtitle}
            dateRangeText={currentMeta.period}
            docRef={currentMeta.ref}
            user={user}
          />

          {/* 1. PROFIT & LOSS STATEMENT */}
          {activeReport === 'pnl' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
              {/* 4 SUMMARY METRIC CARDS FOR P&L */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                <div className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Net Sales</div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0284c7', marginTop: '0.35rem', lineHeight: 1.1 }}>
                      {formatPKR(netSales)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>Gross sales after discounts</div>
                  </div>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#eff6ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <DollarSign size={20} />
                  </div>
                </div>

                <div className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cost of Goods (COGS)</div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#475569', marginTop: '0.35rem', lineHeight: 1.1 }}>
                      {formatPKR(cogs)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>Stock purchase cost of items sold</div>
                  </div>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Package size={20} />
                  </div>
                </div>

                <div className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Operating Expenses</div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ef4444', marginTop: '0.35rem', lineHeight: 1.1 }}>
                      {formatPKR(totalExpenses)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>Shop utilities, bills & maintenance</div>
                  </div>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ArrowDownRight size={20} />
                  </div>
                </div>

                <div className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Net Business Profit</div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: netProfit >= 0 ? '#059669' : '#dc2626', marginTop: '0.35rem', lineHeight: 1.1 }}>
                      {formatPKR(netProfit)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>Net bottom-line margin</div>
                  </div>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: netProfit >= 0 ? '#ecfdf5' : '#fef2f2', color: netProfit >= 0 ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <TrendingUp size={20} />
                  </div>
                </div>
              </div>

              {/* DETAILED P&L STATEMENT CARD */}
              <div className="card" style={{ width: '100%', padding: '1.25rem' }}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>Calculating financial statements...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* REVENUE SECTION */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.3rem', marginBottom: '0.4rem' }}>
                        1. Revenue / Turnover
                      </h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', fontSize: '0.825rem' }}>
                        <span>Gross Sales {invoiceCount > 0 ? `(${invoiceCount} invoices)` : ''}</span>
                        <span style={{ fontWeight: 600 }}>{formatPKR(grossSales)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', color: '#ef4444', fontSize: '0.825rem' }}>
                        <span>Less: Discounts Allowed</span>
                        <span>- {formatPKR(discounts)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderTop: '1px dashed #cbd5e1', fontWeight: 700, fontSize: '0.85rem' }}>
                        <span>Net Sales Revenue</span>
                        <span style={{ color: '#0284c7' }}>{formatPKR(netSales)}</span>
                      </div>
                    </div>

                    {/* COGS SECTION */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.3rem', marginBottom: '0.4rem' }}>
                        2. Cost of Goods Sold (COGS)
                      </h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', fontSize: '0.825rem' }}>
                        <span>Cost of Frozen Items Sold (FIFO/Lot Cost)</span>
                        <span style={{ fontWeight: 600 }}>{formatPKR(cogs)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderTop: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', fontWeight: 800, fontSize: '0.95rem' }}>
                        <span>Gross Profit</span>
                        <span style={{ color: grossProfit >= 0 ? '#10b981' : '#ef4444' }}>{formatPKR(grossProfit)}</span>
                      </div>
                    </div>

                    {/* EXPENSES SECTION */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.3rem', marginBottom: '0.4rem' }}>
                        3. Operating Expenses
                      </h4>
                      {categoryBreakdown.length === 0 ? (
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '0.25rem 0' }}>No operating expenses recorded for this period.</div>
                      ) : (
                        categoryBreakdown.map((exp, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', fontSize: '0.825rem', color: '#475569' }}>
                            <span>{exp.category_name}</span>
                            <span>{formatPKR(exp.total_amount)}</span>
                          </div>
                        ))
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderTop: '1px dashed #cbd5e1', fontWeight: 700, color: '#ef4444', fontSize: '0.85rem' }}>
                        <span>Total Operating Expenses</span>
                        <span>- {formatPKR(totalExpenses)}</span>
                      </div>
                    </div>

                    {/* NET PROFIT */}
                    <div style={{
                      background: netProfit >= 0 ? '#ecfdf5' : '#fef2f2',
                      border: `2px solid ${netProfit >= 0 ? '#10b981' : '#ef4444'}`,
                      borderRadius: '8px',
                      padding: '1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: netProfit >= 0 ? '#065f46' : '#991b1b' }}>
                          NET BUSINESS PROFIT / (LOSS)
                        </h3>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Net Sales ({formatPKR(netSales)}) - COGS ({formatPKR(cogs)}) - Expenses ({formatPKR(totalExpenses)})
                        </div>
                      </div>
                      <div style={{
                        fontSize: '1.4rem',
                        fontWeight: 900,
                        color: netProfit >= 0 ? '#059669' : '#dc2626'
                      }}>
                        {formatPKR(netProfit)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* 2. DAILY SALES SUMMARY */}
        {activeReport === 'daily' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem' }}>Daily Sales Ledger</h3>
              <span style={{ fontSize: '0.775rem', color: '#64748b' }}>{dailySales.length} Days Recorded</span>
            </div>

            <div className="table-responsive">
              <table className="table" style={{ width: '100%', minWidth: '650px' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th style={{ textAlign: 'center' }}>Invoices</th>
                    <th style={{ textAlign: 'right' }}>Total Sales (PKR)</th>
                    <th style={{ textAlign: 'right' }}>Cash Received (PKR)</th>
                    <th style={{ textAlign: 'right' }}>Credit Sales (PKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySales.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                        {loading ? 'Loading daily records...' : 'No sales recorded for this date range.'}
                      </td>
                    </tr>
                  ) : (
                    dailySales.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{formatDate(row.sale_date || row.date)}</td>
                        <td style={{ textAlign: 'center' }}><span className="badge badge-info">{row.invoice_count || 0}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatPKR(row.total_sales || 0)}</td>
                        <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{formatPKR(row.cash_received ?? row.cash_collected ?? 0)}</td>
                        <td style={{ textAlign: 'right', color: (row.credit_sales || 0) > 0 ? '#ef4444' : '#64748b' }}>
                          {formatPKR(row.credit_sales || 0)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. END-OF-DAY REGISTER / SHIFT CLOSING Z-REPORT */}
        {activeReport === 'register' && (
          <div className="card" style={{ maxWidth: '650px', margin: '0 auto', width: '100%' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2.5rem' }}>Loading Day Register...</div>
            ) : dayRegister ? (
              <div>

                {/* COUNTER SALES BREAKDOWN */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.25rem', marginBottom: '0.4rem' }}>
                    1. Counter Sales Breakdown
                  </div>
                  <div className="form-grid-2" style={{ gap: '0.5rem', fontSize: '0.8rem' }}>
                    <div>Total Invoices: <strong>{regSales.total_bills || 0}</strong></div>
                    <div>Items Sold: <strong>{regSales.items_sold || 0} units</strong></div>
                    <div>Gross Sales: <strong>{formatPKR(regSales.total_sales || 0)}</strong></div>
                    <div>Discounts: <strong style={{ color: '#ef4444' }}>- {formatPKR(regSales.total_discount || 0)}</strong></div>
                  </div>
                  <div style={{ marginTop: '0.4rem', padding: '0.4rem 0.6rem', background: '#f8fafc', borderRadius: '6px', fontSize: '0.775rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Cash Sales:</span>
                      <strong style={{ color: '#10b981' }}>{formatPKR(regSales.cash_sales || 0)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Bank / Card Sales:</span>
                      <strong>{formatPKR(Number(regSales.bank_sales || 0) + Number(regSales.card_sales || 0))}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Credit (Unpaid) Sales:</span>
                      <strong style={{ color: '#ef4444' }}>{formatPKR(regSales.credit_sales || 0)}</strong>
                    </div>
                  </div>
                </div>

                {/* CASH INFLOW & OUTFLOW SUMMARY */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.25rem', marginBottom: '0.4rem' }}>
                    2. Cash Inflow & Outflow (Cash Drawer)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                      <span>+ Cash Counter Sales:</span>
                      <span>{formatPKR(regSales.cash_sales || 0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                      <span>+ Customer Debt Cash Recoveries:</span>
                      <span>{formatPKR(regCustomerReceipts.cash_recovered || 0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px dashed #cbd5e1', paddingTop: '0.2rem' }}>
                      <span>TOTAL CASH IN:</span>
                      <span style={{ color: '#10b981' }}>{formatPKR(regCash.total_cash_in || 0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', marginTop: '0.2rem' }}>
                      <span>- Cash Shop Expenses:</span>
                      <span>- {formatPKR(regExpenses.cash_expenses || 0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                      <span>- Supplier Cash Paid:</span>
                      <span>- {formatPKR(regSupplier.cash_disbursed || 0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px dashed #cbd5e1', paddingTop: '0.2rem' }}>
                      <span>TOTAL CASH OUT:</span>
                      <span style={{ color: '#ef4444' }}>- {formatPKR(regCash.total_cash_out || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* NET DRAWER CASH BOX */}
                <div style={{
                  background: '#f0f9ff',
                  border: '2px solid #0284c7',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0369a1' }}>
                      NET CASH IN DRAWER TO HAND OVER:
                    </div>
                    <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                      Cash In ({formatPKR(regCash.total_cash_in || 0)}) - Cash Out ({formatPKR(regCash.total_cash_out || 0)})
                    </div>
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0284c7' }}>
                    {formatPKR(regCash.net_drawer_cash || 0)}
                  </div>
                </div>

                {/* EXPENSES LIST TODAY */}
                {regExpenseList.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
                      Today's Logged Expenses ({regExpenseList.length}):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.75rem' }}>
                      {regExpenseList.map((e, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.15rem 0.35rem', background: '#f8fafc', borderRadius: '4px' }}>
                          <span>{e.title} ({e.category_name || 'General'}) - {e.payment_method}</span>
                          <span style={{ fontWeight: 600 }}>{formatPKR(e.amount || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                <p style={{ fontWeight: 600, fontSize: '0.95rem', color: '#475569' }}>No register transactions recorded for {formatDate(registerDate)}.</p>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>Select another shift date above or conduct counter sales in POS.</p>
              </div>
            )}
          </div>
        )}

        {/* 4. STOCK VALUATION REPORT */}
        {activeReport === 'stock' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            {/* 3 SUMMARY METRIC CARDS FOR STOCK */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
              <div className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Cost (Kharid)</div>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem', lineHeight: 1.1 }}>
                    {formatPKR(stockTotals.total_cost_value || 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>Total purchase cost of inventory</div>
                </div>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Package size={20} />
                </div>
              </div>

              <div className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Retail Value (Sale)</div>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0284c7', marginTop: '0.35rem', lineHeight: 1.1 }}>
                    {formatPKR(stockTotals.total_retail_value || 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>Expected revenue at retail prices</div>
                </div>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#eff6ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <TrendingUp size={20} />
                </div>
              </div>

              <div className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Potential Margin</div>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#059669', marginTop: '0.35rem', lineHeight: 1.1 }}>
                    {formatPKR(stockTotals.total_potential_profit || 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>Unrealized gross profit upon sale</div>
                </div>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <DollarSign size={20} />
                </div>
              </div>
            </div>

            {/* INVENTORY VALUATION TABLE CARD */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Inventory Stock & Valuation Audit</h3>
                  <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Itemized stock quantities, purchase costs, sale rates, and gross potential margin</p>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Total active items: <strong style={{ color: '#0f172a' }}>{stockItems.length}</strong>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table" style={{ width: '100%', minWidth: '760px' }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'center' }}>In Stock</th>
                      <th style={{ textAlign: 'right' }}>Cost (PKR)</th>
                      <th style={{ textAlign: 'right' }}>Sale (PKR)</th>
                      <th style={{ textAlign: 'right' }}>Total Cost (PKR)</th>
                      <th style={{ textAlign: 'right' }}>Retail Value (PKR)</th>
                      <th style={{ textAlign: 'right' }}>Profit (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockItems.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                          {loading ? 'Loading inventory data...' : 'No inventory items found.'}
                        </td>
                      </tr>
                    ) : (
                      stockItems.map(item => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600 }}>{item.name}</td>
                          <td>{item.category_name || '-'}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.available_qty || 0} {item.unit || ''}</td>
                          <td style={{ textAlign: 'right' }}>{formatPKR(item.purchase_price || 0)}</td>
                          <td style={{ textAlign: 'right' }}>{formatPKR(item.sale_price || 0)}</td>
                          <td style={{ textAlign: 'right' }}>{formatPKR(item.total_cost_value || 0)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>{formatPKR(item.total_retail_value || 0)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{formatPKR(item.potential_profit || 0)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 5. EXPIRY ALERT REPORT */}
        {activeReport === 'expiry' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '1rem' }}>Batch Expiration & Quality Control</h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Batches monitored within a {expiryAlertDays}-day warning threshold.
              </p>
            </div>

            <div className="table-responsive">
              <table className="table" style={{ width: '100%', minWidth: '650px' }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Batch Lot #</th>
                    <th>Expiry Date</th>
                    <th style={{ textAlign: 'center' }}>Batch Qty</th>
                    <th style={{ textAlign: 'right' }}>Days Remaining</th>
                    <th style={{ textAlign: 'center' }}>Quality Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expiryBatches.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                        {loading ? 'Checking batch expiration dates...' : 'No expiring or expired batches found.'}
                      </td>
                    </tr>
                  ) : (
                    expiryBatches.map(b => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 600 }}>{b.product_name}</td>
                        <td className="mono">{b.batch_no}</td>
                        <td>{formatDate(b.expiry_date)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{b.quantity || 0} {b.unit || ''}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {(b.days_remaining || 0) <= 0 ? '0' : b.days_remaining} days
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {b.status_indicator === 'EXPIRED' ? (
                            <span className="badge badge-danger">Expired</span>
                          ) : b.status_indicator === 'NEAR_EXPIRY' ? (
                            <span className="badge badge-warning">Expiring Soon</span>
                          ) : (
                            <span className="badge badge-success">Good</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. PURCHASES REPORT */}
        {activeReport === 'purchases' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* KPI METRICS CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
              <div className="card" style={{ borderLeft: '4px solid #0284c7', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.725rem', fontWeight: 600, color: '#64748b' }}>TOTAL PURCHASES</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                  {formatPKR(purchasesReport?.summary?.total_purchases || 0)}
                </div>
              </div>
              <div className="card" style={{ borderLeft: '4px solid #f59e0b', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.725rem', fontWeight: 600, color: '#64748b' }}>TOTAL QUANTITY</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>
                  {Number(purchasesReport?.summary?.total_quantity || 0).toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>KG / Pkts</span>
                </div>
              </div>
              <div className="card" style={{ borderLeft: '4px solid #10b981', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.725rem', fontWeight: 600, color: '#64748b' }}>TOTAL PAID</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>
                  {formatPKR(purchasesReport?.summary?.total_paid || 0)}
                </div>
              </div>
              <div className="card" style={{ borderLeft: '4px solid #ef4444', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.725rem', fontWeight: 600, color: '#64748b' }}>PAYABLE DUE (CREDIT)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444', marginTop: '0.2rem' }}>
                  {formatPKR(purchasesReport?.summary?.total_balance_due || 0)}
                </div>
              </div>
              <div className="card" style={{ borderLeft: '4px solid #8b5cf6', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.725rem', fontWeight: 600, color: '#64748b' }}>BILLS RECORDED</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#8b5cf6', marginTop: '0.2rem' }}>
                  {purchasesReport?.summary?.invoice_count || 0} bills
                </div>
              </div>
            </div>

            {/* PURCHASES SUB-VIEW NAVIGATION */}
            <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '4px', borderRadius: '8px', width: 'fit-content', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-sm ${purchasesView === 'summary' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.775rem', padding: '4px 10px' }}
                onClick={() => setPurchasesView('summary')}
              >
                Overall Invoices ({purchasesReport?.purchases?.length || 0})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${purchasesView === 'supplier' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.775rem', padding: '4px 10px' }}
                onClick={() => setPurchasesView('supplier')}
              >
                Supplier-Wise Report ({supplierPurchasesReport.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${purchasesView === 'product' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.775rem', padding: '4px 10px' }}
                onClick={() => setPurchasesView('product')}
              >
                Product-Wise Report ({productPurchasesReport.length})
              </button>
            </div>

            {/* VIEW 1: OVERALL INVOICES */}
            {purchasesView === 'summary' && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '0.95rem' }}>Purchases Invoice Ledger</h3>
                    <p style={{ fontSize: '0.725rem', color: '#64748b' }}>All purchase bills recorded from {formatDate(startDate)} to {formatDate(endDate)}</p>
                  </div>
                  <span className="badge badge-info">{purchasesReport?.purchases?.length || 0} Invoices</span>
                </div>
                <div className="table-responsive">
                  <table className="table" style={{ width: '100%', minWidth: '760px' }}>
                    <thead>
                      <tr>
                        <th>Inv #</th>
                        <th>Date</th>
                        <th>Supplier Name</th>
                        <th style={{ textAlign: 'center' }}>Items</th>
                        <th style={{ textAlign: 'right' }}>Grand Total</th>
                        <th style={{ textAlign: 'right' }}>Paid Amount</th>
                        <th style={{ textAlign: 'right' }}>Balance Due</th>
                        <th>Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!purchasesReport?.purchases?.length ? (
                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No purchase invoices found in date range.</td></tr>
                      ) : (
                        purchasesReport.purchases.map(p => (
                          <tr key={p.id}>
                            <td className="mono" style={{ fontWeight: 700, color: '#0284c7' }}>{p.invoice_no}</td>
                            <td>{formatDate(p.purchase_date)}</td>
                            <td style={{ fontWeight: 600 }}>{p.supplier_name}</td>
                            <td style={{ textAlign: 'center' }}>{p.item_count}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatPKR(p.grand_total)}</td>
                            <td style={{ textAlign: 'right', color: '#10b981' }}>{formatPKR(p.paid_amount)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: p.balance_due > 0 ? '#ef4444' : '#64748b' }}>
                              {formatPKR(p.balance_due)}
                            </td>
                            <td><span className="badge badge-secondary">{p.payment_method}</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW 2: SUPPLIER-WISE REPORT */}
            {purchasesView === 'supplier' && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '0.95rem' }}>Supplier-Wise Purchase Report & Credit Ledger</h3>
                    <p style={{ fontSize: '0.725rem', color: '#64748b' }}>Procurement volume, items bought, average rates, and outstanding balances per supplier</p>
                  </div>
                  <span className="badge badge-info">{supplierPurchasesReport.length} Suppliers</span>
                </div>
                <div className="table-responsive">
                  <table className="table" style={{ width: '100%', minWidth: '850px' }}>
                    <thead>
                      <tr>
                        <th>Supplier / Vendor</th>
                        <th>Products Procured</th>
                        <th style={{ textAlign: 'center' }}>Total Qty</th>
                        <th style={{ textAlign: 'right' }}>Avg Rate</th>
                        <th style={{ textAlign: 'right' }}>Total Purchases</th>
                        <th style={{ textAlign: 'right' }}>Total Paid</th>
                        <th style={{ textAlign: 'right' }}>Balance Due (Credit)</th>
                        <th style={{ textAlign: 'center' }}>Bills</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierPurchasesReport.length === 0 ? (
                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No supplier procurement found for this date range.</td></tr>
                      ) : (
                        supplierPurchasesReport.map((s, idx) => (
                          <tr key={idx}>
                            <td>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{s.supplier_name}</div>
                              {s.company_name && <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{s.company_name}</div>}
                            </td>
                            <td style={{ fontSize: '0.75rem', color: '#334155', maxWidth: '220px', lineHeight: 1.25 }}>
                              {s.products_bought || '-'}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 700, color: '#0284c7' }}>
                              {Number(s.total_quantity || 0).toLocaleString()}
                            </td>
                            <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                              {formatPKR(s.avg_unit_rate || 0)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              {formatPKR(s.total_purchased || 0)}
                            </td>
                            <td style={{ textAlign: 'right', color: '#10b981' }}>
                              {formatPKR(s.total_paid || 0)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: s.total_due > 0 ? '#ef4444' : '#10b981' }}>
                              {formatPKR(s.total_due || 0)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="badge badge-secondary">{s.bills_count}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW 3: PRODUCT-WISE REPORT */}
            {purchasesView === 'product' && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '0.95rem' }}>Product-Wise Purchase & Cost Report</h3>
                    <p style={{ fontSize: '0.725rem', color: '#64748b' }}>Breakdown of products purchased, brands, supplying vendors, quantities, and average rates</p>
                  </div>
                  <span className="badge badge-info">{productPurchasesReport.length} Products</span>
                </div>
                <div className="table-responsive">
                  <table className="table" style={{ width: '100%', minWidth: '780px' }}>
                    <thead>
                      <tr>
                        <th>Product Name</th>
                        <th>Brand</th>
                        <th>Suppliers (Kis se liya)</th>
                        <th style={{ textAlign: 'center' }}>Total Qty</th>
                        <th style={{ textAlign: 'right' }}>Avg Unit Rate</th>
                        <th style={{ textAlign: 'right' }}>Total Cost Spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productPurchasesReport.length === 0 ? (
                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No product procurement records found for this period.</td></tr>
                      ) : (
                        productPurchasesReport.map((p, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 700, color: '#0f172a' }}>{p.product_name}</td>
                            <td>
                              <span style={{ fontSize: '0.725rem', color: '#0284c7', background: '#f0f9ff', padding: '1px 5px', borderRadius: '3px', border: '1px solid #bae6fd' }}>
                                {p.brand || 'Frozen'}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.75rem', color: '#475569' }}>
                              {p.suppliers || '-'}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 700, color: '#0284c7' }}>
                              {Number(p.total_quantity || 0).toLocaleString()}
                            </td>
                            <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                              {formatPKR(p.avg_rate || 0)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                              {formatPKR(p.total_amount || 0)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 7. PRODUCT-WISE SALES REPORT */}
        {activeReport === 'product-sales' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="grid grid-cols-4">
              <div className="card" style={{ borderLeft: '4px solid #0284c7' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>TOTAL SALES REVENUE</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7', marginTop: '0.25rem' }}>
                  {formatPKR(productSalesReport?.summary?.total_revenue || 0)}
                </div>
              </div>
              <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>GROSS PROFIT EARNED</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
                  {formatPKR(productSalesReport?.summary?.total_profit || 0)}
                </div>
              </div>
              <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>TOTAL UNITS DISPATCHED</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.25rem' }}>
                  {productSalesReport?.summary?.total_units || 0}
                </div>
              </div>
              <div className="card" style={{ borderLeft: '4px solid #8b5cf6' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>ACTIVE PRODUCTS SOLD</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#8b5cf6', marginTop: '0.25rem' }}>
                  {productSalesReport?.summary?.product_count || 0} items
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '1rem' }}>Product-Wise Sales & Margin Breakdown</h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Ranking of sold items by gross revenue contribution.</p>
              </div>
              <div className="table-responsive">
                <table className="table" style={{ width: '100%', minWidth: '760px' }}>
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'center' }}>Units Sold</th>
                      <th style={{ textAlign: 'right' }}>Avg Sale Rate</th>
                      <th style={{ textAlign: 'right' }}>Total Revenue</th>
                      <th style={{ textAlign: 'right' }}>Cost of Goods</th>
                      <th style={{ textAlign: 'right' }}>Gross Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!productSalesReport?.report?.length ? (
                      <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No product sales recorded in date range.</td></tr>
                    ) : (
                      productSalesReport.report.map((r, idx) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600 }}>
                            <div>{r.name}</div>
                            <div className="mono" style={{ fontSize: '0.7rem', color: '#64748b' }}>{r.sku}</div>
                          </td>
                          <td>{r.category_name || '-'}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.total_qty_sold} {r.unit}</td>
                          <td style={{ textAlign: 'right' }}>{formatPKR(r.avg_sale_rate)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>{formatPKR(r.total_revenue)}</td>
                          <td style={{ textAlign: 'right', color: '#64748b' }}>{formatPKR(r.total_cost)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{formatPKR(r.total_profit)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 8. STOCK MOVEMENTS AUDIT LEDGER (Compact 56px Rows + Details Side Panel) */}
        {activeReport === 'movements' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
            <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: 700 }}>Master Stock Movement Audit Trail</h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>Traceable history of all restocks, sales deductions, returns, and damage adjustments.</p>
            </div>
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', minWidth: '700px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={{ height: '42px', padding: '0 16px', fontSize: '12px' }}>Date & Time</th>
                    <th style={{ height: '42px', padding: '0 16px', fontSize: '12px' }}>Product</th>
                    <th style={{ height: '42px', padding: '0 16px', fontSize: '12px' }}>Type</th>
                    <th style={{ height: '42px', padding: '0 16px', fontSize: '12px', textAlign: 'center' }}>Change</th>
                    <th style={{ height: '42px', padding: '0 16px', fontSize: '12px', textAlign: 'center' }}>Balance</th>
                    <th style={{ height: '42px', padding: '0 16px', fontSize: '12px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {!movementsReport?.length ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No stock movements recorded in date range.</td></tr>
                  ) : (
                    movementsReport.map(m => {
                      const isPositive = m.quantity_delta > 0;
                      const dateObj = new Date(m.created_at);
                      const dateStr = !isNaN(dateObj.getTime())
                        ? `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`
                        : m.created_at;
                      const timeStr = !isNaN(dateObj.getTime())
                        ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '';

                      // Type pill style
                      const typeUpper = (m.type || '').toUpperCase();
                      let typePillStyle = { background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' };
                      if (typeUpper.includes('PURCHASE')) {
                        typePillStyle = { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' };
                      } else if (typeUpper.includes('SALE')) {
                        typePillStyle = { background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' };
                      } else if (typeUpper.includes('ADJUST')) {
                        typePillStyle = { background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' };
                      } else if (typeUpper.includes('RETURN')) {
                        typePillStyle = { background: '#FAF5FF', color: '#6B21A8', border: '1px solid #E9D5FF' };
                      }

                      return (
                        <tr key={m.id} style={{ height: '56px', maxHeight: '56px' }}>
                          {/* COLUMN 1: Date & Time */}
                          <td style={{ padding: '8px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
                              {dateStr}
                            </div>
                            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                              {timeStr}
                            </div>
                          </td>

                          {/* COLUMN 2: Product */}
                          <td style={{ padding: '8px 16px', verticalAlign: 'middle' }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', lineHeight: 1.25, maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {m.product_name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px', fontFamily: 'monospace' }}>
                              {m.sku}
                            </div>
                          </td>

                          {/* COLUMN 3: Type (pill badge only) */}
                          <td style={{ padding: '8px 16px', verticalAlign: 'middle' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 9px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                                ...typePillStyle
                              }}
                            >
                              {typeUpper}
                            </span>
                          </td>

                          {/* COLUMN 4: Change (Delta) */}
                          <td style={{ padding: '8px 16px', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                fontSize: '14px',
                                fontWeight: 700,
                                color: isPositive ? '#10B981' : '#EF4444'
                              }}
                            >
                              {isPositive ? `+${m.quantity_delta}` : m.quantity_delta} {m.unit || 'pkt'}
                            </span>
                          </td>

                          {/* COLUMN 5: Balance After */}
                          <td style={{ padding: '8px 16px', verticalAlign: 'middle', textAlign: 'center', fontSize: '13px', color: '#4B5563', fontWeight: 600 }}>
                            {m.balance_after}
                          </td>

                          {/* COLUMN 6: Action ("View →" button) */}
                          <td style={{ padding: '8px 16px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedMovement(m)}
                              style={{
                                height: '30px',
                                padding: '0 10px',
                                borderRadius: '6px',
                                border: '1px solid #E5E7EB',
                                background: '#FFFFFF',
                                color: '#0F766E',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#F0FDFA';
                                e.currentTarget.style.borderColor = '#0F766E';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#FFFFFF';
                                e.currentTarget.style.borderColor = '#E5E7EB';
                              }}
                            >
                              <span>View</span>
                              <ArrowRight size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* DETAILS SIDE PANEL (Drawer) */}
            {selectedMovement && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(3px)',
                  zIndex: 1200,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  animation: 'fadeIn 0.15s ease'
                }}
                onClick={() => setSelectedMovement(null)}
              >
                <div
                  style={{
                    width: '420px',
                    maxWidth: '90vw',
                    height: '100%',
                    background: '#FFFFFF',
                    boxShadow: '-8px 0 28px rgba(0,0,0,0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'slideInRight 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Panel Header */}
                  <div
                    style={{
                      padding: '20px 24px',
                      borderBottom: '1px solid #F3F4F6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                        Movement Details
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B7280' }}>
                        Audit trail log #{selectedMovement.id}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMovement(null)}
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#F4F6F9',
                        color: '#6B7280',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Panel Body */}
                  <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                      <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 }}>Product</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginTop: '2px' }}>{selectedMovement.product_name}</div>
                      <div style={{ fontSize: '12px', color: '#0F766E', fontFamily: 'monospace', marginTop: '2px' }}>SKU: {selectedMovement.sku}</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>Movement Type</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', marginTop: '4px', textTransform: 'uppercase' }}>
                          {selectedMovement.type}
                        </div>
                      </div>

                      <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>Quantity Delta</div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: selectedMovement.quantity_delta > 0 ? '#10B981' : '#EF4444', marginTop: '4px' }}>
                          {selectedMovement.quantity_delta > 0 ? `+${selectedMovement.quantity_delta}` : selectedMovement.quantity_delta} {selectedMovement.unit}
                        </div>
                      </div>
                    </div>

                    <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>Stock Balance</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{(selectedMovement.balance_after || 0) - (selectedMovement.quantity_delta || 0)}</span>
                        <ArrowRight size={14} color="#9CA3AF" />
                        <span style={{ color: '#0F766E' }}>{selectedMovement.balance_after} {selectedMovement.unit}</span>
                      </div>
                    </div>

                    <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>Batch / Lot Number</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginTop: '4px', fontFamily: 'monospace' }}>
                        {selectedMovement.batch_no || 'Standard Stock (No Lot)'}
                      </div>
                    </div>

                    <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>Reference / Reason</div>
                      <div style={{ fontSize: '13px', color: '#374151', marginTop: '4px', lineHeight: 1.5 }}>
                        {selectedMovement.reason || 'No description provided'}
                      </div>
                    </div>

                    <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>Date, Time & Staff</div>
                      <div style={{ fontSize: '13px', color: '#111827', fontWeight: 600, marginTop: '4px' }}>
                        {formatDateTime(selectedMovement.created_at)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                        Logged by: <strong>{selectedMovement.user_name || 'Staff User'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Panel Footer */}
                  <div style={{ padding: '16px 24px', borderTop: '1px solid #F3F4F6', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedMovement(null)}
                      style={{
                        height: '38px',
                        padding: '0 20px',
                        borderRadius: '8px',
                        border: '1px solid #E5E7EB',
                        background: '#FFFFFF',
                        color: '#374151',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Close Details
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

          <ReportPrintFooter shopName={settings.shop_name || 'Latif Traders'} />
        </div>
      </div>
    </div>
  );
}

export default function Reports({ initialReport }) {
  return (
    <ErrorBoundary fallbackTitle="Reports Page Error">
      <ReportsContent initialReport={initialReport} />
    </ErrorBoundary>
  );
}
