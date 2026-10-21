import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Database,
  Download,
  RotateCcw,
  Save,
  CheckCircle,
  RefreshCw,
  Edit2,
  Trash2,
  AlertTriangle,
  HardDrive,
  Printer,
  Package,
  ShieldCheck,
  CreditCard,
  Zap,
  Check,
  Building,
  Image as ImageIcon,
  ArrowRight,
  Sparkles,
  Users as UsersIcon,
  Receipt
} from 'lucide-react';
import { api } from '../utils/api';
import { formatDate, formatDateTime } from '../utils/formatters';
import { applyTheme as applyThemeHelper } from '../utils/theme';
import { useAuth } from '../context/AuthContext';
import UsersTab from './Users';

const BUSINESS_TYPE_LABELS = {
  frozen_food: { name: 'Frozen Food', icon: '🧊' },
  retail_general: { name: 'General Retail', icon: '🛒' },
  clothing: { name: 'Clothing & Apparel', icon: '👕' },
  pharmacy: { name: 'Pharmacy & Medical', icon: '💊' },
  restaurant: { name: 'Restaurant / Food', icon: '🍕' },
  hardware: { name: 'Hardware & Tools', icon: '🔧' },
  electronics: { name: 'Electronics & Mobiles', icon: '📱' },
  wholesale: { name: 'Wholesale Distributor', icon: '📦' }
};

