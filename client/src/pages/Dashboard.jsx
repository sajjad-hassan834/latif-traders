import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ShoppingCart,
  ArrowDownToLine,
  Wallet,
  AlertTriangle,
  Clock,
  DollarSign,
  Package,
  PlusCircle,
  Receipt,
  RefreshCw,
  Layers,
  ChevronRight,
  ArrowUpRight,
  CheckCircle2,
  Building2,
  Users
} from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import ErrorBoundary from '../components/common/ErrorBoundary';

function DashboardContent({ setTab }) {
  const { user, roleLabel, canSell, canManageInventory, canViewFinances } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Operational Command Center Tabs
  const [alertTab, setAlertTab] = useState('low_stock'); // 'low_stock' | 'expiry'
  const [activityTab, setActivityTab] = useState('sales'); // 'sales' | 'top_products'

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
  const recentSalesCount = metrics?.recent_sales?.length || 0;
  const topProductsCount = metrics?.top_products?.length || 0;

  const netProfit = Number(metrics?.estimated_net_profit || 0);
  const isProfit = netProfit >= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. TOP HEADER & QUICK ACTION BAR */}
      <div className="card" style={{
        padding: '0.85rem 1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        background: '#ffffff',
        border: '1px solid #e2e8f0'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
              Operations Overview
            </h2>
            <span className="badge badge-info" style={{ fontSize: '0.675rem', fontWeight: 700 }}>
              Live
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
            Welcome back, <strong>{user?.full_name}</strong> ({roleLabel}) • Today: {formatDate(new Date())}
          </p>
        </div>

        {/* QUICK ACTIONS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => loadData(true)}
            className="btn btn-secondary btn-sm"
            style={{ height: '32px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Refresh Realtime Data"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {canSell && (
            <button
              onClick={() => setTab('pos')}
              className="btn btn-primary btn-sm"
              style={{ height: '32px', fontSize: '0.775rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ShoppingCart size={14} />
              <span>New POS Sale</span>
            </button>
          )}

          {canManageInventory && (
            <button
              onClick={() => setTab('purchases')}
              className="btn btn-secondary btn-sm"
              style={{ height: '32px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <ArrowDownToLine size={14} />
              <span>Receive Stock</span>
            </button>
          )}

          {canViewFinances && (
            <button
              onClick={() => setTab('expenses')}
              className="btn btn-secondary btn-sm"
              style={{ height: '32px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Wallet size={14} />
              <span>Log Expense</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. HARMONIOUS DAILY PERFORMANCE STRIP (NO BULKY OVERWHELMING BOXES) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '0.75rem'
      }}>
        {/* TODAY SALES */}
        <div className="card" style={{ padding: '0.9rem 1.15rem', borderLeft: '4px solid #0284c7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Today's Sales
            </span>
            <div style={{ background: '#f0f9ff', padding: '5px', borderRadius: '6px' }}>
              <TrendingUp size={15} color="#0284c7" />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
            {formatPKR(metrics?.today_sales || 0)}
          </div>
          <div style={{ fontSize: '0.725rem', color: '#0284c7', fontWeight: 600, marginTop: '0.25rem' }}>
            {metrics?.today_invoices || 0} Invoices Cleared
          </div>
        </div>

        {/* TODAY PURCHASES */}
        <div className="card" style={{ padding: '0.9rem 1.15rem', borderLeft: '4px solid #6366f1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Stock Purchases
            </span>
            <div style={{ background: '#eef2ff', padding: '5px', borderRadius: '6px' }}>
              <ArrowDownToLine size={15} color="#6366f1" />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
            {formatPKR(metrics?.today_purchases || 0)}
          </div>
          <div style={{ fontSize: '0.725rem', color: '#6366f1', fontWeight: 600, marginTop: '0.25rem' }}>
            Restocking & Supplier Bills
          </div>
        </div>

        {/* TODAY EXPENSES */}
        <div className="card" style={{ padding: '0.9rem 1.15rem', borderLeft: '4px solid #f97316' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Operating Expenses
            </span>
            <div style={{ background: '#fff7ed', padding: '5px', borderRadius: '6px' }}>
              <Wallet size={15} color="#f97316" />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
            {formatPKR(metrics?.today_expenses || 0)}
          </div>
          <div style={{ fontSize: '0.725rem', color: '#ea580c', fontWeight: 600, marginTop: '0.25rem' }}>
            Freezer Power, Fuel & Rent
          </div>
        </div>

        {/* ESTIMATED NET OPERATING POSITION */}
        <div className="card" style={{
          padding: '0.9rem 1.15rem',
          borderLeft: `4px solid ${isProfit ? '#10b981' : '#ef4444'}`,
          background: isProfit ? '#f0fdf4' : '#fef2f2'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: isProfit ? '#166534' : '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Est. Net Daily Result
            </span>
            <div style={{ background: isProfit ? '#dcfce7' : '#fee2e2', padding: '5px', borderRadius: '6px' }}>
              <DollarSign size={15} color={isProfit ? '#15803d' : '#dc2626'} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: isProfit ? '#15803d' : '#dc2626', marginTop: '0.25rem' }}>
            {formatPKR(netProfit)}
          </div>
          <div style={{ fontSize: '0.725rem', color: isProfit ? '#166534' : '#991b1b', fontWeight: 600, marginTop: '0.25rem' }}>
            Gross Profit: {formatPKR(metrics?.estimated_gross_profit || 0)}
          </div>
        </div>
      </div>

      {/* 3. WORKING CAPITAL & COLD STORAGE VALUATION (REFINED, ELEGANT PROPORTIONS) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '0.75rem'
      }}>
        {/* COLD STORAGE STOCK VALUATION */}
        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Total Stock Valuation
              </span>
              <span className="badge badge-success" style={{ fontSize: '0.675rem' }}>
                Active Cold Storage
              </span>
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0284c7' }}>
              {formatPKR(metrics?.inventory_valuation?.total_cost_value || 0)}
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
              Current wholesale acquisition cost of inventory on hand.
            </p>
          </div>
          <div style={{
            marginTop: '0.75rem',
            paddingTop: '0.65rem',
            borderTop: '1px dashed #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.775rem'
          }}>
            <span>Retail Valuation: <strong style={{ color: '#0f172a' }}>{formatPKR(metrics?.inventory_valuation?.total_retail_value || 0)}</strong></span>
            <span>Total Units: <strong style={{ color: '#0284c7' }}>{metrics?.inventory_valuation?.total_items_stock || 0}</strong></span>
          </div>
        </div>

        {/* CUSTOMER RECEIVABLES (UDHAAR) */}
        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Customer Receivables
              </span>
              <span className="badge badge-warning" style={{ fontSize: '0.675rem' }}>
                Market Credit
              </span>
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a' }}>
              {formatPKR(metrics?.total_receivables || 0)}
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
              Total credit balance owed by regular and wholesale clients.
            </p>
          </div>
          <div style={{
            marginTop: '0.75rem',
            paddingTop: '0.65rem',
            borderTop: '1px dashed #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Ledger status monitored</span>
            <button
              onClick={() => setTab('customers')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.725rem', padding: '2px 8px', height: '26px' }}
            >
              <span>View Customers</span>
              <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {/* SUPPLIER PAYABLES */}
        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Supplier Payables
              </span>
              <span className="badge badge-danger" style={{ fontSize: '0.675rem' }}>
                Vendor Dues
              </span>
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a' }}>
              {formatPKR(metrics?.total_payables || 0)}
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
              Outstanding invoices due to frozen food manufacturing companies.
            </p>
          </div>
          <div style={{
            marginTop: '0.75rem',
            paddingTop: '0.65rem',
            borderTop: '1px dashed #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Vendor credit schedule</span>
            <button
              onClick={() => setTab('suppliers')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.725rem', padding: '2px 8px', height: '26px' }}
            >
              <span>View Suppliers</span>
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. THE COMMAND CENTER (TWO INTERACTIVE BALANCED MODULES INSTEAD OF 4 RAW TABLES) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: '0.75rem'
      }}>
        {/* MODULE A: OPERATIONAL ALERTS CENTER (LOW STOCK vs EXPIRY) */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* TAB HEADER */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '0.35rem 0.65rem'
          }}>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                onClick={() => setAlertTab('low_stock')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '0.775rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: alertTab === 'low_stock' ? '#ffffff' : 'transparent',
                  color: alertTab === 'low_stock' ? '#d97706' : '#64748b',
                  boxShadow: alertTab === 'low_stock' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  border: alertTab === 'low_stock' ? '1px solid #fde68a' : '1px solid transparent'
                }}
              >
                <AlertTriangle size={13} color="#f59e0b" />
                <span>Low Stock Warnings</span>
                <span style={{
                  background: lowStockCount > 0 ? '#fef3c7' : '#f1f5f9',
                  color: lowStockCount > 0 ? '#b45309' : '#94a3b8',
                  padding: '1px 5px',
                  borderRadius: '10px',
                  fontSize: '0.675rem'
                }}>
                  {lowStockCount}
                </span>
              </button>

              <button
                onClick={() => setAlertTab('expiry')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '0.775rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: alertTab === 'expiry' ? '#ffffff' : 'transparent',
                  color: alertTab === 'expiry' ? '#dc2626' : '#64748b',
                  boxShadow: alertTab === 'expiry' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  border: alertTab === 'expiry' ? '1px solid #fecaca' : '1px solid transparent'
                }}
              >
                <Clock size={13} color="#ef4444" />
                <span>Near Expiry Batches</span>
                <span style={{
                  background: nearExpiryCount > 0 ? '#fee2e2' : '#f1f5f9',
                  color: nearExpiryCount > 0 ? '#b91c1c' : '#94a3b8',
                  padding: '1px 5px',
                  borderRadius: '10px',
                  fontSize: '0.675rem'
                }}>
                  {nearExpiryCount}
                </span>
              </button>
            </div>

            <button
              onClick={() => alertTab === 'low_stock' ? setTab('inventory') : setTab('reports')}
              style={{ fontSize: '0.725rem', color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px', padding: '4px 8px' }}
            >
              <span>Manage</span>
              <ChevronRight size={12} />
            </button>
          </div>

          {/* CONTENT: LOW STOCK LIST */}
          {alertTab === 'low_stock' && (
            <div style={{ padding: '0.75rem' }}>
              {lowStockCount === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#059669', background: '#ecfdf5', borderRadius: '8px', fontSize: '0.825rem' }}>
                  <CheckCircle2 size={24} style={{ margin: '0 auto 0.4rem', color: '#10b981' }} />
                  <strong>Cold storage stock is healthy!</strong>
                  <p style={{ fontSize: '0.725rem', color: '#047857', marginTop: '2px' }}>No items are currently below minimum alert levels.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {metrics?.low_stock_items?.slice(0, 5).map(item => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem 0.65rem',
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: '6px'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a' }}>{item.name}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          SKU: <span className="mono">{item.sku || 'N/A'}</span> • Min Alert: {item.min_stock_level} {item.unit}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            color: item.current_stock === 0 ? '#dc2626' : '#d97706'
                          }}>
                            {item.current_stock} {item.unit}
                          </span>
                          <div style={{ fontSize: '0.65rem', color: item.current_stock === 0 ? '#dc2626' : '#b45309', fontWeight: 600 }}>
                            {item.current_stock === 0 ? 'Out of Stock' : 'Low Stock'}
                          </div>
                        </div>

                        {canManageInventory && (
                          <button
                            onClick={() => setTab('purchases')}
                            className="btn btn-primary btn-sm"
                            style={{ height: '26px', fontSize: '0.7rem', padding: '0 0.5rem' }}
                            title="Restock this item"
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

          {/* CONTENT: EXPIRY LIST */}
          {alertTab === 'expiry' && (
            <div style={{ padding: '0.75rem' }}>
              {nearExpiryCount === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#059669', background: '#ecfdf5', borderRadius: '8px', fontSize: '0.825rem' }}>
                  <CheckCircle2 size={24} style={{ margin: '0 auto 0.4rem', color: '#10b981' }} />
                  <strong>No batches expiring soon!</strong>
                  <p style={{ fontSize: '0.725rem', color: '#047857', marginTop: '2px' }}>All active lots are within healthy shelf-life thresholds.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {metrics?.near_expiry_batches?.slice(0, 5).map(b => (
                    <div
                      key={b.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem 0.65rem',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '6px'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a' }}>{b.product_name}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          Lot: <span className="mono">{b.batch_no}</span> • Qty: <strong>{b.quantity} {b.unit}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.775rem', fontWeight: 800, color: '#dc2626' }}>
                            {formatDate(b.expiry_date)}
                          </span>
                          <div style={{ fontSize: '0.675rem', fontWeight: 700, color: '#b91c1c' }}>
                            {b.days_remaining <= 0 ? 'EXPIRED' : `${b.days_remaining} days remaining`}
                          </div>
                        </div>

                        <button
                          onClick={() => setTab('reports')}
                          className="btn btn-secondary btn-sm"
                          style={{ height: '26px', fontSize: '0.7rem', padding: '0 0.5rem' }}
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODULE B: LIVE COMMERCIAL ACTIVITY (RECENT SALES vs TOP SELLERS) */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* TAB HEADER */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '0.35rem 0.65rem'
          }}>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                onClick={() => setActivityTab('sales')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '0.775rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: activityTab === 'sales' ? '#ffffff' : 'transparent',
                  color: activityTab === 'sales' ? '#0284c7' : '#64748b',
                  boxShadow: activityTab === 'sales' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  border: activityTab === 'sales' ? '1px solid #bae6fd' : '1px solid transparent'
                }}
              >
                <Receipt size={13} color="#0284c7" />
                <span>Recent Invoices</span>
              </button>

              <button
                onClick={() => setActivityTab('top_products')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '0.775rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: activityTab === 'top_products' ? '#ffffff' : 'transparent',
                  color: activityTab === 'top_products' ? '#6366f1' : '#64748b',
                  boxShadow: activityTab === 'top_products' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  border: activityTab === 'top_products' ? '1px solid #c7d2fe' : '1px solid transparent'
                }}
              >
                <TrendingUp size={13} color="#6366f1" />
                <span>Top Selling Items</span>
              </button>
            </div>

            <button
              onClick={() => activityTab === 'sales' ? setTab('sales') : setTab('reports')}
              style={{ fontSize: '0.725rem', color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px', padding: '4px 8px' }}
            >
              <span>View All</span>
              <ChevronRight size={12} />
            </button>
          </div>

          {/* CONTENT: RECENT SALES */}
          {activityTab === 'sales' && (
            <div style={{ padding: '0.75rem' }}>
              {recentSalesCount === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                  No recent counter invoices found.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {metrics?.recent_sales?.slice(0, 5).map(s => (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.45rem 0.65rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span className="mono" style={{ fontWeight: 700, color: '#0284c7', fontSize: '0.775rem' }}>
                            {s.invoice_no}
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a' }}>
                            {s.customer_name}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          Date: {formatDate(s.sale_date)}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                          {formatPKR(s.grand_total)}
                        </div>
                        <span style={{
                          fontSize: '0.675rem',
                          fontWeight: 700,
                          color: s.balance_due > 0 ? '#dc2626' : '#15803d'
                        }}>
                          {s.balance_due > 0 ? `Due: ${formatPKR(s.balance_due)}` : 'Paid in Full'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CONTENT: TOP SELLING PRODUCTS */}
          {activityTab === 'top_products' && (
            <div style={{ padding: '0.75rem' }}>
              {topProductsCount === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                  No top sales trends recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {metrics?.top_products?.slice(0, 5).map((tp, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.45rem 0.65rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: idx === 0 ? '#fef3c7' : '#f1f5f9',
                          color: idx === 0 ? '#b45309' : '#64748b',
                          fontWeight: 800,
                          fontSize: '0.7rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          #{idx + 1}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                            {tp.name}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            Volume Sold: <strong>{tp.total_qty} {tp.unit}</strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0284c7' }}>
                          {formatPKR(tp.total_revenue)}
                        </div>
                        <div style={{ fontSize: '0.675rem', color: '#64748b' }}>
                          30-Day Turnover
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
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
