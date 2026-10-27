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
  ExternalLink
} from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { LEGACY_TENANT_ID } from '../constants/tenant';

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
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    // If not superowner, bounce to home
    if (user && user.role !== 'superowner') {
      navigate('/');
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, tenantsRes] = await Promise.all([
        api.get('/superowner/stats'),
        api.get('/superowner/tenants')
      ]);

      if (statsRes?.success) setStats(statsRes.stats);
      if (tenantsRes?.success) setTenants(tenantsRes.tenants);
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

  const handleDeleteTenant = async (tenantId) => {
    setActionLoading(tenantId);
    try {
      const res = await api.delete(`/superowner/tenants/${tenantId}`);
      if (res?.success) {
        setTenants(prev => prev.filter(t => t.id !== tenantId));
        setConfirmDelete(null);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete tenant');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnterTenant = (tenant) => {
    enterTenant(tenant);
    navigate('/');
  };

  const filteredTenants = tenants.filter(t => 
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
                  ShopOS Control Panel
                </h1>
                <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0 0' }}>
                  SuperOwner Master Console & Multi-Tenant Management
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
              Refresh Data
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

          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 22px', border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Monthly Revenue (MRR)</span>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#0F766E', marginTop: 4 }}>
                  ${stats ? stats.monthlyRevenue : 0} <span style={{ fontSize: 14, color: '#64748B', fontWeight: 500 }}>/ mo</span>
                </div>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: '#CCFBF1', color: '#0F766E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={20} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>
              {stats?.entTenants || 0} Enterprise, {stats?.proTenants || 0} Pro
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
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Registered Businesses & Tenants</h2>
              <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>Manage all SaaS tenants, login as any business owner, or update status</p>
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
                  background: '#F8FAFC'
                }}
              />
            </div>
          </div>

          {/* Table Body */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '12px 20px' }}>Tenant Name</th>
                  <th style={{ padding: '12px 16px' }}>Plan</th>
                  <th style={{ padding: '12px 16px' }}>Joined</th>
                  <th style={{ padding: '12px 16px' }}>Last Active</th>
                  <th style={{ padding: '12px 16px' }}>Monthly Sales</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8' }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#0F766E' }} />
                      Loading tenants registry...
                    </td>
                  </tr>
                ) : filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
                      No matching business accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((t) => {
                    const isActive = t.is_active === 1;
                    const isBaseTenant = t.id === LEGACY_TENANT_ID;

                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.15s' }}>
                        
                        {/* Tenant Name & ID */}
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 14 }}>
                            {t.business_name}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748B', display: 'flex', gap: 8, marginTop: 2 }}>
                            <span style={{ fontFamily: 'monospace', color: '#0F766E' }}>ID: {t.id}</span>
                            <span>•</span>
                            <span>{t.owner_name || 'Owner'}</span>
                            {t.business_type && (
                              <>
                                <span>•</span>
                                <span style={{ textTransform: 'capitalize' }}>{t.business_type.replace('_', ' ')}</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Plan */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: t.plan === 'enterprise' ? '#EDE9FE' : t.plan === 'pro' ? '#E0F2FE' : '#F1F5F9',
                            color: t.plan === 'enterprise' ? '#7C3AED' : t.plan === 'pro' ? '#0369A1' : '#475569'
                          }}>
                            {t.plan}
                          </span>
                        </td>

                        {/* Joined Date */}
                        <td style={{ padding: '14px 16px', color: '#475569', fontSize: 12 }}>
                          {t.created_at ? new Date(t.created_at).toLocaleDateString('en-GB') : '—'}
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
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            
                            {/* Enter Tenant Button */}
                            <button
                              onClick={() => handleEnterTenant(t)}
                              title="Enter business dashboard as owner"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '6px 12px',
                                borderRadius: 6,
                                border: '1px solid #0F766E',
                                background: '#F0FDFA',
                                color: '#0F766E',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                            >
                              <span>Enter</span>
                              <ArrowRight size={13} />
                            </button>

                            {/* Suspend / Reactivate */}
                            <button
                              onClick={() => handleToggleStatus(t)}
                              disabled={actionLoading === t.id}
                              title={isActive ? 'Suspend Business' : 'Activate Business'}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '6px 10px',
                                borderRadius: 6,
                                border: '1px solid #CBD5E1',
                                background: '#FFFFFF',
                                color: isActive ? '#B45309' : '#15803D',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'pointer'
                              }}
                            >
                              <Power size={13} style={{ marginRight: 4 }} />
                              {isActive ? 'Suspend' : 'Activate'}
                            </button>

                            {/* Delete (Confirmation Required) */}
                            {!isBaseTenant && (
                              <button
                                onClick={() => setConfirmDelete(t)}
                                disabled={actionLoading === t.id}
                                title="Delete Tenant"
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

        {/* Delete Confirmation Modal */}
        {confirmDelete && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
            <div style={{ background: '#FFFFFF', borderRadius: 16, maxWidth: 440, width: '100%', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <AlertTriangle size={24} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>
                Delete "{confirmDelete.business_name}"?
              </h3>
              <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: '0 0 20px' }}>
                This will permanently delete this tenant, all staff users, products, sales, and purchases. This action cannot be reversed.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  onClick={() => setConfirmDelete(null)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#334155', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteTenant(confirmDelete.id)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
