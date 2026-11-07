import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Search,
  Printer,
  Calendar,
  AlertTriangle,
  Clock,
  CreditCard,
  Banknote,
  Package,
  Plus,
  ShoppingCart,
  ArrowDownToLine,
  Wallet,
  DollarSign,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Building2,
  CheckCircle2,
  User,
  ShoppingBag,
  Sparkles
} from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import useTradeProfile from '../hooks/useTradeProfile';
import { useAuth } from '../context/AuthContext';
import ErrorBoundary from '../components/common/ErrorBoundary';
import PrintInvoiceModal from '../components/invoices/PrintInvoiceModal';
import CustomDatePicker from '../components/common/CustomDatePicker';

// Advanced Interactive Donut Chart with Progress Bars and Stat Details
function SvgDonutChart({ items = [], total = 0, centerLabel = 'Total', centerSubtext = '', size = 180, strokeWidth = 22 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const colorPalette = [
    { primary: '#10B981', gradient: ['#10B981', '#059669'], text: '#065F46', bg: '#DCFCE7' }, // Emerald
    { primary: '#0284C7', gradient: ['#38BDF8', '#0284C7'], text: '#075985', bg: '#E0F2FE' }, // Sky Blue
    { primary: '#F59E0B', gradient: ['#FBBF24', '#D97706'], text: '#92400E', bg: '#FEF3C7' }, // Amber
    { primary: '#8B5CF6', gradient: ['#A78BFA', '#7C3AED'], text: '#5B21B6', bg: '#EDE9FE' }, // Purple
    { primary: '#EC4899', gradient: ['#F472B6', '#DB2777'], text: '#9D174D', bg: '#FCE7F3' }  // Pink
  ];

  let accumulatedPercent = 0;
  const slices = (items || []).map((item, idx) => {
    const pct = Number(item.percentage || 0);
    const strokeDasharray = `${(pct / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += pct;
    const theme = colorPalette[idx % colorPalette.length];
    return {
      ...item,
      color: theme.primary,
      theme,
      strokeDasharray,
      strokeDashoffset,
      pct
    };
  });

  const activeSlice = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {/* SVG Ring */}
      <div style={{ position: 'relative', width: size, height: size, margin: '8px 0' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          {/* Subtle Outer Drop Shadow Filter */}
          <defs>
            {slices.map((slice, idx) => (
              <linearGradient key={`grad-${idx}`} id={`donut-grad-${idx}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={slice.theme.gradient[0]} />
                <stop offset="100%" stopColor={slice.theme.gradient[1]} />
              </linearGradient>
            ))}
          </defs>

          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="var(--border, #E2E8F0)"
            strokeWidth={strokeWidth}
            opacity="0.6"
          />

          {/* Slices */}
          {slices.map((slice, idx) => (
            <circle
              key={idx}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={`url(#donut-grad-${idx})`}
              strokeWidth={hoveredIdx === idx ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={slice.strokeDasharray}
              strokeDashoffset={slice.strokeDashoffset}
              strokeLinecap="round"
              style={{
                transition: 'stroke-width 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
                cursor: 'pointer',
                opacity: hoveredIdx === null || hoveredIdx === idx ? 1 : 0.35
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
        </svg>

        {/* Center Readout */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          padding: '10px',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {activeSlice ? (activeSlice.method || activeSlice.category) : centerLabel}
          </span>
          <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-title, #0F172A)', margin: '2px 0 0' }}>
            {activeSlice ? formatPKR(activeSlice.amount || activeSlice.value) : formatPKR(total)}
          </span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: activeSlice ? activeSlice.color : 'var(--text-muted)' }}>
            {activeSlice ? `${activeSlice.pct}% of total` : (centerSubtext || `${items.length} segments`)}
          </span>
        </div>
      </div>

      {/* Progress Bar Visual Strip */}
      <div style={{
        display: 'flex',
        height: '6px',
        width: '100%',
        borderRadius: '9999px',
        overflow: 'hidden',
        background: 'var(--border, #E2E8F0)',
        margin: '12px 0 16px'
      }}>
        {slices.map((slice, idx) => (
          <div
            key={idx}
            style={{
              width: `${slice.pct}%`,
              background: slice.color,
              transition: 'width 0.3s ease'
            }}
            title={`${slice.method || slice.category}: ${slice.pct}%`}
          />
        ))}
      </div>

      {/* Detailed Legend breakdown */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {slices.slice(0, 4).map((slice, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              padding: '6px 8px',
              borderRadius: '8px',
              background: hoveredIdx === idx ? 'var(--hover-bg, #F1F5F9)' : 'transparent',
              transition: 'background 0.15s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: slice.color,
                boxShadow: `0 0 6px ${slice.color}60`,
                display: 'inline-block'
              }} />
              <div>
                <span style={{ fontWeight: 700, color: 'var(--text-title, #0F172A)', textTransform: 'capitalize' }}>
                  {slice.method || slice.category}
                </span>
                {slice.count !== undefined && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                    ({slice.count} txns)
                  </span>
                )}
                {slice.quantity !== undefined && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                    ({slice.quantity} items)
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, color: 'var(--text-value, #0F172A)' }}>
                {formatPKR(slice.amount || slice.value)}
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '9999px',
                background: slice.theme.bg,
                color: slice.theme.text
              }}>
                {slice.pct}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Advanced Comparative Bar Chart (Sales vs Purchases) with Granular View (7D / 6M)
function SvgComparativeChart({ days = [], months = [], stats = {} }) {
  const [chartMode, setChartMode] = useState('7d'); // '7d' (Daily) | '6m' (Monthly)
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const dataSeries = chartMode === '7d' ? (days.length > 0 ? days : []) : (months.length > 0 ? months : []);

  const width = 520;
  const height = 210;
  const paddingX = 44;
  const paddingY = 28;

  const maxVal = Math.max(
    ...dataSeries.map(d => Math.max(Number(d.sales || 0), Number(d.purchases || 0))),
    100
  );

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;
  const step = dataSeries.length > 0 ? chartWidth / dataSeries.length : chartWidth;
  const barWidth = chartMode === '7d' ? 14 : 18;

  const hoveredItem = hoveredIdx !== null ? dataSeries[hoveredIdx] : null;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header controls & stats strip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        {/* Metric summary badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-title)' }}>Sales Inflow</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284C7' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-title)' }}>Purchases Outflow</span>
          </div>
        </div>

        {/* View Switcher: 7D vs 6M */}
        <div style={{
          display: 'flex',
          background: 'var(--hover-bg, #F1F5F9)',
          borderRadius: '8px',
          padding: '2px',
          border: '1px solid var(--border)'
        }}>
          <button
            type="button"
            onClick={() => { setChartMode('7d'); setHoveredIdx(null); }}
            style={{
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: 700,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              background: chartMode === '7d' ? '#F59E0B' : 'transparent',
              color: chartMode === '7d' ? '#1E1B18' : 'var(--text-muted)',
              transition: 'all 0.15s ease'
            }}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => { setChartMode('6m'); setHoveredIdx(null); }}
            style={{
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: 700,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              background: chartMode === '6m' ? '#F59E0B' : 'transparent',
              color: chartMode === '6m' ? '#1E1B18' : 'var(--text-muted)',
              transition: 'all 0.15s ease'
            }}
          >
            Last 6 Months
          </button>
        </div>
      </div>

      {/* KPI highlight pills row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        padding: '8px 12px',
        background: 'var(--hover-bg, #F8FAFC)',
        borderRadius: '10px',
        border: '1px solid var(--border)',
        marginBottom: '12px'
      }}>
        <div>
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Peak Day</span>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#F59E0B' }}>
            {stats.peak_val ? formatPKR(stats.peak_val) : 'Rs 0'}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{stats.peak_label || 'Today'}</span>
        </div>
        <div>
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Daily Average</span>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-title)' }}>
            {stats.daily_avg ? formatPKR(stats.daily_avg) : 'Rs 0'}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>7-day cadence</span>
        </div>
        <div>
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mode</span>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#10B981' }}>
            {chartMode === '7d' ? 'Granular Daily' : 'Monthly Agg'}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Interactive bars</span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', maxHeight: '220px' }}>
          <defs>
            <linearGradient id="amberGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = paddingY + chartHeight * (1 - pct);
            return (
              <g key={i}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="var(--border, #E2E8F0)"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fontWeight="600"
                  fill="var(--text-muted, #64748B)"
                >
                  {maxVal >= 1000 ? `${Math.round((maxVal * pct) / 1000)}k` : Math.round(maxVal * pct)}
                </text>
              </g>
            );
          })}

          {/* Dual Bars per point */}
          {dataSeries.map((d, idx) => {
            const groupCenter = paddingX + idx * step + step / 2;
            const sVal = Number(d.sales || 0);
            const pVal = Number(d.purchases || 0);

            const salesHeight = maxVal > 0 ? Math.max(sVal > 0 ? 6 : 2, (sVal / maxVal) * chartHeight) : 2;
            const purchasesHeight = maxVal > 0 ? Math.max(pVal > 0 ? 6 : 2, (pVal / maxVal) * chartHeight) : 2;

            const salesX = groupCenter - barWidth - 1;
            const salesY = paddingY + chartHeight - salesHeight;

            const purchasesX = groupCenter + 1;
            const purchasesY = paddingY + chartHeight - purchasesHeight;

            const isHovered = hoveredIdx === idx;
            const isToday = d.label === 'Today' || d.month === 'Nov';

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Highlight background on hover */}
                {isHovered && (
                  <rect
                    x={groupCenter - step / 2 + 2}
                    y={paddingY}
                    width={step - 4}
                    height={chartHeight}
                    fill="var(--hover-bg, #F1F5F9)"
                    rx="6"
                    opacity="0.75"
                  />
                )}

                {/* Sales Bar */}
                <rect
                  x={salesX}
                  y={salesY}
                  width={barWidth}
                  height={salesHeight}
                  rx="4"
                  fill="url(#amberGradient)"
                  opacity={hoveredIdx === null || isHovered ? 1 : 0.6}
                />

                {/* Purchases Bar */}
                <rect
                  x={purchasesX}
                  y={purchasesY}
                  width={barWidth}
                  height={purchasesHeight}
                  rx="4"
                  fill="url(#blueGradient)"
                  opacity={hoveredIdx === null || isHovered ? 1 : 0.6}
                />

                {/* Today Pulse Badge Indicator */}
                {isToday && sVal > 0 && (
                  <circle
                    cx={salesX + barWidth / 2}
                    cy={salesY - 6}
                    r="3.5"
                    fill="#F59E0B"
                  />
                )}

                {/* X Axis Label */}
                <text
                  x={groupCenter}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={isToday || isHovered ? 800 : 600}
                  fill={isToday ? '#F59E0B' : (isHovered ? 'var(--text-title)' : 'var(--text-muted)')}
                >
                  {d.label || d.month}
                </text>

                {/* Value tooltip tag */}
                {isHovered && (
                  <g>
                    <rect
                      x={groupCenter - 55}
                      y={Math.min(salesY, purchasesY) - 28}
                      width="110"
                      height="22"
                      rx="6"
                      fill="#0F172A"
                    />
                    <text
                      x={groupCenter}
                      y={Math.min(salesY, purchasesY) - 13}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="9"
                      fontWeight="800"
                    >
                      Sales: {formatPKR(sVal)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function DashboardContent({ setTab }) {
  const { user, tenant } = useAuth();
  const [period, setPeriod] = useState('today'); // 'today' | '7d' | '30d' | 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);

  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Operational alert subtab
  const [alertTab, setAlertTab] = useState('low_stock'); // 'low_stock' | 'near_expiry'

  // Quick invoice printing modal
  const [printInvoiceData, setPrintInvoiceData] = useState(null);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      let url = `/reports/dashboard/insights?period=${period}`;
      if (period === 'custom' && customStart && customEnd) {
        url += `&start_date=${customStart}&end_date=${customEnd}`;
      }

      const res = await api.get(url);
      if (res && res.success) {
        setInsights(res.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard insights:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [period]);

  const handlePrintInvoice = async (invoiceId) => {
    try {
      const res = await api.get(`/sales/${invoiceId}`);
      if (res?.success) {
        setPrintInvoiceData(res);
      }
    } catch (err) {
      console.error('Failed to load invoice for print:', err);
    }
  };

  const kpi = insights?.kpi || {
    sales: { total: 0, invoice_count: 0, delta_pct: 0, delta_direction: 'up' },
    receivables: { total: 0, customer_count: 0 },
    payables: { total: 0, supplier_count: 0, is_restricted: false },
    stock: { valuation: 0, retail_valuation: 0, total_items: 0, low_stock_count: 0 }
  };

  const periodLabels = {
    today: 'Today',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    custom: 'Custom Range'
  };

  const avatarColors = [
    { bg: '#FEF3C7', text: '#92400E' },
    { bg: '#DBEAFE', text: '#1E40AF' },
    { bg: '#FCE7F3', text: '#9D174D' },
    { bg: '#DCFCE7', text: '#166534' },
    { bg: '#F3E8FF', text: '#6B21A8' }
  ];

  if (loading && !insights) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#64748b' }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 1rem', color: '#F59E0B' }} />
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-title)' }}>
          Loading Operations Dashboard...
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Syncing business metrics and analytical charts
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingTop: '4px' }}>
      {/* 1. DARK NAVY HERO BAND */}
      <div className="dashboard-hero-band">
        <div className="dashboard-hero-top">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#F59E0B', background: 'rgba(245, 158, 11, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                Operational Control
              </span>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>•</span>
              <span style={{ fontSize: '13px', color: '#FFFFFF', fontWeight: 700 }}>{tenant?.business_name || 'My Store'}</span>
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#FFFFFF', margin: '8px 0 4px', letterSpacing: '-0.02em' }}>
              Welcome back, {user?.full_name || 'User'}
            </h1>
            <p style={{ fontSize: '13px', color: '#CBD5E1', margin: 0 }}>
              Showing performance overview for <span style={{ color: '#F59E0B', fontWeight: 700 }}>{periodLabels[period]}</span>
            </p>
          </div>

          {/* Right Header Controls: Period Pills + Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="dashboard-period-pills">
              {['today', '7d', '30d'].map((pKey) => (
                <button
                  key={pKey}
                  type="button"
                  onClick={() => setPeriod(pKey)}
                  className={`dashboard-period-btn ${period === pKey ? 'active' : ''}`}
                >
                  {pKey === 'today' ? 'Today' : (pKey === '7d' ? '7 Days' : '30 Days')}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowCustomModal(true)}
                className={`dashboard-period-btn ${period === 'custom' ? 'active' : ''}`}
              >
                Custom
              </button>
            </div>

            <button
              onClick={() => loadData(true)}
              style={{
                height: '34px',
                padding: '0 12px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 700
              }}
              title="Refresh Realtime Data"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Quick Action Toolbar inside Hero */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginTop: '22px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setTab && setTab('pos')}
            className="btn btn-primary"
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ShoppingCart size={15} />
            <span>Sale</span>
          </button>

          <button
            onClick={() => setTab && setTab('purchases')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ArrowDownToLine size={14} />
            <span>Purchase</span>
          </button>

          <button
            onClick={() => setTab && setTab('customers')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Users size={14} />
            <span>Customer</span>
          </button>

          <button
            onClick={() => setTab && setTab('expenses')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Wallet size={14} />
            <span>Expense</span>
          </button>
        </div>
      </div>

      {/* 2. FOUR KPI CARDS OVERLAPPING THE BOTTOM EDGE */}
      <div className="dashboard-hero-kpi-row">
        {/* CARD 1: SALES */}
        <div className="kpi-card-lokboltab">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Sales
              </span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-value)', marginTop: '4px', letterSpacing: '-0.02em' }}>
                {formatPKR(kpi.sales.total)}
              </div>
            </div>
            <div className="kpi-round-badge" style={{ background: kpi.sales.delta_direction === 'up' ? '#DCFCE7' : '#FEE2E2' }}>
              {kpi.sales.delta_direction === 'up' ? (
                <ArrowUpRight size={18} color="#166534" />
              ) : (
                <ArrowDownRight size={18} color="#991B1B" />
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: kpi.sales.delta_direction === 'up' ? '#166534' : '#991B1B',
              background: kpi.sales.delta_direction === 'up' ? '#DCFCE7' : '#FEE2E2',
              padding: '2px 8px',
              borderRadius: '9999px'
            }}>
              {kpi.sales.delta_direction === 'up' ? '↑' : '↓'} {Math.abs(kpi.sales.delta_pct)}% vs prev.
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {kpi.sales.invoice_count} invoices
            </span>
          </div>
        </div>

        {/* CARD 2: RECEIVABLES (UDHAAR) */}
        <div className="kpi-card-lokboltab">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Receivables
              </span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-value)', marginTop: '4px', letterSpacing: '-0.02em' }}>
                {formatPKR(kpi.receivables.total)}
              </div>
            </div>
            <div className="kpi-round-badge" style={{ background: '#FEF3C7' }}>
              <CreditCard size={18} color="#92400E" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: kpi.receivables.total > 0 ? '#92400E' : '#166534',
              background: kpi.receivables.total > 0 ? '#FEF3C7' : '#DCFCE7',
              padding: '2px 8px',
              borderRadius: '9999px'
            }}>
              {kpi.receivables.total > 0 ? 'Pending Collection' : '✓ All Settled'}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {kpi.receivables.customer_count} debtors
            </span>
          </div>
        </div>

        {/* CARD 3: PAYABLES */}
        <div className="kpi-card-lokboltab">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Payables
              </span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-value)', marginTop: '4px', letterSpacing: '-0.02em' }}>
                {kpi.payables.is_restricted ? 'Restricted' : formatPKR(kpi.payables.total)}
              </div>
            </div>
            <div className="kpi-round-badge" style={{ background: '#E0F2FE' }}>
              <Building2 size={18} color="#0369A1" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: kpi.payables.is_restricted ? 'var(--text-muted)' : (kpi.payables.total > 0 ? '#B45309' : '#166534'),
              background: kpi.payables.is_restricted ? 'var(--hover-bg)' : (kpi.payables.total > 0 ? '#FEF3C7' : '#DCFCE7'),
              padding: '2px 8px',
              borderRadius: '9999px'
            }}>
              {kpi.payables.is_restricted ? 'Role: Sales' : (kpi.payables.total > 0 ? 'Payable' : '✓ Settled')}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {kpi.payables.is_restricted ? 'Admin Only' : `${kpi.payables.supplier_count} suppliers`}
            </span>
          </div>
        </div>

        {/* CARD 4: INVENTORY VALUE & LOW STOCK */}
        <div className="kpi-card-lokboltab">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Inventory
              </span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-value)', marginTop: '4px', letterSpacing: '-0.02em' }}>
                {formatPKR(kpi.stock.retail_valuation)}
              </div>
            </div>
            <div className="kpi-round-badge" style={{ background: '#DCFCE7' }}>
              <Package size={18} color="#166534" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: kpi.stock.low_stock_count > 0 ? '#991B1B' : '#166534',
              background: kpi.stock.low_stock_count > 0 ? '#FEE2E2' : '#DCFCE7',
              padding: '2px 8px',
              borderRadius: '9999px'
            }}>
              {kpi.stock.low_stock_count > 0 ? `⚠ ${kpi.stock.low_stock_count} Low Stock` : '✓ Healthy'}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {kpi.stock.total_items} units
            </span>
          </div>
        </div>
      </div>

      {/* 3. ROW OF 3 ANALYTIC CARDS (2 DONUTS + 1 GROUPED BAR) */}
      <div className="analytics-grid-3">
        {/* CARD 1: DONUT - SALES BY PAYMENT METHOD */}
        <div className="analytics-card-lokboltab">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-title)', margin: 0 }}>
                Payments
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Distribution across cash, bank, & credit
              </p>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-title)', background: 'var(--hover-bg)', padding: '2px 8px', borderRadius: '6px' }}>
              {periodLabels[period]}
            </span>
          </div>

          <SvgDonutChart
            items={insights?.donuts?.sales_by_payment?.items || []}
            total={insights?.donuts?.sales_by_payment?.total || 0}
            centerLabel="Total Inflow"
            centerSubtext={`${kpi.sales.invoice_count} transactions`}
          />
        </div>

        {/* CARD 2: DONUT - STOCK BY CATEGORY */}
        <div className="analytics-card-lokboltab">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-title)', margin: 0 }}>
                Categories
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Inventory retail valuation share
              </p>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-title)', background: 'var(--hover-bg)', padding: '2px 8px', borderRadius: '6px' }}>
              Departments
            </span>
          </div>

          <SvgDonutChart
            items={insights?.donuts?.stock_by_category?.items || []}
            total={insights?.donuts?.stock_by_category?.total || 0}
            centerLabel="Stock Value"
            centerSubtext={`${kpi.stock.total_items} items total`}
          />
        </div>

        {/* CARD 3: COMPARATIVE SALES VS PURCHASES */}
        <div className="analytics-card-lokboltab">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-title)', margin: 0 }}>
                Comparison
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Comparative operational flow over time
              </p>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <SvgComparativeChart
              days={insights?.grouped_bar?.days || []}
              months={insights?.grouped_bar?.months || []}
              stats={insights?.grouped_bar?.stats || {}}
            />
          </div>
        </div>
      </div>

      {/* 4. BOTTOM ROW OF CARD LISTS (RECENT INVOICES, TOP DEBTORS, ALERTS) */}
      <div className="bottom-lists-grid-3">
        {/* CARD 1: RECENT INVOICES (ENHANCED DETAILS UNDER EACH) */}
        <div className="bottom-list-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-title)', margin: 0 }}>
                Invoices
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Latest customer orders & billing</span>
            </div>
            <button
              onClick={() => setTab && setTab('sales')}
              style={{ background: 'transparent', border: 'none', color: '#F59E0B', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              <span>See all</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(insights?.lists?.recent_invoices || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '13px' }}>
                No recent invoices recorded
              </div>
            ) : (
              (insights?.lists?.recent_invoices || []).map((inv, idx) => {
                const av = avatarColors[idx % avatarColors.length];
                const initials = (inv.customer_name || 'Walk-in')
                  .split(' ')
                  .map(w => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                const isPaid = Number(inv.balance_due || 0) <= 0;
                const isPartial = Number(inv.paid_amount || 0) > 0 && !isPaid;

                return (
                  <div
                    key={inv.id || idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'var(--hover-bg, #F8FAFC)',
                      border: '1px solid var(--border)',
                      transition: 'border-color 0.15s ease'
                    }}
                  >
                    {/* Top Row: Customer Avatar, Name, Invoice Number & Amount */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="avatar-initial-pill" style={{ background: av.bg, color: av.text }}>
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-title)' }}>
                            {inv.customer_name || 'Counter Walk-in'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '6px' }}>
                            <span style={{ fontWeight: 700 }}>#{inv.invoice_no}</span>
                            <span>•</span>
                            <span>{formatDate(inv.sale_date)}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-value)' }}>
                            {formatPKR(inv.grand_total)}
                          </div>
                        </div>
                        <button
                          onClick={() => handlePrintInvoice(inv.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px', height: '30px', width: '30px', borderRadius: '7px' }}
                          title="Print / View Receipt"
                        >
                          <Printer size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Metadata Strip: Items count, cashier, and payment status */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '6px',
                      borderTop: '1px solid var(--border)',
                      fontSize: '11px',
                      color: 'var(--text-muted)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShoppingBag size={12} color="var(--text-muted)" />
                        <span>
                          {inv.items_count || 1} {Number(inv.items_count) === 1 ? 'item' : 'items'}
                          {inv.first_item_name ? ` (${inv.first_item_name})` : ''}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {/* Payment Method Badge */}
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)'
                        }}>
                          {inv.payment_method || 'cash'}
                        </span>

                        {/* Paid vs Due Status Pill */}
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: isPaid ? '#DCFCE7' : (isPartial ? '#FEF3C7' : '#FEE2E2'),
                          color: isPaid ? '#166534' : (isPartial ? '#92400E' : '#991B1B')
                        }}>
                          {isPaid ? '✓ Paid' : (isPartial ? `Partial (Due ${formatPKR(inv.balance_due)})` : `Due ${formatPKR(inv.balance_due)}`)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CARD 2: TOP DEBTORS (UDHAAR) */}
        <div className="bottom-list-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-title)', margin: 0 }}>
                Debtors
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Outstanding customer credit balances</span>
            </div>
            <button
              onClick={() => setTab && setTab('customers')}
              style={{ background: 'transparent', border: 'none', color: '#F59E0B', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              <span>See all</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(insights?.lists?.top_debtors || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '13px' }}>
                ✓ Zero outstanding customer balances
              </div>
            ) : (
              (insights?.lists?.top_debtors || []).map((debtor, idx) => {
                const av = avatarColors[(idx + 2) % avatarColors.length];
                const initials = (debtor.name || 'Customer')
                  .split(' ')
                  .map(w => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <div
                    key={debtor.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'var(--hover-bg, #F8FAFC)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="avatar-initial-pill" style={{ background: av.bg, color: av.text }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-title)' }}>
                          {debtor.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {debtor.phone || 'No phone recorded'}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#991B1B' }}>
                        {formatPKR(debtor.current_balance)}
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#991B1B', background: '#FEE2E2', padding: '1px 6px', borderRadius: '4px' }}>
                        Due
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CARD 3: OPERATIONAL ALERTS (LOW STOCK / EXPIRY) */}
        <div className="bottom-list-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-title)', margin: 0 }}>
                Alerts
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Stock replenishment & expiry warnings</span>
            </div>
            <button
              onClick={() => setTab && setTab('inventory')}
              style={{ background: 'transparent', border: 'none', color: '#F59E0B', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              <span>See all</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Subtabs: Low Stock vs Near Expiry */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <button
              onClick={() => setAlertTab('low_stock')}
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: '11px',
                fontWeight: 700,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: alertTab === 'low_stock' ? '#FEE2E2' : 'var(--hover-bg)',
                color: alertTab === 'low_stock' ? '#991B1B' : 'var(--text-muted)'
              }}
            >
              Low Stock ({(insights?.lists?.low_stock_alerts || []).length})
            </button>
            <button
              onClick={() => setAlertTab('near_expiry')}
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: '11px',
                fontWeight: 700,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: alertTab === 'near_expiry' ? '#FEF3C7' : 'var(--hover-bg)',
                color: alertTab === 'near_expiry' ? '#92400E' : 'var(--text-muted)'
              }}
            >
              Near Expiry ({(insights?.lists?.near_expiry_alerts || []).length})
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {alertTab === 'low_stock' && (
              (insights?.lists?.low_stock_alerts || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '13px' }}>
                  ✓ All products above minimum stock levels
                </div>
              ) : (
                (insights?.lists?.low_stock_alerts || []).slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--hover-bg, #F8FAFC)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-title)' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        SKU: {item.sku || 'N/A'} • Min threshold: {item.min_stock_level} {item.unit}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#991B1B' }}>
                        {item.current_stock} {item.unit}
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#991B1B', background: '#FEE2E2', padding: '1px 6px', borderRadius: '4px' }}>
                        Low Stock
                      </span>
                    </div>
                  </div>
                ))
              )
            )}

            {alertTab === 'near_expiry' && (
              (insights?.lists?.near_expiry_alerts || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '13px' }}>
                  ✓ No batches near expiry threshold
                </div>
              ) : (
                (insights?.lists?.near_expiry_alerts || []).slice(0, 5).map((batch) => (
                  <div
                    key={batch.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--hover-bg, #F8FAFC)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-title)' }}>
                        {batch.product_name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Lot: {batch.batch_no} • {batch.quantity} {batch.unit}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#B45309' }}>
                        {formatDate(batch.expiry_date)}
                      </div>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: batch.days_remaining <= 0 ? '#991B1B' : '#B45309',
                        background: batch.days_remaining <= 0 ? '#FEE2E2' : '#FEF3C7',
                        padding: '1px 6px',
                        borderRadius: '4px'
                      }}>
                        {batch.days_remaining <= 0 ? 'EXPIRED' : `${batch.days_remaining}d left`}
                      </span>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>

      {/* CUSTOM DATE RANGE MODAL WITH CUSTOM DATEPICKER */}
      {showCustomModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 17, 40, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--bg-card, #FFFFFF)',
            padding: '24px',
            borderRadius: '14px',
            width: '380px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border)'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-title)', margin: '0 0 16px' }}>
              Select Custom Analytics Range
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>From Date</label>
                <div style={{ marginTop: '4px' }}>
                  <CustomDatePicker
                    value={customStart}
                    onChange={(d) => setCustomStart(d)}
                    placeholder="Select start date"
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>To Date</label>
                <div style={{ marginTop: '4px' }}>
                  <CustomDatePicker
                    value={customEnd}
                    onChange={(d) => setCustomEnd(d)}
                    placeholder="Select end date"
                  />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '22px' }}>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!customStart || !customEnd}
                onClick={() => {
                  setPeriod('custom');
                  setShowCustomModal(false);
                }}
                className="btn btn-primary btn-sm"
              >
                Apply Custom Range
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK INVOICE PRINT MODAL */}
      {printInvoiceData && (
        <PrintInvoiceModal
          sale={printInvoiceData.sale || printInvoiceData}
          items={printInvoiceData.items || []}
          settings={printInvoiceData.settings || {}}
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
