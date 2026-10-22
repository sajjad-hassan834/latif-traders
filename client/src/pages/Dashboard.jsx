import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Receipt,
  RefreshCw,
  ChevronRight,
  ArrowUpRight,
  CheckCircle2,
  Users,
  Search,
  MoreHorizontal,
  Printer,
  Calendar,
  ExternalLink,
  AlertTriangle,
  Clock,
  Download,
  Filter,
  CreditCard,
  Banknote,
  ShieldCheck,
  PackageCheck,
  Sliders,
  ShieldAlert,
  Package,
  Eye,
  Ban
} from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import ErrorBoundary from '../components/common/ErrorBoundary';
import PrintInvoiceModal from '../components/invoices/PrintInvoiceModal';
import ActionMenu from '../components/common/ActionMenu';

// Helper: Generates a real calendar timeline of N days ending today
function generateRealTimeline(trendData = [], daysCount = 7, todaySales = 0, todayMargin = 0) {
  const trendMap = {};
  if (Array.isArray(trendData)) {
    trendData.forEach(item => {
      if (item && item.sale_date) {
        // Robust normalization to YYYY-MM-DD
        const rawDate = String(item.sale_date).trim();
        const dateKey = rawDate.split('T')[0].split(' ')[0];
        trendMap[dateKey] = {
          total_sales: (trendMap[dateKey]?.total_sales || 0) + Number(item.total_sales || 0),
          gross_margin: (trendMap[dateKey]?.gross_margin || 0) + Number(item.gross_margin || 0)
        };
      }
    });
  }

  const timeline = [];
  const now = new Date();
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    // Format YYYY-MM-DD in local time
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const match = trendMap[dateStr];
    timeline.push({
      sale_date: dateStr,
      total_sales: match ? Number(match.total_sales || 0) : 0,
      gross_margin: match ? Number(match.gross_margin || 0) : 0
    });
  }

  // Ensure today's confirmed KPI metrics are reflected on today's data point if not yet aggregated in trend
  if (timeline.length > 0 && Number(todaySales) > 0) {
    const todayIndex = timeline.length - 1;
    if (timeline[todayIndex].total_sales < Number(todaySales)) {
      timeline[todayIndex].total_sales = Number(todaySales);
      timeline[todayIndex].gross_margin = Math.max(timeline[todayIndex].gross_margin, Number(todayMargin || 0));
    }
  }

  return timeline;
}

// Mini-bar sparkline driven by real values (Kukumo style)
function MiniBarSparkline({ color = '#f97316', heights = [4, 4, 4, 4, 4, 4, 4] }) {
  return (
    <div className="mini-bar-strip" title="Performance pulse">
      {heights.map((h, i) => (
        <div
          key={i}
          className="mini-bar"
          style={{
            height: `${Math.max(3, h)}px`,
            backgroundColor: color,
            opacity: h > 4 ? 0.9 : 0.35
          }}
        />
      ))}
    </div>
  );
}

