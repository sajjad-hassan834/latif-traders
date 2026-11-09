import { BRAND_NAME } from '../config/brand';
import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  TrendingUp, 
  DollarSign, 
  ArrowRight, 
  ShieldAlert, 
  Power, 
  Trash2, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Archive,
  RotateCcw,
  KeyRound,
  Copy,
  Check,
  Lock,
  UserCheck
} from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function SuperOwnerDashboard() {
  const navigate = (path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  const { user, isSuperOwner, enterTenant } = useAuth();
  const [stats, setStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tabFilter, setTabFilter] = useState('active'); // 'active' | 'archived'
  const [actionLoading, setActionLoading] = useState(null);

  // Soft Delete State
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [typedConfirmName, setTypedConfirmName] = useState('');

  // Impersonate State
  const [impersonateTarget, setImpersonateTarget] = useState(null);
  const [impersonateReason, setImpersonateReason] = useState('Customer Support Investigation');
  const [impersonateNotes, setImpersonateNotes] = useState('');

  // Support Reset Link State
  const [resetModal, setResetModal] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'superowner') {
      navigate('/');
      return;
    }
    loadData();
  }, [user, tabFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, tenantsRes] = await Promise.all([
        api.get('/superowner/stats'),
        api.get('/superowner/tenants?status=' + tabFilter)
      ]);

      if (statsRes?.success) setStats(statsRes.stats);
      if (tenantsRes?.success) setTenants(tenantsRes.tenants || []);
    } catch (err) {
      console.error('SuperOwner load data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (tenant) => {
    setActionLoading(tenant.id);
    try {
      const newStatus = tenant.is_active === 1 ? 0 : 1;
      const res = await api.post(`/superowner/tenants/${tenant.id}/status`, { is_active: newStatus });
      if (res?.success) {
        setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, is_active: newStatus } : t));
      }
    } catch (err) {
      alert(err.message || 'Failed to update tenant status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchiveTenant = async () => {
    if (!confirmArchive) return;
    setActionLoading(confirmArchive.id);
    try {
      const res = await api.post(`/superowner/tenants/${confirmArchive.id}/archive`, {
        confirm_business_name: typedConfirmName.trim()
      });
      if (res?.success) {
        setConfirmArchive(null);
        setTypedConfirmName('');
        await loadData();
      } else {
        alert(res?.message || 'Failed to archive tenant');
      }
    } catch (err) {
      alert(err.message || 'Failed to archive tenant');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreTenant = async (tenant) => {
    setActionLoading(tenant.id);
    try {
      const res = await api.post(`/superowner/tenants/${tenant.id}/restore`);
      if (res?.success) {
        await loadData();
      } else {
        alert(res?.message || 'Failed to restore tenant');
      }
    } catch (err) {
      alert(err.message || 'Failed to restore tenant');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartImpersonate = async () => {
    if (!impersonateTarget) return;
    try {
      await api.post('/superowner/impersonate/start', {
        tenant_id: impersonateTarget.id,
        reason_code: impersonateReason,
        notes: impersonateNotes
      });
      localStorage.setItem('lt_impersonate_reason', impersonateReason);
      enterTenant(impersonateTarget);
      setImpersonateTarget(null);
      navigate('/');
    } catch (err) {
      alert(err.message || 'Failed to start impersonation');
    }
  };

  const handleGenerateResetLink = async (tenant) => {
    try {
      const res = await api.post('/superowner/support/reset-link', {
        username: tenant.email || tenant.owner_name
      });
      if (res?.success) {
        setResetModal(res);
        setCopiedLink(false);
      } else {
        alert(res?.message || 'Failed to generate reset link');
      }
    } catch (err) {
      alert(err.message || 'Failed to generate reset link');
    }
  };

  const filteredTenants = (tenants || []).filter(t => 
    t.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.id?.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase()) ||
    t.owner_name?.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (val) => {
    return '₨ ' + Number(val || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F0F4F8', padding: '32px 24px', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        
        {/* Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#0F766E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <ShieldAlert size={22} />
              </div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  {BRAND_NAME} Super Admin Console
                </h1>
                <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0 0' }}>
                  Multi-Tenant Platform Control • Security • Subscriptions • Safe Operations
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={loadData}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#334155',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => navigate('/')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#0F766E',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Enter Main App
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Top 4 Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 28 }}>
          
          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 22px', border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Total Tenants</span>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
                  {stats ? stats.totalTenants : '—'}
                </div>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={20} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#0F766E', marginTop: 8, fontWeight: 500 }}>
              {stats?.activeTenants || 0} active business accounts
            </div>
          </div>

          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 22px', border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Active Today</span>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
                  {stats ? stats.activeTenants : '—'}
                </div>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={20} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#16A34A', marginTop: 8, fontWeight: 500 }}>
              100% operational status
            </div>
          </div>

          {/* Standardized MRR in PKR & USD */}
          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 22px', border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Monthly Revenue (MRR)</span>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#0F766E', marginTop: 4 }}>
                  {stats ? formatCurrency(stats.monthlyRevenuePkr || stats.monthlyRevenue) : '—'} <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>/ mo</span>
                </div>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: '#CCFBF1', color: '#0F766E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={20} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>
              ~${stats?.monthlyRevenueUsd || 0} USD • {stats?.entTenants || 0} Enterprise, {stats?.proTenants || 0} Pro
            </div>
          </div>

          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 22px', border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Total Sales Processed</span>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
                  {stats ? formatCurrency(stats.totalSales) : '—'}
                </div>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={20} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#D97706', marginTop: 8, fontWeight: 500 }}>
              This month: {formatCurrency(stats?.monthlySales || 0)}
            </div>
          </div>

        </div>

        {/* Tenants Table Card */}
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          
          {/* Table Header Controls */}
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Registered Businesses & Tenants</h2>
                {/* Active vs Archived Filter Tabs */}
                <div style={{ display: 'flex', background: '#F1F5F9', padding: '3px', borderRadius: 8 }}>
                  <button
                    onClick={() => setTabFilter('active')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: tabFilter === 'active' ? '#FFFFFF' : 'transparent',
                      color: tabFilter === 'active' ? '#0F766E' : '#64748B',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: tabFilter === 'active' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    Active Tenants
                  </button>
                  <button
                    onClick={() => setTabFilter('archived')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: tabFilter === 'archived' ? '#FFFFFF' : 'transparent',
                      color: tabFilter === 'archived' ? '#DC2626' : '#64748B',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: tabFilter === 'archived' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    Archived / Trash
                  </button>
                </div>
              </div>
              <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>
                {tabFilter === 'active' 
                  ? 'Manage active SaaS businesses, impersonate with reason, or issue support reset links'
                  : 'Soft-deleted tenants. Ledgers and records are safe and can be restored anytime'}
              </p>
            </div>

            <div style={{ position: 'relative', width: 280 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: '#94A3B8' }} />
              <input 
                type="text"
                placeholder="Search business, owner, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: 12 }}>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Business</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600 }}>Owner / Contact</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600 }}>Plan</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600 }}>Scale</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600 }}>Last Active</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600 }}>Monthly Sales</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                      <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                      Loading tenants...
                    </td>
                  </tr>
                ) : filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                      No {tabFilter === 'archived' ? 'archived' : ''} tenants found.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((t) => {
                    const isActive = t.is_active === 1;
                    const isBaseTenant = t.is_default === 1;
                    const isArchived = !!t.deleted_at;

                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #F1F5F9', background: '#FFFFFF' }}>
                        
                        {/* Business Info */}
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 34,
                              height: 34,
                              borderRadius: 8,
                              background: isBaseTenant ? '#FEF3C7' : '#F1F5F9',
                              color: isBaseTenant ? '#D97706' : '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 13
                            }}>
                              {t.business_name ? t.business_name.charAt(0).toUpperCase() : 'T'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {t.business_name}
                                {isBaseTenant && (
                                  <span style={{ fontSize: 10, background: '#FEF3C7', color: '#B45309', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                                    PRIMARY BASE
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: '#94A3B8' }}>
                                ID: {t.id} • {t.business_type ? t.business_type.replace('_', ' ') : 'retail'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Owner / Email */}
                        <td style={{ padding: '14px 16px', color: '#334155' }}>
                          <div style={{ fontWeight: 500 }}>{t.owner_name || 'Admin'}</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>{t.email || t.phone || '—'}</div>
                        </td>

                        {/* Plan */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            background: t.plan === 'enterprise' ? '#EDE9FE' : (t.plan === 'pro' ? '#E0F2FE' : '#F1F5F9'),
                            color: t.plan === 'enterprise' ? '#6D28D9' : (t.plan === 'pro' ? '#0369A1' : '#475569')
                          }}>
                            {t.plan || 'free'}
                          </span>
                        </td>

                        {/* Scale */}
                        <td style={{ padding: '14px 16px', color: '#64748B', fontSize: 12 }}>
                          <div>{t.product_count || 0} products</div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>{t.user_count || 1} staff users</div>
                        </td>

                        {/* Last Active */}
                        <td style={{ padding: '14px 16px', color: '#475569', fontSize: 12 }}>
                          {t.last_active ? (
                            <div>
                              <div>{new Date(t.last_active).toLocaleDateString('en-GB')}</div>
                              <div style={{ fontSize: 10, color: '#94A3B8' }}>{new Date(t.last_active).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          ) : (
                            <span style={{ color: '#94A3B8' }}>Recent</span>
                          )}
                        </td>

                        {/* Monthly Sales */}
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: '#0F172A' }}>
                          {formatCurrency(t.monthly_sales)}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 16px' }}>
                          {isArchived ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '3px 8px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 600,
                              background: '#F1F5F9',
                              color: '#64748B'
                            }}>
                              <Archive size={12} />
                              Archived
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '3px 8px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 600,
                              background: isActive ? '#DCFCE7' : '#FEE2E2',
                              color: isActive ? '#15803D' : '#B91C1C'
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#16A34A' : '#DC2626' }} />
                              {isActive ? 'Active' : 'Suspended'}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            
                            {isArchived ? (
                              /* Restore Archived Tenant */
                              <button
                                onClick={() => handleRestoreTenant(t)}
                                disabled={actionLoading === t.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '6px 12px',
                                  borderRadius: 6,
                                  border: '1px solid #16A34A',
                                  background: '#F0FDF4',
                                  color: '#15803D',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                <RotateCcw size={13} />
                                <span>Restore</span>
                              </button>
                            ) : (
                              <>
                                {/* Enter Tenant Button with Governed Impersonation */}
                                <button
                                  onClick={() => setImpersonateTarget(t)}
                                  title="Enter business dashboard as owner"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '6px 10px',
                                    borderRadius: 6,
                                    border: '1px solid #0F766E',
                                    background: '#F0FDFA',
                                    color: '#0F766E',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  <span>Enter</span>
                                  <ArrowRight size={13} />
                                </button>

                                {/* Support Reset Link */}
                                <button
                                  onClick={() => handleGenerateResetLink(t)}
                                  title="Generate 24h password reset link for owner"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '6px 8px',
                                    borderRadius: 6,
                                    border: '1px solid #CBD5E1',
                                    background: '#FFFFFF',
                                    color: '#475569',
                                    fontSize: 12,
                                    cursor: 'pointer'
                                  }}
                                >
                                  <KeyRound size={13} />
                                </button>

                                {/* Suspend / Reactivate */}
                                <button
                                  onClick={() => handleToggleStatus(t)}
                                  disabled={actionLoading === t.id}
                                  title={isActive ? 'Suspend Business' : 'Activate Business'}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '6px 9px',
                                    borderRadius: 6,
                                    border: '1px solid #CBD5E1',
                                    background: '#FFFFFF',
                                    color: isActive ? '#B45309' : '#15803D',
                                    fontSize: 12,
                                    fontWeight: 500,
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Power size={13} />
                                </button>

                                {/* Soft Delete Button */}
                                {!isBaseTenant && (
                                  <button
                                    onClick={() => {
                                      setConfirmArchive(t);
                                      setTypedConfirmName('');
                                    }}
                                    disabled={actionLoading === t.id}
                                    title="Archive Tenant (Soft Delete)"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '6px 8px',
                                      borderRadius: 6,
                                      border: '1px solid #FECACA',
                                      background: '#FEF2F2',
                                      color: '#DC2626',
                                      fontSize: 12,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Soft Delete Confirmation Modal with Typed Business Name ── */}
        {confirmArchive && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
            <div style={{ background: '#FFFFFF', borderRadius: 16, maxWidth: 480, width: '100%', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <AlertTriangle size={24} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>
                Archive "{confirmArchive.business_name}"?
              </h3>
              <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: '0 0 16px' }}>
                This is a <strong>safe soft-deletion</strong>. Active staff sessions will be revoked and products hidden, but all financial ledgers, sales, and inventory history remain intact. You can restore this tenant anytime.
              </p>

              <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: 8, border: '1px solid #E2E8F0', marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  To confirm, type the exact business name: <strong>"{confirmArchive.business_name}"</strong>
                </label>
                <input
                  type="text"
                  placeholder={confirmArchive.business_name}
                  value={typedConfirmName}
                  onChange={(e) => setTypedConfirmName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  onClick={() => setConfirmArchive(null)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#334155', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  disabled={typedConfirmName.trim().toLowerCase() !== confirmArchive.business_name.trim().toLowerCase()}
                  onClick={handleArchiveTenant}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: typedConfirmName.trim().toLowerCase() === confirmArchive.business_name.trim().toLowerCase() ? '#DC2626' : '#FCA5A5',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: typedConfirmName.trim().toLowerCase() === confirmArchive.business_name.trim().toLowerCase() ? 'pointer' : 'not-allowed'
                  }}
                >
                  Confirm Soft Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Governed Impersonation Modal with Mandatory Reason ── */}
        {impersonateTarget && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
            <div style={{ background: '#FFFFFF', borderRadius: 16, maxWidth: 500, width: '100%', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#CCFBF1', color: '#0F766E', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <UserCheck size={24} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: '0 0 6px' }}>
                Impersonate "{impersonateTarget.business_name}"
              </h3>
              <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: '0 0 16px' }}>
                You are entering this business environment with Owner-level privileges. All actions will be logged in the permanent audit trail.
              </p>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Mandatory Reason for Access:
                </label>
                <select
                  value={impersonateReason}
                  onChange={(e) => setImpersonateReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    background: '#FFFFFF',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="Customer Support Investigation">Customer Support Investigation</option>
                  <option value="Bug Reproduction & Ledger Diagnosis">Bug Reproduction & Ledger Diagnosis</option>
                  <option value="Billing & Account Inquiries">Billing & Account Inquiries</option>
                  <option value="Data Migration & Onboarding Assistance">Data Migration & Onboarding Assistance</option>
                  <option value="System Maintenance & Inspection">System Maintenance & Inspection</option>
                </select>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Ticket / Reference Note (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ticket #418 - customer balance check"
                  value={impersonateNotes}
                  onChange={(e) => setImpersonateNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  onClick={() => setImpersonateTarget(null)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#334155', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartImpersonate}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#0F766E',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Start Session & Enter →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Support Desk Reset Link Modal ── */}
        {resetModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
            <div style={{ background: '#FFFFFF', borderRadius: 16, maxWidth: 520, width: '100%', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#E0F2FE', color: '#0369A1', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <KeyRound size={24} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: '0 0 6px' }}>
                One-Click Password Reset Link
              </h3>
              <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: '0 0 16px' }}>
                Generated for <strong>{resetModal.username}</strong> ({resetModal.full_name || 'Owner'}). Send this secure link to the shop owner. It expires in 24 hours.
              </p>

              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: 8, border: '1px solid #CBD5E1', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <input
                  type="text"
                  readOnly
                  value={resetModal.reset_url}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    fontSize: 12,
                    color: '#0F172A',
                    fontFamily: 'monospace',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(resetModal.reset_url);
                    setCopiedLink(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: copiedLink ? '#16A34A' : '#0F766E',
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setResetModal(null)}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0F172A', color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
