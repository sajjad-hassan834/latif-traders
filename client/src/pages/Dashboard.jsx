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
  Building2
} from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import useTradeProfile from '../hooks/useTradeProfile';
import { useAuth } from '../context/AuthContext';
import ErrorBoundary from '../components/common/ErrorBoundary';
import PrintInvoiceModal from '../components/invoices/PrintInvoiceModal';

// Interactive SVG Donut Chart (Pure SVG, zero external chart library)
function SvgDonutChart({ items = [], total = 0, centerLabel = 'Total', size = 180, strokeWidth = 24 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const colors = ['#10B981', '#0284C7', '#F59E0B', '#8B5CF6', '#EC4899', '#64748B'];

  let accumulatedPercent = 0;
  const slices = (items || []).map((item, idx) => {
    const pct = item.percentage || 0;
    const strokeDasharray = `${(pct / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += pct;
    return {
      ...item,
      color: colors[idx % colors.length],
      strokeDasharray,
      strokeDashoffset,
      pct
    };
  });

  const activeSlice = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="var(--border, #E2E8F0)"
            strokeWidth={strokeWidth}
          />
          {/* Donut Segments */}
          {slices.map((slice, idx) => (
            <circle
              key={idx}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={slice.color}
              strokeWidth={hoveredIdx === idx ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={slice.strokeDasharray}
              strokeDashoffset={slice.strokeDashoffset}
              style={{
                transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                cursor: 'pointer',
                opacity: hoveredIdx === null || hoveredIdx === idx ? 1 : 0.4
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
        </svg>

        {/* Center Label */}
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
          padding: '8px',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase' }}>
            {activeSlice ? activeSlice.method || activeSlice.category : centerLabel}
          </span>
          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-title, #0F172A)', marginTop: '2px' }}>
            {activeSlice ? formatPKR(activeSlice.amount || activeSlice.value) : formatPKR(total)}
          </span>
          {activeSlice && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: activeSlice.color, marginTop: '1px' }}>
              {activeSlice.pct}%
            </span>
          )}
        </div>
      </div>

      {/* Legend below */}
      <div style={{ width: '100%', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {slices.slice(0, 4).map((slice, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              padding: '4px 6px',
              borderRadius: '6px',
              background: hoveredIdx === idx ? 'var(--hover-bg, #F1F5F9)' : 'transparent',
              cursor: 'pointer'
            }}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: slice.color, display: 'inline-block' }} />
              <span style={{ fontWeight: 600, color: 'var(--text-title, #0F172A)', textTransform: 'capitalize' }}>
                {slice.method || slice.category}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-value, #0F172A)' }}>
                {formatPKR(slice.amount || slice.value)}
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '9999px',
                background: `${slice.color}20`,
                color: slice.color
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

// Grouped Bar Chart (Sales vs Purchases by Month)
function SvgGroupedBarChart({ months = [] }) {
  const [hoveredMonth, setHoveredMonth] = useState(null);
  const width = 480;
  const height = 190;
  const paddingX = 40;
  const paddingY = 24;

  const maxVal = Math.max(
    ...months.map(m => Math.max(Number(m.sales || 0), Number(m.purchases || 0))),
    100
  );

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;
  const groupStep = months.length > 0 ? chartWidth / months.length : chartWidth;
  const barWidth = 14;

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', maxHeight: '200px' }}>
        {/* Horizontal grid lines */}
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
                fill="var(--text-muted, #64748B)"
              >
                {Math.round((maxVal * pct) / 1000)}k
              </text>
            </g>
          );
        })}

        {/* Grouped Bars */}
        {months.map((m, idx) => {
          const groupCenter = paddingX + idx * groupStep + groupStep / 2;
          const salesHeight = Math.max(2, (Number(m.sales || 0) / maxVal) * chartHeight);
          const purchasesHeight = Math.max(2, (Number(m.purchases || 0) / maxVal) * chartHeight);

          const salesX = groupCenter - barWidth - 2;
          const salesY = paddingY + chartHeight - salesHeight;

          const purchasesX = groupCenter + 2;
          const purchasesY = paddingY + chartHeight - purchasesHeight;

          const isHovered = hoveredMonth === idx;

          return (
            <g
              key={idx}
              onMouseEnter={() => setHoveredMonth(idx)}
              onMouseLeave={() => setHoveredMonth(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Sales Bar (Amber) */}
              <rect
                x={salesX}
                y={salesY}
                width={barWidth}
                height={salesHeight}
                rx="3"
                fill="#F59E0B"
                opacity={isHovered ? 1 : 0.85}
              />

              {/* Purchases Bar (Navy/Indigo) */}
              <rect
                x={purchasesX}
                y={purchasesY}
                width={barWidth}
                height={purchasesHeight}
                rx="3"
                fill="#0284C7"
                opacity={isHovered ? 1 : 0.75}
              />

              {/* Month label on X axis */}
              <text
                x={groupCenter}
                y={height - 6}
                textAnchor="middle"
                fontSize="10"
                fontWeight={isHovered ? 700 : 500}
                fill={isHovered ? 'var(--text-title, #0F172A)' : 'var(--text-muted, #64748B)'}
              >
                {m.month}
              </text>

              {/* Tooltip on hover */}
              {isHovered && (
                <g>
                  <rect
                    x={groupCenter - 45}
                    y={Math.min(salesY, purchasesY) - 24}
                    width="90"
                    height="20"
                    rx="4"
                    fill="#0F172A"
                  />
                  <text
                    x={groupCenter}
                    y={Math.min(salesY, purchasesY) - 10}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="9"
                    fontWeight="700"
                  >
                    S: {formatPKR(m.sales)} | P: {formatPKR(m.purchases)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. DARK NAVY HERO BAND */}
      <div className="dashboard-hero-band">
        <div className="dashboard-hero-top">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#F59E0B', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                Operational Control
              </span>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>•</span>
              <span style={{ fontSize: '12px', color: '#CBD5E1' }}>{tenant?.business_name || 'My Store'}</span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', margin: '6px 0 2px', letterSpacing: '-0.02em' }}>
              Welcome back, {user?.full_name || 'User'}
            </h1>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
              Performance summary for <span style={{ color: '#F59E0B', fontWeight: 600 }}>{periodLabels[period]}</span>
            </p>
          </div>

          {/* Right Header Controls: Period Pills + Quick Actions */}
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
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                color: '#CBD5E1',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600
              }}
              title="Refresh Analytics"
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
            <span>New Sale (POS)</span>
          </button>

          <button
            onClick={() => setTab && setTab('purchases')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
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
            <span>Add Purchase</span>
          </button>

          <button
            onClick={() => setTab && setTab('customers')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
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
            <span>New Customer</span>
          </button>

          <button
            onClick={() => setTab && setTab('expenses')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
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
            <span>New Expense</span>
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
                Sales ({periodLabels[period]})
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
                Receivables (Udhaar)
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
                Payables (Suppliers)
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
                Inventory Valuation
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
                Payment Breakdown
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Sales distribution by payment channel
              </p>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--hover-bg)', padding: '2px 8px', borderRadius: '4px' }}>
              {periodLabels[period]}
            </span>
          </div>

          <SvgDonutChart
            items={insights?.donuts?.sales_by_payment?.items || []}
            total={insights?.donuts?.sales_by_payment?.total || 0}
            centerLabel="Total Sales"
          />
        </div>

        {/* CARD 2: DONUT - STOCK BY CATEGORY */}
        <div className="analytics-card-lokboltab">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
                Stock by Category
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Valuation share across departments
              </p>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--hover-bg)', padding: '2px 8px', borderRadius: '4px' }}>
              Categories
            </span>
          </div>

          <SvgDonutChart
            items={insights?.donuts?.stock_by_category?.items || []}
            total={insights?.donuts?.stock_by_category?.total || 0}
            centerLabel="Stock Value"
          />
        </div>

        {/* CARD 3: GROUPED BAR - SALES VS PURCHASES */}
        <div className="analytics-card-lokboltab">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
                Sales vs Purchases
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Monthly comparison (Last 6 Months)
              </p>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#F59E0B' }} />
                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Sales</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#0284C7' }} />
                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Purchases</span>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <SvgGroupedBarChart months={insights?.grouped_bar?.months || []} />
          </div>
        </div>
      </div>

      {/* 4. BOTTOM ROW OF CARD LISTS (WITH AVATARS AND 'SEE ALL' LINKS) */}
      <div className="bottom-lists-grid-3">
        {/* CARD 1: RECENT INVOICES */}
        <div className="bottom-list-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
                Recent Invoices
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Latest transactions</span>
            </div>
            <button
              onClick={() => setTab && setTab('sales')}
              style={{ background: 'transparent', border: 'none', color: '#F59E0B', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              <span>See all</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(insights?.lists?.recent_invoices || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '13px' }}>
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

                return (
                  <div
                    key={inv.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'var(--hover-bg, #F8FAFC)',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="avatar-initial-pill" style={{ background: av.bg, color: av.text }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-title)' }}>
                          {inv.customer_name || 'Walk-in Customer'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '6px' }}>
                          <span style={{ fontWeight: 600 }}>#{inv.invoice_no}</span>
                          <span>•</span>
                          <span>{formatDate(inv.sale_date)}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-value)' }}>
                          {formatPKR(inv.grand_total)}
                        </div>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: inv.payment_method === 'credit' ? '#92400E' : '#166534'
                        }}>
                          {inv.payment_method || 'cash'}
                        </span>
                      </div>
                      <button
                        onClick={() => handlePrintInvoice(inv.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '6px' }}
                        title="Print / View Invoice"
                      >
                        <Printer size={13} />
                      </button>
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
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
                Top Debtors
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Outstanding customer balances</span>
            </div>
            <button
              onClick={() => setTab && setTab('customers')}
              style={{ background: 'transparent', border: 'none', color: '#F59E0B', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              <span>See all</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(insights?.lists?.top_debtors || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '13px' }}>
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
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'var(--hover-bg, #F8FAFC)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="avatar-initial-pill" style={{ background: av.bg, color: av.text }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-title)' }}>
                          {debtor.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {debtor.phone || 'No phone'}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#991B1B' }}>
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
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
                Inventory Alerts
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Stock replenishment & expiry</span>
            </div>
            <button
              onClick={() => setTab && setTab('inventory')}
              style={{ background: 'transparent', border: 'none', color: '#F59E0B', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
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
                padding: '5px 8px',
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
                padding: '5px 8px',
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
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '13px' }}>
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
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'var(--hover-bg, #F8FAFC)'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-title)' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        SKU: {item.sku || 'N/A'} • Min: {item.min_stock_level} {item.unit}
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
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '13px' }}>
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
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'var(--hover-bg, #F8FAFC)'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-title)' }}>
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

      {/* CUSTOM DATE RANGE MODAL */}
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
            width: '360px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-title)', margin: '0 0 16px' }}>
              Select Custom Period
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Start Date</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>End Date</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
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
                Apply Range
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