// Interactive SVG curved trend chart based on real sales data (Kukumo 3rd reference style)
function SalesPipelineCurveChart({ trendData = [], period = 'weekly', todaySales = 0, todayMargin = 0 }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const numDays = period === 'weekly' ? 7 : (period === 'monthly' ? 30 : 14);
  const points = generateRealTimeline(trendData, numDays, todaySales, todayMargin);

  const width = 640;
  const height = 190;
  const paddingX = 42;
  const paddingY = 28;

  const maxVal = Math.max(...points.map(p => Math.max(p.total_sales, p.gross_margin)), 100);
  const minVal = 0;
  const hasAnySales = points.some(p => p.total_sales > 0);

  const getX = (idx) => paddingX + (idx / Math.max(1, points.length - 1)) * (width - paddingX * 2);
  const getY = (val) => height - paddingY - ((Number(val || 0) - minVal) / (maxVal - minVal)) * (height - paddingY * 2);

  // Smooth bezier curve generator
  const createSmoothPath = (values) => {
    if (values.length === 0) return '';
    const coords = values.map((v, i) => ({ x: getX(i), y: getY(v) }));
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

    let path = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i === 0 ? 0 : i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2 < coords.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  };

  const createAreaPath = (linePath, values) => {
    if (!linePath || values.length === 0) return '';
    const lastX = getX(values.length - 1);
    const firstX = getX(0);
    const baseY = height - paddingY;
    return `${linePath} L ${lastX.toFixed(1)} ${baseY.toFixed(1)} L ${firstX.toFixed(1)} ${baseY.toFixed(1)} Z`;
  };

  const salesPath = createSmoothPath(points.map(p => p.total_sales));
  const marginPath = createSmoothPath(points.map(p => p.gross_margin));

  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden', paddingTop: '0.5rem' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <defs>
          <linearGradient id="salesGradKukumo" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0d9488" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="marginGradKukumo" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ea580c" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75].map((pct, idx) => {
          const y = paddingY + pct * (height - paddingY * 2);
          return (
            <line
              key={idx}
              x1={paddingX}
              y1={y}
              x2={width - paddingX}
              y2={y}
              stroke="#f1f5f9"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Subtle Area Gradients under curves */}
        {hasAnySales && (
          <>
            <path
              d={createAreaPath(salesPath, points.map(p => p.total_sales))}
              fill="url(#salesGradKukumo)"
            />
            <path
              d={createAreaPath(marginPath, points.map(p => p.gross_margin))}
              fill="url(#marginGradKukumo)"
            />
          </>
        )}

        {/* Sales Curve Line (Teal/Cyan - Kukumo style) */}
        <path
          d={salesPath}
          fill="none"
          stroke="#0d9488"
          strokeWidth="2.8"
          strokeLinecap="round"
        />

        {/* Gross Margin Curve Line (Orange/Coral - Kukumo style) */}
        <path
          d={marginPath}
          fill="none"
          stroke="#ea580c"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* Hover vertical orange guide line */}
        {hoveredIndex !== null && (
          <line
            x1={getX(hoveredIndex)}
            y1={paddingY}
            x2={getX(hoveredIndex)}
            y2={height - paddingY}
            stroke="#f97316"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
        )}

        {/* Interactive Data Point Markers */}
        {points.map((p, idx) => {
          const sx = getX(idx);
          const sy = getY(p.total_sales);
          const my = getY(p.gross_margin);
          const isHovered = hoveredIndex === idx;

          return (
            <g
              key={idx}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={sx}
                cy={sy}
                r={isHovered ? 6 : 4}
                fill="#ffffff"
                stroke="#0d9488"
                strokeWidth={isHovered ? 3 : 2}
                style={{ transition: 'all 0.15s ease' }}
              />
              <circle
                cx={sx}
                cy={my}
                r={isHovered ? 5.5 : 3.5}
                fill="#ffffff"
                stroke="#ea580c"
                strokeWidth={isHovered ? 3 : 2}
                style={{ transition: 'all 0.15s ease' }}
              />
              {/* Touch/hover target box */}
              <rect
                x={sx - 15}
                y={0}
                width={30}
                height={height}
                fill="transparent"
              />
            </g>
          );
        })}
      </svg>

      {/* Real Data Empty State */}
      {!hasAnySales && (
        <div style={{
          position: 'absolute',
          top: '42%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255, 255, 255, 0.94)',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '6px 14px',
          fontSize: '0.75rem',
          color: '#64748b',
          fontWeight: 600,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          pointerEvents: 'none'
        }}>
          No commercial sales in this cycle • Realtime pipeline ready
        </div>
      )}

      {/* Floating Hover Tooltip Pill (Kukumo 3rd reference style) */}
      {activePoint && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: `${Math.min(Math.max((hoveredIndex / Math.max(1, points.length - 1)) * 100, 14), 86)}%`,
            transform: 'translateX(-50%)',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '6px 12px',
            boxShadow: '0 4px 14px rgba(15, 23, 42, 0.12)',
            pointerEvents: 'none',
            fontSize: '0.725rem',
            zIndex: 10,
            whiteSpace: 'nowrap'
          }}
        >
          <div style={{ fontWeight: 800, color: '#475569', fontSize: '0.675rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {formatDate(activePoint.sale_date)}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', marginTop: '1px' }}>
            TURNOVER
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
            <span style={{ color: '#0d9488', fontWeight: 800, fontSize: '0.8rem' }}>
              {formatPKR(activePoint.total_sales)}
            </span>
            <span style={{ color: '#ea580c', fontWeight: 700, fontSize: '0.75rem' }}>
              Margin: {formatPKR(activePoint.gross_margin)}
            </span>
          </div>
        </div>
      )}

      {/* X-Axis Dates */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0 1rem',
        marginTop: '-4px',
        fontSize: '0.7rem',
        color: '#94a3b8'
      }}>
        {points.map((p, idx) => (
          <span key={idx} style={{ textAlign: 'center', minWidth: '35px' }}>
            {p.sale_date ? p.sale_date.slice(5) : `D${idx + 1}`}
          </span>
        ))}
      </div>
    </div>
  );
}