export default function Settings({ initialTab: propInitialTab }) {
  const { role, isAdmin, tenant, plan, updateTenantInfo } = useAuth();

  const parseTabFromLocation = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) {
        if (tabParam === 'business-profile' || tabParam === 'profile') return 'business-profile';
        if (tabParam === 'invoice' || tabParam === 'invoices') return 'invoice';
        if (tabParam === 'inventory') return 'inventory';
        if (tabParam === 'staff' || tabParam === 'users') return 'staff';
        if (tabParam === 'billing' || tabParam === 'plan') return 'billing';
        if (tabParam === 'backup' || tabParam === 'backups') return 'backup';
      }
    } catch (_) {}
    if (propInitialTab) {
      if (propInitialTab === 'profile') return 'business-profile';
      if (propInitialTab === 'users') return 'staff';
      return propInitialTab;
    }
    return 'business-profile';
  };

  const [activeTab, setActiveTab] = useState(parseTabFromLocation);

  useEffect(() => {
    const syncTab = (e) => {
      if (e?.detail) {
        const d = e.detail;
        if (d === 'business-profile' || d === 'profile') setActiveTab('business-profile');
        else if (d === 'invoice' || d === 'invoices') setActiveTab('invoice');
        else if (d === 'inventory') setActiveTab('inventory');
        else if (d === 'staff' || d === 'users') setActiveTab('staff');
        else if (d === 'billing' || d === 'plan') setActiveTab('billing');
        else if (d === 'backup' || d === 'backups') setActiveTab('backup');
        return;
      }
      setActiveTab(parseTabFromLocation());
    };

    window.addEventListener('settings_tab_change', syncTab);
    window.addEventListener('popstate', syncTab);
    return () => {
      window.removeEventListener('settings_tab_change', syncTab);
      window.removeEventListener('popstate', syncTab);
    };
  }, []);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    try {
      const url = new URL(window.location.href);
      url.pathname = '/settings';
      url.searchParams.set('tab', tabId);
      window.history.replaceState({}, '', url.toString());
    } catch (_) {}
  };

  const [settings, setSettings] = useState({
    shop_name: tenant?.business_name || 'Latif Traders',
    tagline: 'Business Management',
    phone: '',
    email: '',
    address: '',
    logo_url: '',
    currency: 'PKR',
    currency_symbol: '₨',
    near_expiry_days: '15',
    allow_negative_stock: 'false',
    invoice_footer: '',
    print_default_format: 'thermal',
    theme: localStorage.getItem('lt_theme') || 'light'
  });

  const [billingInfo, setBillingInfo] = useState(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradingPlan, setUpgradingPlan] = useState(false);

  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [backupSuccess, setBackupSuccess] = useState('');
  const [downloadingBackup, setDownloadingBackup] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sRes, bRes] = await Promise.all([
        api.get('/settings'),
        api.get('/backups')
      ]);

      if (sRes.success) {
        const currentLocal = localStorage.getItem('lt_theme');
        const themeVal = currentLocal || sRes.settings.theme || 'light';
        setSettings(prev => ({ ...prev, ...sRes.settings, theme: themeVal }));
        applyThemeHelper(themeVal);

        if (sRes.settings.shop_name) localStorage.setItem('lt_shop_name', sRes.settings.shop_name);
        if (sRes.settings.tagline) localStorage.setItem('lt_shop_tagline', sRes.settings.tagline);
        if (sRes.settings.phone) localStorage.setItem('lt_phone', sRes.settings.phone);
        if (sRes.settings.email) localStorage.setItem('lt_email', sRes.settings.email);
        if (sRes.settings.address) localStorage.setItem('lt_address', sRes.settings.address);
      }
      if (bRes.success) setBackups(bRes.backups);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadBilling = async () => {
    try {
      setLoadingBilling(true);
      const res = await api.get('/settings/billing');
      if (res?.success) {
        setBillingInfo(res.billing);
      }
    } catch (err) {
      console.error('Failed to load billing details:', err);
    } finally {
      setLoadingBilling(false);
    }
  };

  useEffect(() => {
    loadData();
    loadBilling();

    const handleThemeChanged = (e) => {
      const newTheme = e.detail || localStorage.getItem('lt_theme') || 'light';
      setSettings(prev => ({ ...prev, theme: newTheme }));
    };
    window.addEventListener('theme_changed', handleThemeChanged);
    return () => window.removeEventListener('theme_changed', handleThemeChanged);
  }, []);

  const handleSaveSettings = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      setSaving(true);
      setSaveSuccess('');
      const res = await api.post('/settings', settings);
      if (res.success) {
        setSaveSuccess('Settings saved successfully.');
        if (settings.theme) {
          applyThemeHelper(settings.theme);
        }
        if (settings.shop_name) {
          localStorage.setItem('lt_shop_name', settings.shop_name);
          document.title = `${settings.shop_name} - ShopOS Business Management`;
          updateTenantInfo({ business_name: settings.shop_name, logo_url: settings.logo_url, business_type: settings.business_type });
        } else if (settings.business_type) {
          updateTenantInfo({ business_type: settings.business_type });
        }
        if (settings.tagline) localStorage.setItem('lt_shop_tagline', settings.tagline);
        if (settings.phone) localStorage.setItem('lt_phone', settings.phone);
        if (settings.email) localStorage.setItem('lt_email', settings.email);
        if (settings.address) localStorage.setItem('lt_address', settings.address);
        window.dispatchEvent(new CustomEvent('settings_updated', { detail: settings }));
        setTimeout(() => setSaveSuccess(''), 4000);
      }
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePlanUpgrade = async (newPlan) => {
    try {
      setUpgradingPlan(true);
      const res = await api.post('/settings/upgrade-plan', { plan: newPlan });
      if (res.success) {
        updateTenantInfo({ plan: newPlan });
        await loadBilling();
        setShowUpgradeModal(false);
        setSaveSuccess(`Subscription plan updated to ${newPlan.toUpperCase()}!`);
        setTimeout(() => setSaveSuccess(''), 4000);
      }
    } catch (err) {
      alert('Failed to upgrade plan: ' + err.message);
    } finally {
      setUpgradingPlan(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setBackupSuccess('');
      const res = await api.post('/backups/create');
      if (res.success) {
        setBackupSuccess(`Backup created successfully: ${res.backup.filename}`);
        loadData();
        setTimeout(() => setBackupSuccess(''), 5000);
      }
    } catch (err) {
      alert('Backup failed: ' + err.message);
    }
  };

  const handleDownloadBackup = async (filename) => {
    try {
      setDownloadingBackup(filename);
      const token = localStorage.getItem('lt_token');
      const rawBase = import.meta.env.VITE_API_URL || '';
      const apiBase = rawBase ? `${rawBase.replace(/\/$/, '')}/api` : '/api';

      const res = await fetch(`${apiBase}/backups/download/${encodeURIComponent(filename)}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        let errMsg = `Download failed with status ${res.status}`;
        try {
          const errData = await res.json();
          if (errData.message) errMsg = errData.message;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(link);
    } catch (err) {
      alert('Failed to download database backup: ' + err.message);
    } finally {
      setDownloadingBackup(null);
    }
  };

  const formatBackupDisplayName = (filename, createdAt) => {
    if (!filename) return '-';
    if (createdAt) {
      const d = new Date(createdAt);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `Backup — ${dd}/${mm}/${yyyy} at ${hh}:${min}`;
      }
    }
    return filename;
  };

  const lastBackup = backups.length > 0 ? formatBackupDisplayName(backups[0].filename, backups[0].created_at).replace(/^Backup — /, '') : 'Never';
  const totalBackupSizeKb = backups.reduce((acc, b) => acc + (Number(b.size_kb) || 0), 0);
  const totalBackupSizeFormatted = totalBackupSizeKb >= 1024
    ? `${(totalBackupSizeKb / 1024).toFixed(1)} MB`
    : `${totalBackupSizeKb.toFixed(0)} KB`;

  const bType = settings.business_type || tenant?.business_type || 'frozen_food';
  const currentBusinessType = BUSINESS_TYPE_LABELS[bType] || { name: 'Retail / General', icon: '🏬' };

  // SaaS Tab definitions (REORDERED per user specification)
  const tabList = [
    { id: 'business-profile', label: 'Business Profile', icon: '🏪' },
    { id: 'invoice', label: 'Invoice & Receipts', icon: '🖨️' },
    { id: 'inventory', label: 'Inventory Policy', icon: '📦' },
    { id: 'staff', label: 'Staff & Access', icon: '👥' },
    { id: 'billing', label: 'My Plan & Billing', icon: '💳' },
    { id: 'backup', label: 'Backup & Recovery', icon: '💾' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
      {/* SUCCESS NOTIFICATIONS */}
      {saveSuccess && (
        <div style={{
          padding: '0.85rem 1.15rem',
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          color: '#065f46',
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle size={18} color="#10b981" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {backupSuccess && (
        <div style={{
          padding: '0.85rem 1.15rem',
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          color: '#065f46',
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle size={18} color="#10b981" />
          <span>{backupSuccess}</span>
        </div>
      )}

      {/* PAGE HEADER */}
      <div className="page-header-container" style={{ marginBottom: '0.25rem' }}>
        <div>
          <h1 className="page-header-title" style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: '0 0 4px 0' }}>
            Shop Settings & Subscription
          </h1>
          <p className="page-header-subtitle" style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
            Manage store profile, subscription tier, receipt layouts, warehouse policies, and data backups
          </p>
        </div>
      </div>

      {/* HORIZONTAL TABS BAR (Scrollable with edge fade hint) */}
      <div style={{ position: 'relative', width: '100%' }}>
        <div
          className="hide-scrollbar"
          style={{
            display: 'flex',
            gap: '2px',
            borderBottom: '1px solid #E5E7EB',
            background: 'transparent',
            padding: '0',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {tabList.map(tab => {
            const isActive = activeTab === tab.id || (tab.id === 'business-profile' && activeTab === 'profile') || (tab.id === 'staff' && activeTab === 'users');
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                style={{
                  height: '40px',
                  padding: '0 16px',
                  fontSize: '13px',
                  borderRadius: '8px 8px 0 0',
                  color: isActive ? '#0F766E' : '#6B7280',
                  background: isActive ? '#FFFFFF' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #0F766E' : '2px solid transparent',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginRight: '2px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#F4F6F9';
                    e.currentTarget.style.color = '#374151';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#6B7280';
                  }
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.id === 'billing' && plan === 'free' && (
                  <span style={{
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: '#fef3c7',
                    color: '#b45309',
                    fontWeight: 700
                  }}>
                    Free Tier
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right edge fade gradient hint */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: '1px',
            width: '32px',
            background: 'linear-gradient(to right, rgba(248, 250, 252, 0) 0%, rgba(248, 250, 252, 0.95) 100%)',
            pointerEvents: 'none',
            borderRadius: '0 8px 0 0'
          }}
        />
      </div>

      {/* ═════════ TAB 1: BUSINESS PROFILE ═════════ */}
      {(activeTab === 'business-profile' || activeTab === 'profile') && (
        <div className="card" style={{ padding: '1.5rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.85rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #A7F3D0' }}>
                <Sliders size={18} color="#059669" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: '#0F172A' }}>Business Profile & Identity</h3>
                <p style={{ fontSize: '0.785rem', color: '#64748B', margin: '2px 0 0 0' }}>
                  Public business details printed on receipts, customer invoices, and reports.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="btn-sadax-teal"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 18px', fontSize: '13px', borderRadius: '8px' }}
            >
              <Save size={15} />
              <span>{saving ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Business Type & Custom Application Setup */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '26px' }}>{currentBusinessType.icon}</span>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>Registered Industry / Business Type</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{currentBusinessType.name}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <select
                  className="form-control"
                  style={{ height: '34px', fontSize: '12px', borderRadius: '6px', padding: '0 8px', background: '#ffffff', minWidth: '170px' }}
                  value={settings.business_type || tenant?.business_type || 'frozen_food'}
                  onChange={(e) => setSettings({ ...settings, business_type: e.target.value })}
                >
                  {Object.entries(BUSINESS_TYPE_LABELS).map(([key, val]) => (
                    <option key={key} value={key}>{val.icon} {val.name}</option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '5px 12px', borderRadius: '6px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  ✓ Dedicated Custom Application
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                  Shop / Business Name *
                </label>
                <input
                  type="text"
                  className="form-control"
                  style={{ height: '38px', fontSize: '13px', borderRadius: '8px' }}
                  required
                  value={settings.shop_name}
                  onChange={(e) => setSettings({ ...settings, shop_name: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                  Tagline / Subtitle
                </label>
                <input
                  type="text"
                  className="form-control"
                  style={{ height: '38px', fontSize: '13px', borderRadius: '8px' }}
                  value={settings.tagline}
                  onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                  Logo URL / Image Link
                </label>
                <input
                  type="text"
                  className="form-control"
                  style={{ height: '38px', fontSize: '13px', borderRadius: '8px' }}
                  placeholder="https://example.com/logo.png"
                  value={settings.logo_url || ''}
                  onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                  Contact Phone Numbers
                </label>
                <input
                  type="text"
                  className="form-control"
                  style={{ height: '38px', fontSize: '13px', borderRadius: '8px' }}
                  placeholder="+92 300 1234567"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                  Official Email Address
                </label>
                <input
                  type="email"
                  className="form-control"
                  style={{ height: '38px', fontSize: '13px', borderRadius: '8px' }}
                  placeholder="contact@yourbusiness.com"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                  System Appearance Theme
                </label>
                <select
                  className="form-control"
                  style={{ height: '38px', fontSize: '13px', borderRadius: '8px' }}
                  value={settings.theme || 'light'}
                  onChange={(e) => {
                    const newTheme = e.target.value;
                    setSettings(prev => ({ ...prev, theme: newTheme }));
                    applyThemeHelper(newTheme);
                    api.post('/settings', { theme: newTheme }).catch(() => {});
                  }}
                >
                  <option value="light">☀️ Classic Light (ShopOS Blue)</option>
                  <option value="dark">🌙 Midnight Dark (OLED Slate)</option>
                  <option value="emerald">🍃 Emerald Green (Fresh Business)</option>
                  <option value="indigo">🔮 Royal Indigo (Modern Tech)</option>
                </select>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                  Choose from 4 custom business themes tailored for eye comfort and aesthetics.
                </div>
              </div>

              <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                  Physical Shop / Warehouse Address
                </label>
                <input
                  type="text"
                  className="form-control"
                  style={{ height: '38px', fontSize: '13px', borderRadius: '8px' }}
                  placeholder="Shop #, Market, City, Pakistan"
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                />
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ═════════ TAB 2: INVOICE & RECEIPTS ═════════ */}
      {activeTab === 'invoice' && (
        <div className="card" style={{ padding: '1.5rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.85rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #BBF7D0' }}>
                <Printer size={18} color="#16A34A" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: '#0F172A' }}>Invoice & Thermal Receipts</h3>
                <p style={{ fontSize: '0.785rem', color: '#64748B', margin: '2px 0 0 0' }}>
                  Configure print slip templates, default print engines, currency signs, and footer text.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="btn-sadax-teal"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 18px', fontSize: '13px', borderRadius: '8px' }}
            >
              <Save size={15} />
              <span>{saving ? 'Saving...' : 'Save Invoice Settings'}</span>
            </button>
          </div>

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                  Default Print Format
                </label>
                <select
                  className="form-control"
                  style={{ height: '38px', fontSize: '13px', borderRadius: '8px' }}
                  value={settings.print_default_format || 'thermal'}
                  onChange={(e) => setSettings({ ...settings, print_default_format: e.target.value })}
                >
                  <option value="thermal">Thermal POS Receipt (80mm Roll)</option>
                  <option value="standard">Full Sheet / A4 Invoice</option>
                  <option value="half">Half Sheet / A5 Receipt</option>
                </select>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                  Used automatically when printing receipts directly after checkout.
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                  Currency Display Symbol
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-control"
                    style={{ height: '38px', fontSize: '13px', borderRadius: '8px' }}
                    placeholder="PKR"
                    value={settings.currency || 'PKR'}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  />
                  <input
                    type="text"
                    className="form-control"
                    style={{ height: '38px', fontSize: '13px', borderRadius: '8px' }}
                    placeholder="₨"
                    value={settings.currency_symbol || '₨'}
                    onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                  Receipt / Invoice Footer Disclaimer
                </label>
                <textarea
                  className="form-control"
                  rows="3"
                  style={{ fontSize: '13px', borderRadius: '8px', padding: '10px 12px' }}
                  placeholder="Thank you message, warranty policy, or return terms printed at the bottom of bills..."
                  value={settings.invoice_footer}
                  onChange={(e) => setSettings({ ...settings, invoice_footer: e.target.value })}
                />
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ═════════ TAB 3: INVENTORY POLICY ═════════ */}
      {activeTab === 'inventory' && (
        <div className="card" style={{ padding: '1.5rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.85rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#F0F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #BAE6FD' }}>
                <Package size={18} color="#0284C7" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: '#0F172A' }}>Warehouse & Inventory Policies</h3>
                <p style={{ fontSize: '0.785rem', color: '#64748B', margin: '2px 0 0 0' }}>
                  Safety thresholds, batch expiry warnings, and negative balance protections.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="btn-sadax-teal"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 18px', fontSize: '13px', borderRadius: '8px' }}
            >
              <Save size={15} />
              <span>{saving ? 'Saving...' : 'Save Policies'}</span>
            </button>
          </div>

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                  Near-Expiry Alert Warning (Days)
                </label>
                <input
                  type="number"
                  className="form-control"
                  style={{ height: '38px', fontSize: '13px', borderRadius: '8px' }}
                  min="1"
                  max="90"
                  value={settings.near_expiry_days}
                  onChange={(e) => setSettings({ ...settings, near_expiry_days: e.target.value })}
                />
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                  Lots expiring within <strong>{settings.near_expiry_days || 15} days</strong> trigger warning badges.
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                  Negative Stock Depletion Policy
                </label>
                <select
                  className="form-control"
                  style={{ height: '38px', fontSize: '13px', borderRadius: '8px' }}
                  value={settings.allow_negative_stock}
                  onChange={(e) => setSettings({ ...settings, allow_negative_stock: e.target.value })}
                >
                  <option value="false">Strictly Blocked (Recommended — No overselling)</option>
                  <option value="true">Allowed (Permit sales below zero stock)</option>
                </select>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                  Prevent POS sales from completing when on-hand stock is insufficient.
                </div>
              </div>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px 16px', fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
              💡 <strong>FIFO Batch Tracking:</strong> The system automatically rotates older product lots first when sales are made at POS. Batches reaching expiry before depletion will be flagged in the Inventory tab for immediate clearance or adjustment.
            </div>
          </form>
        </div>
      )}

      {/* ═════════ TAB 4: STAFF & ACCESS ═════════ */}
      {(activeTab === 'staff' || activeTab === 'users') && (
        <UsersTab />
      )}

      {/* ═════════ TAB 5: MY PLAN & BILLING ═════════ */}
      {activeTab === 'billing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Current Subscription Card */}
          <div className="card" style={{ padding: '1.75rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                    {billingInfo?.plan_name || (plan === 'pro' ? 'Pro Plan' : (plan === 'enterprise' ? 'Enterprise Plan' : 'Free Forever Plan'))}
                  </h2>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    background: plan === 'pro' ? '#e0f2fe' : (plan === 'enterprise' ? '#f3e8ff' : '#f1f5f9'),
                    color: plan === 'pro' ? '#0369a1' : (plan === 'enterprise' ? '#7e22ce' : '#475569'),
                    border: `1px solid ${plan === 'pro' ? '#bae6fd' : (plan === 'enterprise' ? '#e9d5ff' : '#e2e8f0')}`
                  }}>
                    Active Subscription
                  </span>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  {plan === 'free' ? 'Single user account with basic limits' : 'Full-featured multi-user cloud workspace'}
                  {billingInfo?.plan_expires_at ? ` • Valid until ${formatDate(billingInfo.plan_expires_at)}` : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(14, 165, 233, 0.35)'
                }}
              >
                <Sparkles size={16} />
                <span>{plan === 'free' ? 'Upgrade to Pro' : 'Change Plan'}</span>
              </button>
            </div>

            {/* Quota Usage Meters */}
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
              Resource Quota & Usage
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '1.75rem' }}>
              {/* Products meter */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, color: '#475569' }}>Active Products</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                    {billingInfo?.usage?.products?.used || 0} / {billingInfo?.usage?.products?.limit === 'unlimited' ? '∞ Unlimited' : (billingInfo?.usage?.products?.limit || 50)}
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, billingInfo?.usage?.products?.pct || 0)}%`,
                    height: '100%',
                    background: (billingInfo?.usage?.products?.pct || 0) >= 90 ? '#ef4444' : '#0ea5e9'
                  }} />
                </div>
              </div>

              {/* Invoices meter */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, color: '#475569' }}>Invoices This Month</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                    {billingInfo?.usage?.invoices_this_month?.used || 0} / {billingInfo?.usage?.invoices_this_month?.limit === 'unlimited' ? '∞ Unlimited' : (billingInfo?.usage?.invoices_this_month?.limit || 100)}
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, billingInfo?.usage?.invoices_this_month?.pct || 0)}%`,
                    height: '100%',
                    background: (billingInfo?.usage?.invoices_this_month?.pct || 0) >= 90 ? '#ef4444' : '#10b981'
                  }} />
                </div>
              </div>

              {/* Staff users meter */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, color: '#475569' }}>Staff Accounts</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                    {billingInfo?.usage?.staff_users?.used || 1} / {billingInfo?.usage?.staff_users?.limit === 'unlimited' ? '∞ Unlimited' : (billingInfo?.usage?.staff_users?.limit || 1)}
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, billingInfo?.usage?.staff_users?.pct || 0)}%`,
                    height: '100%',
                    background: (billingInfo?.usage?.staff_users?.pct || 0) >= 100 ? '#f59e0b' : '#6366f1'
                  }} />
                </div>
              </div>
            </div>

            {/* Plan Features Checklist */}
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
              Features Included in Your Current Tier
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {(billingInfo?.features || [
                'Full POS Billing & Cashier Mode',
                'Thermal & A4 Invoice Printing',
                'Customer & Supplier Ledgers',
                'Stock Movements & Adjustments',
                'Automated Expiry Warnings'
              ]).map((feat, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569' }}>
                  <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Billing History Table */}
          <div className="card" style={{ padding: '1.5rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
            <h3 style={{ fontSize: '1.05rem', margin: '0 0 1rem 0', fontWeight: 700, color: '#0F172A' }}>
              Subscription & Invoicing History
            </h3>
            <div className="table-responsive">
              <table className="table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th>Plan</th>
                    <th>Started Date</th>
                    <th>Expiration</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {billingInfo?.history && billingInfo.history.length > 0 ? (
                    billingInfo.history.map((h, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700, textTransform: 'capitalize' }}>{h.plan}</td>
                        <td>{formatDate(h.started_at)}</td>
                        <td>{formatDate(h.expires_at)}</td>
                        <td style={{ fontWeight: 600 }}>₨ {Number(h.price).toLocaleString()}</td>
                        <td>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: '#dcfce7',
                            color: '#15803d',
                            fontSize: '11px',
                            fontWeight: 700
                          }}>
                            {h.payment_status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>
                        No previous billing records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═════════ TAB 6: BACKUP & RECOVERY ═════════ */}
      {activeTab === 'backup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.85rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #A7F3D0' }}>
                  <HardDrive size={20} color="#10B981" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700, color: '#0F172A' }}>
                    Database Backup & Recovery
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', lineHeight: 1.4 }}>
                    <div>Last backup: <strong style={{ color: '#0F172A' }}>{lastBackup}</strong></div>
                    <div style={{ marginTop: '2px' }}>
                      <span>Total backups: <strong style={{ color: '#0F172A' }}>{backups.length}</strong></span>
                      <span style={{ margin: '0 6px' }}>•</span>
                      <span>Total size: <strong style={{ color: '#0F172A' }}>{totalBackupSizeFormatted}</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateBackup}
                className="btn-sadax-teal"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '13px' }}
              >
                <HardDrive size={16} />
                <span>Create Live Backup Now</span>
              </button>
            </div>

            {/* Backups Table */}
            <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <table className="table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th>Backup Snapshot</th>
                    <th>Created At</th>
                    <th>Size</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                        No backup files found yet. Click "Create Live Backup Now" above.
                      </td>
                    </tr>
                  ) : (
                    backups.map((b, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{b.filename}</td>
                        <td style={{ color: '#64748b' }}>{formatDateTime(b.created_at)}</td>
                        <td style={{ color: '#64748b' }}>{b.size_kb} KB</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleDownloadBackup(b.filename)}
                            disabled={downloadingBackup === b.filename}
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          >
                            <Download size={13} />
                            <span>{downloadingBackup === b.filename ? 'Downloading...' : 'Download'}</span>
                          </button>
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

      {/* ═════════ UPGRADE PLAN MODAL ═════════ */}
      {showUpgradeModal && (
        <div className="modal-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '850px', width: '92%', padding: '2rem', borderRadius: '16px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
                Switch Your Subscription Tier
              </h2>
              <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                Instant upgrade with immediate limit removal and new feature access.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
              {/* Free Card */}
              <div style={{
                padding: '20px',
                borderRadius: '12px',
                border: plan === 'free' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                background: plan === 'free' ? '#f0f9ff' : '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px 0' }}>Free Forever</h3>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '10px 0' }}>₨ 0</div>
                  <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>• 1 User</div>
                    <div>• 50 Products</div>
                    <div>• 100 Invoices/mo</div>
                    <div>• Thermal Print</div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={plan === 'free' || upgradingPlan}
                  onClick={() => handlePlanUpgrade('free')}
                  style={{
                    marginTop: '16px',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: plan === 'free' ? '#e2e8f0' : '#ffffff',
                    cursor: plan === 'free' ? 'default' : 'pointer',
                    fontWeight: 700,
                    fontSize: '13px'
                  }}
                >
                  {plan === 'free' ? 'Current Plan' : 'Downgrade to Free'}
                </button>
              </div>

              {/* Pro Card */}
              <div style={{
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #0ea5e9',
                background: plan === 'pro' ? '#f0f9ff' : '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative'
              }}>
                <span style={{
                  position: 'absolute',
                  top: '-10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#0ea5e9',
                  color: '#fff',
                  fontSize: '9px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '10px'
                }}>
                  Most Popular
                </span>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px 0' }}>Professional</h3>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#0ea5e9', margin: '10px 0' }}>₨ 3,500 <span style={{ fontSize: '12px', color: '#64748b' }}>/mo</span></div>
                  <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>• Up to 5 Staff Users</div>
                    <div>• Unlimited Products</div>
                    <div>• Unlimited Invoices</div>
                    <div>• Profit & Loss Statement</div>
                    <div>• Custom Logo on Bills</div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={plan === 'pro' || upgradingPlan}
                  onClick={() => handlePlanUpgrade('pro')}
                  style={{
                    marginTop: '16px',
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
                    color: '#fff',
                    cursor: plan === 'pro' ? 'default' : 'pointer',
                    fontWeight: 700,
                    fontSize: '13px'
                  }}
                >
                  {plan === 'pro' ? 'Current Plan' : 'Activate Pro Plan'}
                </button>
              </div>

              {/* Enterprise Card */}
              <div style={{
                padding: '20px',
                borderRadius: '12px',
                border: plan === 'enterprise' ? '2px solid #7e22ce' : '1px solid #e2e8f0',
                background: plan === 'enterprise' ? '#faf5ff' : '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px 0' }}>Enterprise</h3>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#7e22ce', margin: '10px 0' }}>₨ 8,500 <span style={{ fontSize: '12px', color: '#64748b' }}>/mo</span></div>
                  <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>• Unlimited Users</div>
                    <div>• Multi-Branch Support</div>
                    <div>• Custom Domain Integration</div>
                    <div>• 24/7 Dedicated Support</div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={plan === 'enterprise' || upgradingPlan}
                  onClick={() => handlePlanUpgrade('enterprise')}
                  style={{
                    marginTop: '16px',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: plan === 'enterprise' ? '#e2e8f0' : '#ffffff',
                    cursor: plan === 'enterprise' ? 'default' : 'pointer',
                    fontWeight: 700,
                    fontSize: '13px'
                  }}
                >
                  {plan === 'enterprise' ? 'Current Plan' : 'Select Enterprise'}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="btn btn-secondary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
