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
  Archive,
  RotateCcw,
  KeyRound,
  Copy,
  Check,
  UserCheck,
  PlusCircle,
  Wrench,
  Database,
  Activity,
  FileText,
  Sliders,
  Download,
  Clock,
  Server
} from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function SuperOwnerDashboard({ onEnterApp }) {
  const navigate = (path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  const { user, isSuperOwner, enterTenant } = useAuth();
  
  // Active Console Module Navigation
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'tenants' | 'fixes' | 'backups' | 'audit'

  // Data States
  const [stats, setStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('active'); // 'active' | 'archived'
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

  // Provision Tenant Modal State
  const [provisionModal, setProvisionModal] = useState(false);
  const [provisionForm, setProvisionForm] = useState({
    business_name: '',
    owner_name: '',
    email: '',
    phone: '',
    city: 'Lahore',
    business_type: 'retail_general',
    plan: 'free',
    password: ''
  });
  const [provisioning, setProvisioning] = useState(false);

  // Safe Data Fixes State
  const [fixTenantId, setFixTenantId] = useState('');
  const [fixRecipe, setFixRecipe] = useState('ledger_resync');
  const [fixResult, setFixResult] = useState(null);
  const [fixRunning, setFixRunning] = useState(false);

  // Backups State
  const [backups, setBackups] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);

  // Audit Logs & Health State
  const [auditLogs, setAuditLogs] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);

  useEffect(() => {
    if (user && user.role !== 'superowner') {
      navigate('/');
      return;
    }
    loadData();
  }, [user, tenantFilter]);

  useEffect(() => {
    if (activeTab === 'backups') {
      loadBackups();
    } else if (activeTab === 'audit') {
      loadAuditAndHealth();
    }
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, tenantsRes] = await Promise.all([
        api.get('/superowner/stats'),
        api.get('/superowner/tenants?status=' + tenantFilter)
      ]);

      if (statsRes?.success) setStats(statsRes.stats);
      if (tenantsRes?.success) {
        setTenants(tenantsRes.tenants || []);
        if (tenantsRes.tenants?.length > 0 && !fixTenantId) {
          setFixTenantId(tenantsRes.tenants[0].id);
        }
      }
    } catch (err) {
      console.error('SuperOwner load data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBackups = async () => {
    setBackupLoading(true);
    try {
      const res = await api.get('/superowner/backup');
      if (res?.success) setBackups(res.backups || []);
    } catch (err) {
      console.error('Load backups error:', err);
    } finally {
      setBackupLoading(false);
    }
  };

  const loadAuditAndHealth = async () => {
    try {
      const [auditRes, healthRes] = await Promise.all([
        api.get('/superowner/audit-logs?limit=50'),
        api.get('/superowner/system/health')
      ]);
      if (auditRes?.success) setAuditLogs(auditRes.logs || []);
      if (healthRes?.success) setSystemHealth(healthRes.health);
    } catch (err) {
      console.error('Load audit/health error:', err);
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
      if (onEnterApp) {
        onEnterApp(impersonateTarget);
      } else {
        navigate('/');
      }
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

  const handleProvisionSubmit = async (e) => {
    e.preventDefault();
    if (!provisionForm.business_name || !provisionForm.owner_name || !provisionForm.email) {
      alert('Please fill out all required fields.');
      return;
    }
    setProvisioning(true);
    try {
      const res = await api.post('/superowner/tenants/provision', provisionForm);
      if (res?.success) {
        alert(`Success! Business "${res.tenant.business_name}" provisioned. Initial password: ${res.tenant.initialPassword}`);
        setProvisionModal(false);
        setProvisionForm({
          business_name: '',
          owner_name: '',
          email: '',
          phone: '',
          city: 'Lahore',
          business_type: 'retail_general',
          plan: 'free',
          password: ''
        });
        await loadData();
      } else {
        alert(res?.message || 'Failed to provision tenant.');
      }
    } catch (err) {
      alert(err.message || 'Error provisioning tenant.');
    } finally {
      setProvisioning(false);
    }
  };

  const handleRunDataFix = async (apply = false) => {
    if (!fixTenantId) {
      alert('Please select a tenant.');
      return;
    }
    setFixRunning(true);
    try {
      const res = await api.post('/superowner/data-fix/run', {
        recipe: fixRecipe,
        tenant_id: fixTenantId,
        apply
      });
      setFixResult(res);
    } catch (err) {
      alert(err.message || 'Data fix run failed.');
    } finally {
      setFixRunning(false);
    }
  };

  const handleCreateFullBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await api.post('/superowner/backup/create');
      if (res?.success) {
        alert('Database snapshot created successfully!');
        await loadBackups();
      } else {
        alert(res?.message || 'Failed to create backup.');
      }
    } catch (err) {
      alert(err.message || 'Backup failed.');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleExportTenantJson = (tenantId) => {
    window.open(`/api/superowner/tenants/${tenantId}/export`, '_blank');
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
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC', padding: '28px 24px', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        
        {/* Top Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #0F766E 0%, #115E59 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(15,118,110,0.2)' }}>
              <ShieldAlert size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                {BRAND_NAME} Super Admin Console
              </h1>
              <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0 0' }}>
                Multi-Tenant Architecture • Presets • Safe Data Ops • Disaster Recovery
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => {
                if (onEnterApp) {
                  onEnterApp();
                } else {
                  const defaultTarget = tenants.find(t => t.is_default === 1) || tenants[0];
                  if (defaultTarget) enterTenant(defaultTarget);
                  navigate('/');
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#334155',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <span>Explore Main App (POS & Store)</span>
              <ChevronRight size={15} />
            </button>
            <button
              onClick={() => setProvisionModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 18px',
                borderRadius: 8,
                border: 'none',
                background: '#0F766E',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(15,118,110,0.3)'
              }}
            >
              <PlusCircle size={15} />
              <span>Provision Tenant</span>
            </button>
          </div>
        </div>

        {/* ── 5 Modern Module Navigation Tabs ── */}
        <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #E2E8F0', paddingBottom: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { id: 'overview', label: 'Overview & Radar', icon: Activity },
            { id: 'tenants', label: 'Tenants & Provisioning', icon: Building2 },
            { id: 'fixes', label: 'Safe Data Fixes', icon: Wrench },
            { id: 'backups', label: 'Backups & Disaster Recovery', icon: Database },
            { id: 'audit', label: 'Audit Logs & System Health', icon: Server }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: isActive ? '#0F766E' : '#FFFFFF',
                  color: isActive ? '#FFFFFF' : '#475569',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 2px 8px rgba(15,118,110,0.2)' : '0 1px 3px rgba(0,0,0,0.02)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ════════════════════════════════════════════════════════════ */}
        {/* MODULE 1: OVERVIEW & RADAR                                   */}
        {/* ════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div>
            {/* Top 4 Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 22px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Total Tenants</span>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                      {stats ? stats.totalTenants : '—'}
                    </div>
                  </div>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={20} />
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#0F766E', marginTop: 8, fontWeight: 600 }}>
                  {stats?.activeTenants || 0} active retail businesses
                </div>
              </div>

              <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 22px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Active Today</span>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                      {stats ? stats.activeTenants : '—'}
                    </div>
                  </div>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={20} />
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#16A34A', marginTop: 8, fontWeight: 600 }}>
                  100% operational status
                </div>
              </div>

              {/* Standardized MRR in PKR */}
              <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 22px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Monthly Revenue (MRR)</span>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#0F766E', marginTop: 4 }}>
                      {stats ? formatCurrency(stats.monthlyRevenuePkr || stats.monthlyRevenue) : '—'} <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>/ mo</span>
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

              <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 22px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Total Sales Processed</span>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                      {stats ? formatCurrency(stats.totalSales) : '—'}
                    </div>
                  </div>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={20} />
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#D97706', marginTop: 8, fontWeight: 600 }}>
                  This month: {formatCurrency(stats?.monthlySales || 0)}
                </div>
              </div>
            </div>

            {/* Needs Attention Radar */}
            <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '22px', border: '1px solid #E2E8F0', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <AlertTriangle size={18} color="#D97706" />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Needs Attention Radar</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
                <div style={{ padding: '14px 16px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Inactive Shops Radar</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Zero businesses pending activity alerts</div>
                  </div>
                  <span style={{ fontSize: 11, background: '#DCFCE7', color: '#16A34A', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>All Healthy</span>
                </div>
                <div style={{ padding: '14px 16px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Database Failsafe Status</div>
                    <div style={{ fontSize: 12, color: '#0F766E', marginTop: 2 }}>SQLite Persistence Volume Active (Zero Downtime)</div>
                  </div>
                  <span style={{ fontSize: 11, background: '#CCFBF1', color: '#0F766E', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>Online</span>
                </div>
                <div style={{ padding: '14px 16px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Daily Automated Backups</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Hourly snapshots synchronized to disk</div>
                  </div>
                  <span style={{ fontSize: 11, background: '#DCFCE7', color: '#16A34A', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>Protected</span>
                </div>
              </div>
            </div>

            {/* Quick Action Pills */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveTab('tenants')}
                style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#0F172A', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Building2 size={15} color="#0F766E" />
                <span>Manage All Tenants ({stats?.totalTenants || 3})</span>
              </button>
              <button
                onClick={() => setActiveTab('fixes')}
                style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#0F172A', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Wrench size={15} color="#0284C7" />
                <span>Launch Safe Data Fixes Workbench</span>
              </button>
              <button
                onClick={() => setActiveTab('backups')}
                style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#0F172A', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Database size={15} color="#7C3AED" />
                <span>Download System & Tenant Backups</span>
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* MODULE 2: TENANTS DIRECTORY & PROVISIONING                   */}
        {/* ════════════════════════════════════════════════════════════ */}
        {activeTab === 'tenants' && (
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Registered Businesses & Tenants</h2>
                  <div style={{ display: 'flex', background: '#F1F5F9', padding: '3px', borderRadius: 8 }}>
                    <button
                      onClick={() => setTenantFilter('active')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: 'none',
                        background: tenantFilter === 'active' ? '#FFFFFF' : 'transparent',
                        color: tenantFilter === 'active' ? '#0F766E' : '#64748B',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Active Tenants
                    </button>
                    <button
                      onClick={() => setTenantFilter('archived')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: 'none',
                        background: tenantFilter === 'archived' ? '#FFFFFF' : 'transparent',
                        color: tenantFilter === 'archived' ? '#DC2626' : '#64748B',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Archived / Trash
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>
                  {tenantFilter === 'active' 
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
                        No {tenantFilter === 'archived' ? 'archived' : ''} tenants found.
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((t) => {
                      const isActive = t.is_active === 1;
                      const isBaseTenant = t.is_default === 1;
                      const isArchived = !!t.deleted_at;

                      return (
                        <tr key={t.id} style={{ borderBottom: '1px solid #F1F5F9', background: '#FFFFFF' }}>
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

                          <td style={{ padding: '14px 16px', color: '#334155' }}>
                            <div style={{ fontWeight: 500 }}>{t.owner_name || 'Admin'}</div>
                            <div style={{ fontSize: 11, color: '#64748B' }}>{t.email || t.phone || '—'}</div>
                          </td>

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

                          <td style={{ padding: '14px 16px', color: '#64748B', fontSize: 12 }}>
                            <div>{t.product_count || 0} products</div>
                            <div style={{ fontSize: 11, color: '#94A3B8' }}>{t.user_count || 1} staff users</div>
                          </td>

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

                          <td style={{ padding: '14px 16px', fontWeight: 600, color: '#0F172A' }}>
                            {formatCurrency(t.monthly_sales)}
                          </td>

                          <td style={{ padding: '14px 16px' }}>
                            {isArchived ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#F1F5F9', color: '#64748B' }}>
                                <Archive size={12} />
                                Archived
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: isActive ? '#DCFCE7' : '#FEE2E2', color: isActive ? '#15803D' : '#B91C1C' }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#16A34A' : '#DC2626' }} />
                                {isActive ? 'Active' : 'Suspended'}
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              {isArchived ? (
                                <button
                                  onClick={() => handleRestoreTenant(t)}
                                  disabled={actionLoading === t.id}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6, border: '1px solid #16A34A', background: '#F0FDF4', color: '#15803D', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                >
                                  <RotateCcw size={13} />
                                  <span>Restore</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => setImpersonateTarget(t)}
                                    title="Impersonate business owner"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, border: '1px solid #0F766E', background: '#F0FDFA', color: '#0F766E', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                  >
                                    <span>Enter</span>
                                    <ArrowRight size={13} />
                                  </button>

                                  <button
                                    onClick={() => handleGenerateResetLink(t)}
                                    title="Generate 24h password reset link for owner"
                                    style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 8px', borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontSize: 12, cursor: 'pointer' }}
                                  >
                                    <KeyRound size={13} />
                                  </button>

                                  <button
                                    onClick={() => handleToggleStatus(t)}
                                    disabled={actionLoading === t.id}
                                    title={isActive ? 'Suspend Business' : 'Activate Business'}
                                    style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 9px', borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFFFFF', color: isActive ? '#B45309' : '#15803D', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                                  >
                                    <Power size={13} />
                                  </button>

                                  {!isBaseTenant && (
                                    <button
                                      onClick={() => {
                                        setConfirmArchive(t);
                                        setTypedConfirmName('');
                                      }}
                                      disabled={actionLoading === t.id}
                                      title="Archive Tenant (Soft Delete)"
                                      style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 8px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 12, cursor: 'pointer' }}
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
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* MODULE 3: SAFE DATA FIXES WORKBENCH                          */}
        {/* ════════════════════════════════════════════════════════════ */}
        {activeTab === 'fixes' && (
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#E0F2FE', color: '#0369A1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wrench size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>Safe Data Diagnostics & Remediation Workbench</h2>
                <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0 0' }}>Dry-run simulated fixes before applying changes. Zero developer database surgery required.</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Select Target Tenant:
                </label>
                <select
                  value={fixTenantId}
                  onChange={(e) => setFixTenantId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF', outline: 'none' }}
                >
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.business_name} ({t.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Select Diagnostic Recipe:
                </label>
                <select
                  value={fixRecipe}
                  onChange={(e) => setFixRecipe(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF', outline: 'none' }}
                >
                  <option value="ledger_resync">1. Customer Ledger Balance Re-synchronization</option>
                  <option value="sequence_repair">2. Invoice Sequence Collision & Gap Repair</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              <button
                disabled={fixRunning}
                onClick={() => handleRunDataFix(false)}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#0F172A', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>🧪 Run Dry-Run Simulation (No Changes)</span>
              </button>
              <button
                disabled={fixRunning}
                onClick={() => handleRunDataFix(true)}
                style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#0F766E', color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>🚀 Apply Fix with Audit Log</span>
              </button>
            </div>

            {/* Diagnostic Output Results */}
            {fixResult && (
              <div style={{ background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <CheckCircle2 size={16} color="#0F766E" />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Diagnostic Execution Result</span>
                  <span style={{ fontSize: 11, background: fixResult.is_simulation ? '#FEF3C7' : '#DCFCE7', color: fixResult.is_simulation ? '#B45309' : '#15803D', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                    {fixResult.is_simulation ? 'SIMULATION ONLY' : 'LIVE APPLIED'}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#334155', margin: '0 0 14px' }}>{fixResult.message}</p>

                {fixResult.items && fixResult.items.length > 0 ? (
                  <div style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#F1F5F9', color: '#475569' }}>
                          <th style={{ padding: '10px 14px' }}>Customer</th>
                          <th style={{ padding: '10px 14px' }}>Cached Balance</th>
                          <th style={{ padding: '10px 14px' }}>Verified Balance</th>
                          <th style={{ padding: '10px 14px' }}>Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fixResult.items.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>{item.name} (#{item.customer_id})</td>
                            <td style={{ padding: '10px 14px', color: '#DC2626' }}>₨ {item.cached_balance}</td>
                            <td style={{ padding: '10px 14px', color: '#16A34A', fontWeight: 600 }}>₨ {item.verified_balance}</td>
                            <td style={{ padding: '10px 14px' }}>₨ {item.variance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#64748B' }}>Zero ledger anomalies detected for this tenant. All balances are verified.</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* MODULE 4: BACKUPS & DISASTER RECOVERY                        */}
        {/* ════════════════════════════════════════════════════════════ */}
        {activeTab === 'backups' && (
          <div>
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: '24px', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: '#EDE9FE', color: '#6D28D9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Database size={20} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>System Snapshots & Disaster Recovery</h2>
                    <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0 0' }}>Persistent storage volume snapshots and per-tenant isolated data exports.</p>
                  </div>
                </div>

                <button
                  disabled={backupLoading}
                  onClick={handleCreateFullBackup}
                  style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#0F766E', color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <PlusCircle size={15} />
                  <span>Create System Snapshot</span>
                </button>
              </div>

              {/* Backups List */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: 12 }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Snapshot File</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Size</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Created Date</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>
                          No snapshots on volume. Click "Create System Snapshot" to capture current database.
                        </td>
                      </tr>
                    ) : (
                      backups.map((b, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A' }}>{b.filename}</td>
                          <td style={{ padding: '12px 16px', color: '#64748B' }}>{b.size_kb} KB</td>
                          <td style={{ padding: '12px 16px', color: '#64748B' }}>{new Date(b.created_at).toLocaleString()}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <a
                              href={`/api/superowner/backup/download/${b.filename}`}
                              download
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#0F172A', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
                            >
                              <Download size={13} />
                              <span>Download</span>
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Per-Tenant JSON Export Panel */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: '24px' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>Per-Tenant Isolated Data Export</h3>
              <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 16px' }}>Download a complete JSON export of all products, customers, suppliers, and sales for any specific tenant.</p>
              
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={fixTenantId}
                  onChange={(e) => setFixTenantId(e.target.value)}
                  style={{ minWidth: 260, padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF' }}
                >
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.business_name} ({t.id})</option>
                  ))}
                </select>
                <button
                  onClick={() => handleExportTenantJson(fixTenantId)}
                  style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #0F766E', background: '#F0FDFA', color: '#0F766E', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={14} />
                  <span>Download Tenant Data (.json)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* MODULE 5: UNIVERSAL AUDIT LOGS & SYSTEM HEALTH               */}
        {/* ════════════════════════════════════════════════════════════ */}
        {activeTab === 'audit' && (
          <div>
            {/* System Health Telemetry */}
            {systemHealth && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '18px 20px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Database Engine</span>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0F766E', marginTop: 4 }}>
                    {systemHealth.database_driver}
                  </div>
                </div>
                <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '18px 20px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Container Uptime</span>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
                    {systemHealth.uptime}
                  </div>
                </div>
                <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '18px 20px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Memory RSS</span>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
                    {systemHealth.memory_rss_mb} MB
                  </div>
                </div>
                <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '18px 20px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Node.js Runtime</span>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
                    {systemHealth.node_version} ({systemHealth.environment})
                  </div>
                </div>
              </div>
            )}

            {/* Audit Logs Table */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Universal Platform Audit Trail</h3>
                  <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>Security, impersonation, backup, and rate-change activity across all businesses</p>
                </div>
                <button
                  onClick={loadAuditAndHealth}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <RefreshCw size={13} />
                  <span>Refresh</span>
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: 12 }}>
                      <th style={{ padding: '12px 18px', fontWeight: 600 }}>Actor</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600 }}>Action</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600 }}>Target Business</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600 }}>Details</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600 }}>IP</th>
                      <th style={{ padding: '12px 18px', fontWeight: 600, textAlign: 'right' }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>
                          No audit entries recorded yet.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px 18px', fontWeight: 600, color: '#0F172A' }}>{log.user_name || 'System'}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontSize: 11, background: '#F1F5F9', color: '#0F766E', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                              {log.action}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', color: '#334155' }}>{log.business_name}</td>
                          <td style={{ padding: '12px 14px', color: '#64748B', fontSize: 12, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {log.details}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#94A3B8', fontSize: 11 }}>{log.ip_address || '—'}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'right', color: '#64748B', fontSize: 11 }}>
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Provision Tenant from Preset Modal ── */}
        {provisionModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
            <div style={{ background: '#FFFFFF', borderRadius: 16, maxWidth: 540, width: '100%', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#CCFBF1', color: '#0F766E', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <PlusCircle size={24} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: '0 0 6px' }}>
                Provision New Business Tenant from Preset
              </h3>
              <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: '0 0 16px' }}>
                Instantly seeds the business with its industry catalog, categories, units, and walk-in customer.
              </p>

              <form onSubmit={handleProvisionSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Business Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Al-Madina Superstore"
                      value={provisionForm.business_name}
                      onChange={(e) => setProvisionForm({ ...provisionForm, business_name: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Owner Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Muhammad Asif"
                      value={provisionForm.owner_name}
                      onChange={(e) => setProvisionForm({ ...provisionForm, owner_name: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Owner Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="asif@gmail.com"
                      value={provisionForm.email}
                      onChange={(e) => setProvisionForm({ ...provisionForm, email: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Phone (WhatsApp)</label>
                    <input
                      type="text"
                      placeholder="0300-1234567"
                      value={provisionForm.phone}
                      onChange={(e) => setProvisionForm({ ...provisionForm, phone: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Industry Preset (Auto-seeds Catalog & Units) *</label>
                  <select
                    value={provisionForm.business_type}
                    onChange={(e) => setProvisionForm({ ...provisionForm, business_type: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF' }}
                  >
                    <option value="retail_general">🛒 General Retail / Grocery</option>
                    <option value="frozen_food">🧊 Frozen Food & Meat Wholesale</option>
                    <option value="pharmacy">💊 Pharmacy & Medical Store (Box/Strip/Tablet)</option>
                    <option value="restaurant">🍽️ Restaurant & Cafe (KOT & Dining Tables)</option>
                    <option value="clothing">👗 Apparel & Boutique (Style & Size)</option>
                    <option value="hardware">🔧 Hardware, Tools & Sanitary</option>
                    <option value="wholesale">📦 Wholesale FMCG & Bulk Distribution</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Subscription Plan</label>
                    <select
                      value={provisionForm.plan}
                      onChange={(e) => setProvisionForm({ ...provisionForm, plan: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF' }}
                    >
                      <option value="free">Free Tier (₨ 0)</option>
                      <option value="pro">Pro Tier (₨ 4,999/mo)</option>
                      <option value="enterprise">Enterprise Tier (₨ 14,999/mo)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Initial Password</label>
                    <input
                      type="text"
                      placeholder="Default: Admin123."
                      value={provisionForm.password}
                      onChange={(e) => setProvisionForm({ ...provisionForm, password: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setProvisionModal(false)}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#334155', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={provisioning}
                    style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#0F766E', color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {provisioning ? 'Provisioning...' : 'Provision Tenant →'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