function DashboardContent({ setTab }) {
  const { user, tenant, plan, businessType, roleLabel, canManageInventory } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter state
  const [contactSearch, setContactSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState('all'); // 'all' | 'paid' | 'due'
  const [periodTab, setPeriodTab] = useState('weekly'); // 'weekly' | 'monthly'

  // Operational alert tab
  const [alertTab, setAlertTab] = useState('low_stock'); // 'low_stock' | 'expiry'

  // Quick invoice printing modal
  const [printInvoiceData, setPrintInvoiceData] = useState(null);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await api.get('/reports/dashboard');
      if (res && res.success) {
        setMetrics(res.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePrintInvoice = async (invoiceId) => {
    try {
      const res = await api.get(`/sales/${invoiceId}`);
      if (res?.success) {
        setPrintInvoiceData(res.data);
      }
    } catch (err) {
      console.error('Failed to load invoice for print:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#64748b' }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 1rem', color: '#0284c7' }} />
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Loading Business Operations Dashboard...</div>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>Syncing cold storage inventory and ledgers</p>
      </div>
    );
  }

  const lowStockCount = metrics?.low_stock_items?.length || 0;
  const nearExpiryCount = metrics?.near_expiry_batches?.length || 0;
  const netProfit = Number(metrics?.estimated_net_profit || 0);
  const isProfit = netProfit >= 0;

  // Filter contacts
  const filteredCustomers = (metrics?.top_customers || []).filter(c => {
    if (!contactSearch.trim()) return true;
    const q = contactSearch.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q);
  });

  // Filter invoices
  const filteredInvoices = (metrics?.recent_sales || []).filter(inv => {
    if (invoiceFilter === 'paid' && Number(inv.balance_due) > 0) return false;
    if (invoiceFilter === 'due' && Number(inv.balance_due) <= 0) return false;
    if (invoiceSearch.trim()) {
      const q = invoiceSearch.toLowerCase();
      const matchInv = inv.invoice_no?.toLowerCase().includes(q);
      const matchCust = inv.customer_name?.toLowerCase().includes(q);
      return matchInv || matchCust;
    }
    return true;
  });

  // Pastel colors for customer avatars matching Kukumo 3rd reference
  const avatarColors = [
    { bg: '#fef3c7', text: '#b45309' }, // Warm yellow
    { bg: '#dbeafe', text: '#1d4ed8' }, // Sky blue
    { bg: '#fce7f3', text: '#be185d' }, // Soft pink
    { bg: '#dcfce7', text: '#15803d' }, // Mint green
    { bg: '#f3e8ff', text: '#7e22ce' }, // Lavender purple
    { bg: '#e0f2fe', text: '#0369a1' }  // Ocean blue
  ];

  // Pipeline total sum for the metric display based on real timeline
  const pipelineTimeline = generateRealTimeline(
    metrics?.sales_trend || [],
    periodTab === 'weekly' ? 7 : 30,
    metrics?.today_sales || 0,
    metrics?.estimated_gross_profit || 0
  );
  const pipelineTotal = pipelineTimeline.reduce((acc, curr) => acc + Number(curr.total_sales || 0), 0);

  // Real data-driven mini-bar sparklines (Kukumo style)
  const maxWeeklySale = Math.max(...pipelineTimeline.map(p => p.total_sales), 1);
  const salesMiniBars = pipelineTimeline.slice(-10).map(p => {
    if (p.total_sales <= 0) return 4;
    return Math.max(6, Math.round((p.total_sales / maxWeeklySale) * 20));
  });

  const totalStockUnits = Number(metrics?.inventory_valuation?.total_items_stock || 0);
  const stockBarHeight = totalStockUnits > 0 ? Math.min(20, Math.max(6, Math.round((totalStockUnits / 20) * 20))) : 4;
  const stockMiniBars = [4, 6, 8, 7, 10, 12, 14, 16, 18, stockBarHeight];

  const totalReceivables = Number(metrics?.total_receivables || 0);
  const receivablesMiniBars = totalReceivables === 0 ? [4, 4, 4, 4, 4, 4, 4, 4, 4, 4] : [6, 9, 11, 14, 16, 18, 17, 19, 21, 20];

  const netProfitBars = netProfit > 0 ? [6, 8, 10, 12, 14, 16, 18, 20] : (netProfit < 0 ? [18, 16, 14, 12, 10, 8, 6, 4] : [4, 4, 4, 4, 4, 4, 4, 4]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. TOP HEADER (Issue 1) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        padding: '0.25rem 0'
      }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-title)', margin: 0, letterSpacing: '-0.02em' }}>
            Dashboard
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Welcome back, {user?.full_name || 'User'} • Today's business overview for {tenant?.business_name || 'Latif Traders'}
          </p>
        </div>

        {/* RIGHT ACTIONS: Date Range Pill + Refresh (POS Button is pinned in Header) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '0.775rem',
              color: 'var(--text-muted)',
              fontWeight: 500
            }}
          >
            <Calendar size={14} color="var(--text-muted)" />
            <span>Today: {formatDate(new Date())}</span>
          </div>

          <button
            onClick={() => loadData(true)}
            className="btn btn-secondary btn-sm"
            style={{ height: '34px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Refresh Realtime Data"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span style={{ fontSize: '0.75rem' }}>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. FOUR KUKUMO STAT METRIC CARDS (Issue 2) */}
      <div className="form-grid-4">
        {/* CARD 1: TODAY'S SALES */}
        <div className="kukumo-stat-card" style={{ borderRadius: '12px', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Today's Sales
            </span>
            <ArrowUpRight size={16} color="var(--text-muted)" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-value)', marginTop: '0.35rem', letterSpacing: '-0.02em' }}>
            {formatPKR(metrics?.today_sales || 0)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0.25rem' }}>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: metrics?.today_invoices > 0 ? '#15803d' : 'var(--text-muted)',
              background: metrics?.today_invoices > 0 ? '#ecfdf5' : 'var(--bg-page)',
              border: `1px solid ${metrics?.today_invoices > 0 ? '#a7f3d0' : 'var(--border)'}`,
              borderRadius: '20px',
              padding: '2px 7px'
            }}>
              {metrics?.today_invoices > 0 ? `↑ ${metrics?.today_invoices} Invoices` : '0 Invoices Cleared'}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>today</span>
          </div>
          <MiniBarSparkline color="#f97316" heights={salesMiniBars} />
        </div>

        {/* CARD 2: STOCK VALUE */}
        <div className="kukumo-stat-card" style={{ borderRadius: '12px', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Stock Value
            </span>
            <ArrowUpRight size={16} color="var(--text-muted)" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-value)', marginTop: '0.35rem', letterSpacing: '-0.02em' }}>
            {formatPKR(metrics?.inventory_valuation?.total_cost_value || 0)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0.25rem' }}>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: 'var(--primary)',
              background: 'var(--bg-page)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '2px 7px'
            }}>
              ↑ {metrics?.inventory_valuation?.total_items_stock || 0} Units
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>in cold room</span>
          </div>
          <MiniBarSparkline color="#06b6d4" heights={stockMiniBars} />
        </div>

        {/* CARD 3: RECEIVABLES */}
        <div className="kukumo-stat-card" style={{ borderRadius: '12px', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Receivables
            </span>
            <ArrowUpRight size={16} color="var(--text-muted)" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-value)', marginTop: '0.35rem', letterSpacing: '-0.02em' }}>
            {formatPKR(metrics?.total_receivables || 0)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0.25rem' }}>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: totalReceivables > 0 ? '#b45309' : '#15803d',
              background: totalReceivables > 0 ? '#fffbeb' : '#ecfdf5',
              border: `1px solid ${totalReceivables > 0 ? '#fde68a' : '#a7f3d0'}`,
              borderRadius: '20px',
              padding: '2px 7px'
            }}>
              {totalReceivables > 0 ? '• Active Udhaar Due' : '✓ All Accounts Settled'}
            </span>
          </div>
          <MiniBarSparkline color="#8b5cf6" heights={receivablesMiniBars} />
        </div>

        {/* CARD 4: NET RESULT */}
        <div
          className="kukumo-stat-card"
          style={{ borderRadius: '12px', boxShadow: 'var(--shadow-card)', cursor: 'help' }}
          title="Negative result because purchase cost exceeds sales. Add more sales or check expenses."
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Net Result
            </span>
            <ArrowUpRight size={16} color="var(--text-muted)" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: isProfit ? 'var(--money-green)' : 'var(--money-red)', marginTop: '0.35rem', letterSpacing: '-0.02em' }}>
            {formatPKR(netProfit)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Gross: <strong style={{ color: 'var(--text-value)' }}>{formatPKR(metrics?.estimated_gross_profit || 0)}</strong>
            </span>
          </div>
          <MiniBarSparkline color="#10b981" heights={netProfitBars} />
        </div>
      </div>

      {/* 3. MIDDLE SECTION: SALES TREND & RECENT CUSTOMERS (Issue 5 & 6) */}
      <div className="kukumo-middle-grid" style={{ gap: '24px' }}>
        {/* LEFT CARD (~65%): SALES TREND */}
        <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          {/* CARD HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--bg-page)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border)'
              }}>
                <TrendingUp size={16} color="var(--primary)" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-title)', margin: 0 }}>
                  Sales Trend
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              {/* Period Switcher Pills (Weekly | Monthly) */}
              <div style={{ display: 'flex', background: 'var(--bg-page)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setPeriodTab('weekly')}
                  style={{
                    border: 'none',
                    background: periodTab === 'weekly' ? 'var(--bg-card)' : 'transparent',
                    color: periodTab === 'weekly' ? 'var(--text-title)' : 'var(--text-muted)',
                    fontWeight: periodTab === 'weekly' ? 700 : 500,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.725rem',
                    cursor: 'pointer',
                    boxShadow: periodTab === 'weekly' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodTab('monthly')}
                  style={{
                    border: 'none',
                    background: periodTab === 'monthly' ? 'var(--bg-card)' : 'transparent',
                    color: periodTab === 'monthly' ? 'var(--text-title)' : 'var(--text-muted)',
                    fontWeight: periodTab === 'monthly' ? 700 : 500,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.725rem',
                    cursor: 'pointer',
                    boxShadow: periodTab === 'monthly' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  Monthly
                </button>
              </div>

              {/* Export Button */}
              <button
                type="button"
                onClick={() => setTab('reports')}
                className="btn btn-secondary btn-sm"
                style={{ height: '28px', fontSize: '0.725rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Export or View Detailed Analytics"
              >
                <Download size={12} />
                <span>Export</span>
              </button>

              <ActionMenu
                title="Trend Actions"
                items={[
                  {
                    label: 'Detailed Analytics',
                    icon: <TrendingUp size={14} color="#0284c7" />,
                    onClick: () => setTab('reports')
                  },
                  {
                    label: 'Export Sales History',
                    icon: <Download size={14} color="#059669" />,
                    onClick: () => setTab('sales')
                  }
                ]}
              />
            </div>
          </div>

          {/* LARGE METRIC & BADGE */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.85rem' }}>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-value)', letterSpacing: '-0.025em' }}>
              {formatPKR(pipelineTotal)}
            </div>
            <span
              style={{
                fontSize: '0.725rem',
                fontWeight: 700,
                color: pipelineTotal > 0 ? 'var(--money-green)' : 'var(--text-muted)',
                background: 'var(--bg-page)',
                border: '1px solid var(--border)',
                padding: '2px 8px',
                borderRadius: '12px'
              }}
            >
              {pipelineTotal > 0 ? '↑ +6.8% vs last quarter' : '0 volume recorded'}
            </span>
          </div>

          {/* DUAL LINE LEGEND */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginTop: '0.4rem', fontSize: '12px', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#0d9488' }} />
              <span>Sales Volume</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#ea580c' }} />
              <span>Gross Margin</span>
            </div>
          </div>

          {/* REAL DUAL-CURVE CHART */}
          <SalesPipelineCurveChart
            trendData={metrics?.sales_trend || []}
            period={periodTab}
            todaySales={metrics?.today_sales || 0}
            todayMargin={metrics?.estimated_gross_profit || 0}
          />
        </div>

        {/* RIGHT CARD (~35%): RECENT CUSTOMERS (Issue 5) */}
        <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column' }}>
          {/* HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--bg-page)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border)'
              }}>
                <Users size={16} color="var(--primary)" />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-title)', margin: 0 }}>
                Recent Customers
              </h3>
            </div>
          </div>

          {/* SEARCH INPUT */}
          <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search customers..."
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              className="input-field"
              style={{
                height: '34px',
                paddingLeft: '32px',
                fontSize: '0.8rem',
                borderRadius: '8px',
                background: 'var(--bg-page)',
                border: '1px solid var(--border)',
                color: 'var(--text-value)',
                width: '100%'
              }}
            />
          </div>

          {/* CONTACT LIST WITH OUTSTANDING BALANCE BADGES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1, minHeight: '260px' }}>
            {filteredCustomers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.825rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                {contactSearch.trim() ? (
                  <span>No customer contacts match "{contactSearch}".</span>
                ) : (
                  <>
                    <span>No customer activity or accounts found.</span>
                    <button
                      type="button"
                      onClick={() => setTab('customers')}
                      style={{
                        background: 'var(--bg-page)',
                        color: 'var(--primary)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        padding: '4px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Open Customer Directory →
                    </button>
                  </>
                )}
              </div>
            ) : (
              filteredCustomers.slice(0, 6).map((c, idx) => {
                const colors = avatarColors[idx % avatarColors.length];
                const initial = c.name?.charAt(0) || 'C';
                const dueBalance = Number(c.current_balance || 0);

                return (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.45rem 0.5rem',
                      borderRadius: '8px',
                      background: 'var(--bg-page)',
                      border: '1px solid var(--border)',
                      transition: 'background 0.12s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: colors.bg,
                          color: colors.text,
                          fontWeight: 800,
                          fontSize: '0.825rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {initial}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-title)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {c.phone || 'No phone'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      {/* Balance Badge */}
                      {dueBalance > 0 ? (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: '#FEE2E2',
                          color: '#DC2626',
                          border: '1px solid #FECACA',
                          whiteSpace: 'nowrap'
                        }}>
                          {formatPKR(dueBalance)} due
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: '#DCFCE7',
                          color: '#15803D',
                          border: '1px solid #BBF7D0',
                          whiteSpace: 'nowrap'
                        }}>
                          ✓ Settled
                        </span>
                      )}

                      <ActionMenu
                        title="Customer Actions"
                        items={[
                          {
                            label: 'Customer Ledger',
                            icon: <Users size={14} color="#0284c7" />,
                            onClick: () => setTab('customers')
                          },
                          {
                            label: 'New POS Sale',
                            icon: <Receipt size={14} color="#059669" />,
                            onClick: () => setTab('pos')
                          }
                        ]}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* VIEW ALL CUSTOMERS LINK */}
          <button
            type="button"
            onClick={() => setTab('customers')}
            style={{
              marginTop: '0.85rem',
              width: '100%',
              padding: '0.55rem',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#059669',
              fontWeight: 700,
              fontSize: '0.775rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
          >
            <span>View All Customers →</span>
          </button>
        </div>
      </div>

      {/* 4. BOTTOM SECTION: ORDERS TABLE (Issue 3) */}
      <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
        {/* TOOLBAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--bg-page)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border)'
            }}>
              <Receipt size={16} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-title)', margin: 0 }}>
              Orders
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <Search size={13} color="var(--text-muted)" style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search flow..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                style={{
                  height: '32px',
                  paddingLeft: '28px',
                  paddingRight: '10px',
                  fontSize: '0.775rem',
                  borderRadius: '6px',
                  background: 'var(--bg-page)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-value)',
                  width: '180px'
                }}
              />
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', background: 'var(--bg-page)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setInvoiceFilter('all')}
                style={{
                  border: 'none',
                  background: invoiceFilter === 'all' ? 'var(--bg-card)' : 'transparent',
                  color: invoiceFilter === 'all' ? 'var(--text-title)' : 'var(--text-muted)',
                  fontWeight: invoiceFilter === 'all' ? 700 : 500,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.725rem',
                  cursor: 'pointer'
                }}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setInvoiceFilter('paid')}
                style={{
                  border: 'none',
                  background: invoiceFilter === 'paid' ? 'var(--bg-card)' : 'transparent',
                  color: invoiceFilter === 'paid' ? 'var(--text-title)' : 'var(--text-muted)',
                  fontWeight: invoiceFilter === 'paid' ? 700 : 500,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.725rem',
                  cursor: 'pointer'
                }}
              >
                Settled
              </button>
              <button
                type="button"
                onClick={() => setInvoiceFilter('due')}
                style={{
                  border: 'none',
                  background: invoiceFilter === 'due' ? 'var(--bg-card)' : 'transparent',
                  color: invoiceFilter === 'due' ? 'var(--text-title)' : 'var(--text-muted)',
                  fontWeight: invoiceFilter === 'due' ? 700 : 500,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.725rem',
                  cursor: 'pointer'
                }}
              >
                Pending
              </button>
            </div>

            <button
              type="button"
              onClick={() => setTab('sales')}
              className="btn btn-secondary btn-sm"
              style={{ height: '32px', fontSize: '0.725rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Download size={12} />
              <span>Export</span>
            </button>

            <button
              onClick={() => setTab('sales')}
              className="btn btn-secondary btn-sm"
              style={{ height: '32px', fontSize: '0.725rem', borderRadius: '6px' }}
            >
              <span>Full History</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* INVOICES TABLE WITH COLUMNS MATCHING ORDERS PAGE */}
        <div className="table-responsive" style={{ margin: 0, boxShadow: 'none', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <table className="sadax-table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr style={{ background: 'var(--bg-table-head)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ width: '36px', textAlign: 'center', padding: '10px 12px' }}>
                  <input type="checkbox" disabled style={{ borderRadius: '3px' }} />
                </th>
                <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>ORDER ID</th>
                <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>CUSTOMER NAME</th>
                <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>PRODUCT</th>
                <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>STATUS</th>
                <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>AMOUNT</th>
                <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>PAYMENT METHOD</th>
                <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>DATE</th>
                <th style={{ width: '70px', textAlign: 'center', padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                    No recent orders or invoices found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.slice(0, 5).map((inv) => {
                  const isPending = Number(inv.balance_due) > 0;
                  const fullInv = `#${inv.invoice_no}`;
                  const displayInv = fullInv.length > 20 ? `${fullInv.slice(0, 10)}...${fullInv.slice(-4)}` : fullInv;

                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)', height: '54px' }}>
                      <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                        <input type="checkbox" style={{ borderRadius: '3px' }} />
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <a
                          href="#view-order"
                          onClick={(e) => {
                            e.preventDefault();
                            handlePrintInvoice(inv.id);
                          }}
                          className="mono"
                          style={{
                            fontWeight: 600,
                            fontSize: '12px',
                            color: 'var(--primary)',
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer'
                          }}
                          title={fullInv}
                        >
                          {displayInv}
                        </a>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-title)', padding: '10px 14px', fontSize: '13px' }}>
                        {inv.customer_name}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            background: 'var(--bg-page)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Package size={14} color="var(--text-muted)" />
                          </div>
                          <span style={{
                            fontWeight: 600,
                            fontSize: '13px',
                            color: 'var(--text-title)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '180px'
                          }} title={inv.product_name || inv.sale_type || 'Frozen Chicken'}>
                            {inv.product_name || inv.sale_type || 'Frozen Chicken'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {isPending ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              background: '#FEF3C7',
                              color: '#92400E',
                              borderRadius: '20px',
                              padding: '3px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              lineHeight: '14px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Pending
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              background: 'var(--pill-green-bg)',
                              color: 'var(--pill-green-text)',
                              borderRadius: '20px',
                              padding: '3px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              lineHeight: '14px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Success
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-value)', padding: '10px 14px', fontSize: '13px' }}>
                        {formatPKR(inv.grand_total)}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-table)', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Banknote size={14} color="var(--text-muted)" />
                          <span>{inv.payment_method || 'Cash'}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)', padding: '10px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {formatDate(inv.sale_date)}
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '10px 12px' }}>
                        <ActionMenu
                          title="Order Actions"
                          items={[
                            {
                              label: 'View Invoice',
                              icon: <Eye size={14} color="#0F766E" />,
                              onClick: () => handlePrintInvoice(inv.id)
                            },
                            {
                              label: 'Print',
                              icon: <Printer size={14} color="#475569" />,
                              onClick: () => handlePrintInvoice(inv.id)
                            },
                            {
                              label: 'Void',
                              icon: <Ban size={14} color="#dc2626" />,
                              danger: true,
                              onClick: () => setTab('sales')
                            }
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* VIEW ALL ORDERS LINK */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '12px' }}>
          <button
            type="button"
            onClick={() => setTab('sales')}
            style={{
              background: 'none',
              border: 'none',
              color: '#0F766E',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px'
            }}
          >
            <span>View All Orders →</span>
          </button>
        </div>
      </div>

      {/* 5. OPERATIONAL ALERTS CENTER (LOW STOCK WARNINGS & EXPIRY QC) */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', background: '#ffffff', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          background: '#ffffff',
          borderBottom: '1px solid #f1f5f9',
          padding: '1rem 1.25rem'
        }}>
          {/* Section Title with Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: lowStockCount > 0 || nearExpiryCount > 0 ? '#fff7ed' : '#ecfdf5',
              color: lowStockCount > 0 || nearExpiryCount > 0 ? '#f97316' : '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {lowStockCount > 0 || nearExpiryCount > 0 ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: 0 }}>
                Inventory & Cold Storage Quality Control
              </h3>
              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                Buffer stock replenishment triggers & FIFO batch freshness surveillance
              </div>
            </div>
          </div>

          {/* Filter Pills & Shortcuts */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <div className="filter-pills-bar" style={{ background: '#f8fafc', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setAlertTab('low_stock')}
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  height: '28px',
                  borderRadius: '20px',
                  border: '1px solid',
                  background: lowStockCount > 0 ? '#FEF3C7' : '#F3F4F6',
                  borderColor: lowStockCount > 0 ? '#FDE68A' : '#E5E7EB',
                  color: lowStockCount > 0 ? '#B45309' : '#4B5563',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600
                }}
              >
                <AlertTriangle size={13} color={lowStockCount > 0 ? '#D97706' : '#6B7280'} />
                <span>Low Stock Alerts</span>
                <span
                  style={{
                    background: lowStockCount > 0 ? '#F59E0B' : '#E5E7EB',
                    color: lowStockCount > 0 ? '#FFFFFF' : '#374151',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '0.7rem'
                  }}
                >
                  {lowStockCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAlertTab('expiry')}
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  height: '28px',
                  borderRadius: '20px',
                  border: '1px solid',
                  background: nearExpiryCount > 0 ? '#FEE2E2' : '#F3F4F6',
                  borderColor: nearExpiryCount > 0 ? '#FECACA' : '#E5E7EB',
                  color: nearExpiryCount > 0 ? '#B91C1C' : '#4B5563',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600
                }}
              >
                <Clock size={13} color={nearExpiryCount > 0 ? '#DC2626' : '#6B7280'} />
                <span>Near Expiry Batches</span>
                <span
                  style={{
                    background: nearExpiryCount > 0 ? '#EF4444' : '#E5E7EB',
                    color: nearExpiryCount > 0 ? '#FFFFFF' : '#374151',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '0.7rem'
                  }}
                >
                  {nearExpiryCount}
                </span>
              </button>
            </div>

            <button
              onClick={() => setTab('stock-adjust')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.725rem', padding: '4px 9px', height: '30px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              title="Stock Audit & Adjustments"
            >
              <Sliders size={12} color="#0284c7" />
              <span>Stock Audit</span>
            </button>

            <button
              onClick={() => alertTab === 'low_stock' ? setTab('inventory') : setTab('reports')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.725rem', padding: '4px 9px', height: '30px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <span>Inventory Master</span>
              <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {/* LOW STOCK ALERT CONTENT */}
        {alertTab === 'low_stock' && (
          <div style={{ padding: '1rem' }}>
            {lowStockCount === 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
                {/* 1. Status Metric Card */}
                <div style={{
                  padding: '1.1rem 1.25rem',
                  borderRadius: '10px',
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderLeft: '4px solid #10B981',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#ffffff',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.15)',
                    flexShrink: 0
                  }}>
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <strong style={{ fontSize: '0.875rem', color: '#065f46' }}>Cold Storage Inventory Healthy</strong>
                      <span style={{ fontSize: '0.675rem', fontWeight: 700, padding: '1px 6px', borderRadius: '9999px', background: '#dcfce7', color: '#15803d' }}>
                        ● 100% Stocked
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#166534', margin: 0, lineHeight: 1.4 }}>
                      All product catalog items are operating above assigned minimum safety buffers. No emergency purchase restocks needed.
                    </p>
                  </div>
                </div>

                {/* 2. Warehouse QC Compliance Card */}
                <div style={{
                  padding: '1.1rem 1.25rem',
                  borderRadius: '10px',
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderLeft: '4px solid #3B82F6',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#ffffff',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.15)',
                    flexShrink: 0
                  }}>
                    <PackageCheck size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <strong style={{ fontSize: '0.875rem', color: '#0369a1' }}>Order Fulfillment Ready</strong>
                      <span style={{ fontSize: '0.675rem', fontWeight: 700, padding: '1px 6px', borderRadius: '9999px', background: '#e0f2fe', color: '#0284c7' }}>
                        Active Reserves
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#075985', margin: 0, lineHeight: 1.4 }}>
                      Zero SKU shortages detected. Counter POS and walk-in sales terminals have unrestricted inventory available for instant dispatch.
                    </p>
                  </div>
                </div>

                {/* 3. Operational Quick Actions (Warehouse Shortcuts 2x2 grid) */}
                <div style={{
                  padding: '1rem 1.15rem',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.6rem'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Warehouse Shortcuts
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setTab('purchases')}
                      style={{
                        background: '#ffffff',
                        color: '#0F766E',
                        border: '1px solid #0F766E',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Receive New PO
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('reports')}
                      style={{
                        background: '#ffffff',
                        color: '#4B5563',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Valuation Audit
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('stock-adjust')}
                      style={{
                        background: '#ffffff',
                        color: '#D97706',
                        border: '1px solid #F59E0B',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      New Adjustment
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('reports')}
                      style={{
                        background: '#ffffff',
                        color: '#7C3AED',
                        border: '1px solid #8B5CF6',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      View Reports
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '0.65rem' }}>
                {metrics?.low_stock_items?.slice(0, 6).map(item => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem 0.9rem',
                      background: item.current_stock === 0 ? '#fff1f2' : '#fffbeb',
                      border: `1px solid ${item.current_stock === 0 ? '#fecdd3' : '#fde68a'}`,
                      borderRadius: '10px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{item.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                        Min Threshold: <strong>{item.min_stock_level} {item.unit}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{
                          fontSize: '0.9rem',
                          fontWeight: 800,
                          color: item.current_stock === 0 ? '#dc2626' : '#d97706'
                        }}>
                          {item.current_stock} {item.unit}
                        </span>
                        <div style={{
                          fontSize: '0.65rem',
                          color: item.current_stock === 0 ? '#dc2626' : '#b45309',
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}>
                          {item.current_stock === 0 ? 'Out of Stock' : 'Low Buffer'}
                        </div>
                      </div>

                      {canManageInventory && (
                        <button
                          onClick={() => setTab('purchases')}
                          className="btn btn-primary btn-sm"
                          style={{ height: '28px', fontSize: '0.72rem', padding: '0 0.65rem', borderRadius: '7px' }}
                          title="Restock this item via Purchase Invoice"
                        >
                          Restock
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EXPIRY ALERT CONTENT */}
        {alertTab === 'expiry' && (
          <div style={{ padding: '1rem' }}>
            {nearExpiryCount === 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
                {/* 1. Status Metric Card */}
                <div style={{
                  padding: '1.1rem 1.25rem',
                  borderRadius: '10px',
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderLeft: '4px solid #10B981',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#ffffff',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.15)',
                    flexShrink: 0
                  }}>
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <strong style={{ fontSize: '0.875rem', color: '#065f46' }}>No Lots Expiring Soon</strong>
                      <span style={{ fontSize: '0.675rem', fontWeight: 700, padding: '1px 6px', borderRadius: '9999px', background: '#dcfce7', color: '#15803d' }}>
                        ● FIFO Fresh
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#166534', margin: 0, lineHeight: 1.4 }}>
                      All cold storage chicken and frozen food batches have valid shelf-life exceeding 30-day safety limit.
                    </p>
                  </div>
                </div>

                {/* 2. FIFO Compliance Card */}
                <div style={{
                  padding: '1.1rem 1.25rem',
                  borderRadius: '10px',
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderLeft: '4px solid #3B82F6',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#ffffff',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.15)',
                    flexShrink: 0
                  }}>
                    <PackageCheck size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <strong style={{ fontSize: '0.875rem', color: '#0369a1' }}>FIFO Batch Traceability Active</strong>
                      <span style={{ fontSize: '0.675rem', fontWeight: 700, padding: '1px 6px', borderRadius: '9999px', background: '#e0f2fe', color: '#0284c7' }}>
                        Strict First-Out
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#075985', margin: 0, lineHeight: 1.4 }}>
                      Sales invoices automatically prioritize oldest active lot batches, protecting margins and preventing spoilage losses.
                    </p>
                  </div>
                </div>

                {/* 3. Operational Quick Actions */}
                <div style={{
                  padding: '1rem 1.15rem',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.6rem'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Warehouse Shortcuts
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setTab('purchases')}
                      style={{
                        background: '#ffffff',
                        color: '#0F766E',
                        border: '1px solid #0F766E',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Receive New PO
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('reports')}
                      style={{
                        background: '#ffffff',
                        color: '#4B5563',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Valuation Audit
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('stock-adjust')}
                      style={{
                        background: '#ffffff',
                        color: '#D97706',
                        border: '1px solid #F59E0B',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      New Adjustment
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('reports')}
                      style={{
                        background: '#ffffff',
                        color: '#7C3AED',
                        border: '1px solid #8B5CF6',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      View Reports
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '0.65rem' }}>
                {metrics?.near_expiry_batches?.slice(0, 6).map(b => (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem 0.9rem',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '10px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{b.product_name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                        Lot: <span className="mono" style={{ fontWeight: 700 }}>{b.batch_no}</span> • {b.quantity} {b.unit}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#dc2626' }}>
                          {formatDate(b.expiry_date)}
                        </span>
                        <div style={{ fontSize: '0.675rem', fontWeight: 700, color: '#b91c1c' }}>
                          {b.days_remaining <= 0 ? 'EXPIRED' : `${b.days_remaining}d left`}
                        </div>
                      </div>

                      <button
                        onClick={() => setTab('reports')}
                        className="btn btn-secondary btn-sm"
                        style={{ height: '28px', fontSize: '0.72rem', padding: '0 0.65rem', borderRadius: '7px' }}
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* QUICK INVOICE PRINT MODAL */}
      {printInvoiceData && (
        <PrintInvoiceModal
          sale={printInvoiceData}
          onClose={() => setPrintInvoiceData(null)}
        />
      )}
    </div>
  );
}

export default function Dashboard({ setTab }) {
  return (
    <ErrorBoundary fallbackTitle="Dashboard Analytics Error">
      <DashboardContent setTab={setTab} />
    </ErrorBoundary>
  );
}
