import { BRAND_NAME, SUPPORT_EMAIL } from '../../config/brand';
import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  PlusCircle,
  ChevronDown,
  User,
  KeyRound,
  ShieldCheck,
  LogOut,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  Home,
  ChevronRight,
  Store,
  BarChart3,
  BookOpen,
  MessageSquare,
  Bug,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  X,
  Send,
  HelpCircle,
  ExternalLink,
  Layers,
  Sun,
  Moon,
  Sliders,
  Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/formatters';
import { resolveTradeId } from '../../utils/tradeCapabilities';
import { applyAppTheme, getSavedAppTheme, APP_THEMES } from '../../utils/theme';
import UserProfileModal from '../common/UserProfileModal';
import NotificationCenter from '../common/NotificationCenter';
import Modal from '../common/Modal';

const BUSINESS_TYPE_NAMES = {
  frozen_food: 'Frozen Food',
  retail_general: 'General Retail',
  clothing: 'Clothing & Boutique',
  pharmacy: 'Pharmacy & Medical',
  restaurant: 'Restaurant & Café',
  hardware: 'Hardware & Tools',
  electronics: 'Electronics & Mobiles',
  wholesale: 'Wholesale & Distribution'
};

export default function Header({ currentTab, setTab, toggleSidebar, sidebarCollapsed, toggleSidebarCollapse, alerts = {} }) {
  const { user, logout, role, roleLabel, isAdmin, isSuperOwner, enterTenant, tenant, plan, canSell, hasTabAccess } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [superOwnerDropdownOpen, setSuperOwnerDropdownOpen] = useState(false);
  const [tenantsList, setTenantsList] = useState([]);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState('profile');
  const [supportModal, setSupportModal] = useState(null); // 'help' | 'contact' | 'bug' | null
  const [bugCategory, setBugCategory] = useState('Display');
  const [bugDescription, setBugDescription] = useState('');
  const [bugSubmitted, setBugSubmitted] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [billingUsage, setBillingUsage] = useState({ productsUsed: 1, productsLimit: 50 });
  const [planExpiresAt, setPlanExpiresAt] = useState(null);
  const [theme, setTheme] = useState(() => getSavedAppTheme());
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);


  const superOwnerMenuRef = useRef(null);
  const themeMenuRef = useRef(null);

  useEffect(() => {
    if (isSuperOwner) {
      api.get('/superowner/tenants').then(res => {
        if (res?.success) setTenantsList(res.tenants);
      }).catch(() => {});
    }
  }, [isSuperOwner]);

  useEffect(() => {
    const handleThemeSync = (e) => {
      if (e?.detail) setTheme(e.detail);
    };
    window.addEventListener('app_theme_changed', handleThemeSync);
    window.addEventListener('theme_changed', handleThemeSync);
    return () => {
      window.removeEventListener('app_theme_changed', handleThemeSync);
      window.removeEventListener('theme_changed', handleThemeSync);
    };
  }, []);

  const userMenuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
      if (superOwnerMenuRef.current && !superOwnerMenuRef.current.contains(event.target)) {
        setSuperOwnerDropdownOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target)) {
        setThemeMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch billing usage stats for plan meter
  useEffect(() => {
    if (userMenuOpen || plan === 'free') {
      api.get('/settings/billing').then(res => {
        if (res && res.success && res.billing) {
          if (res.billing.usage?.products) {
            setBillingUsage({
              productsUsed: res.billing.usage.products.used || 0,
              productsLimit: res.billing.usage.products.limit || 50
            });
          }
          if (res.billing.planExpiresAt) {
            setPlanExpiresAt(res.billing.planExpiresAt);
          }
        }
      }).catch(() => {});
    }
  }, [userMenuOpen, plan]);

  const tabMetadata = {
    dashboard: { section: 'Overview', title: 'Dashboard' },
    pos: { section: 'Sales', title: 'POS' },
    sales: { section: 'Orders', title: 'Orders' },
    inventory: { section: 'Inventory', title: 'Products' },
    'stock-adjust': { section: 'Inventory', title: 'Adjustments' },
    purchases: { section: 'Inventory', title: 'Purchases' },
    customers: { section: 'Contacts', title: 'Customers' },
    suppliers: { section: 'Contacts', title: 'Suppliers' },
    expenses: { section: 'Finance', title: 'Expenses' },
    cashflow: { section: 'Finance', title: 'Cashbook' },
    reports: { section: 'Reports', title: 'Analytics' },
    settings: { section: 'Settings', title: 'Settings' }
  };

  const getSettingsSubTitle = (overrideTab = null) => {
    try {
      const tab = overrideTab || new URLSearchParams(window.location.search).get('tab');
      if (tab === 'staff' || tab === 'users') return 'Team';
      if (tab === 'billing' || tab === 'plan') return 'Billing';
      if (tab === 'business-profile' || tab === 'profile') return 'Profile';
      if (tab === 'invoice' || tab === 'invoices') return 'Invoices';
      if (tab === 'inventory') return 'Inventory';
      if (tab === 'backup' || tab === 'backups') return 'Backups';
    } catch (_) {}
    return 'Settings';
  };

  const [settingsTitle, setSettingsTitle] = useState(getSettingsSubTitle);

  useEffect(() => {
    const handleTabChange = (e) => {
      const detail = e?.detail;
      setSettingsTitle(getSettingsSubTitle(detail));
    };
    window.addEventListener('settings_tab_change', handleTabChange);
    window.addEventListener('popstate', handleTabChange);
    return () => {
      window.removeEventListener('settings_tab_change', handleTabChange);
      window.removeEventListener('popstate', handleTabChange);
    };
  }, []);

  const currentMeta = currentTab === 'settings'
    ? { section: 'System', title: settingsTitle }
    : (tabMetadata[currentTab] || { section: 'App', title: tenant?.business_name || 'Dashboard' });

  const openAccountModal = (tab) => {
    setProfileModalTab(tab);
    setProfileModalOpen(true);
    setUserMenuOpen(false);
  };

  const navigateSettingsTab = (tabName) => {
    try {
      const url = new URL(window.location.href);
      url.pathname = '/settings';
      url.searchParams.set('tab', tabName);
      window.history.pushState({}, '', url.toString());
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('settings_tab_change', { detail: tabName }));
    setTab('settings');
    setUserMenuOpen(false);
  };

  const userInitial = user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U';
  const userEmail = user?.email || (user?.username ? `${user.username}@shop.local` : '');
  const businessType = resolveTradeId(tenant?.business_type);
  const businessTypeLabel = BUSINESS_TYPE_NAMES[businessType] || 'Retail & Trade';
  const currentPlan = plan || 'free';

  // Calculate product usage percentage for Free plan bar
  const usagePercent = Math.min(100, Math.round(((billingUsage.productsUsed || 1) / (billingUsage.productsLimit || 50)) * 100));

  // Renewal / Expiry text
  const renewalText = planExpiresAt ? formatDate(planExpiresAt) : 'Monthly';

  return (
    <>
      <header className="top-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
          {/* Mobile hamburger */}
          <button
            onClick={toggleSidebar}
            className="btn btn-secondary btn-sm mobile-hamburger-btn"
            aria-label="Toggle Navigation Menu"
          >
            <Menu size={16} />
          </button>

          {/* Desktop sidebar toggle button */}
          <button
            onClick={toggleSidebarCollapse}
            className="hide-mobile"
            title={sidebarCollapsed ? "Open Sidebar Menu (Alt + B)" : "Close Sidebar Menu (Alt + B)"}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'transparent',
              border: '1px solid #E5E7EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 0,
              transition: 'background 0.15s ease, color 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--hover-bg)';
              e.currentTarget.style.color = 'var(--text-title)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              transform: sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)'
            }}>
              <PanelLeftClose size={16} />
            </div>
          </button>

          {/* Breadcrumbs */}
          <nav className="header-breadcrumbs" aria-label="Breadcrumb">
            <button
              type="button"
              onClick={() => setTab('dashboard')}
              className="breadcrumb-home-btn"
              title="Go to Dashboard"
            >
              <Home size={15} />
            </button>
            <span className="breadcrumb-separator">›</span>
            {currentMeta.section && currentTab !== 'dashboard' && (
              <>
                <span className="breadcrumb-section hide-mobile">{currentMeta.section}</span>
                <span className="breadcrumb-separator hide-mobile">›</span>
              </>
            )}
            <h1 className="breadcrumb-current page-title" style={{ margin: 0, fontSize: '0.925rem' }}>
              {currentMeta.title}
            </h1>
          </nav>
        </div>

        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
          {/* 4-Theme Selector Dropdown */}
          <div style={{ position: 'relative' }} ref={themeMenuRef}>
            {(() => {
              const currentTh = APP_THEMES.find(t => t.id === theme) || APP_THEMES[0];
              return (
                <button
                  type="button"
                  onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                  className="btn btn-secondary btn-sm"
                  title={`Theme: ${currentTh.name}. Click to switch theme.`}
                  aria-label="Toggle visual theme"
                  data-keep-icon="true"
                  style={{
                    padding: '0 10px',
                    height: '34px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    borderRadius: '8px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-title)',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.04))',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.background = 'var(--hover-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'var(--bg-card)';
                  }}
                >
                  <span style={{ fontSize: '14px', lineHeight: 1 }}>{currentTh.icon}</span>
                  <span className="hide-mobile" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-title)' }}>
                    {currentTh.name}
                  </span>
                  <ChevronDown
                    size={13}
                    color="var(--text-muted)"
                    style={{
                      transition: 'transform 0.2s ease',
                      transform: themeMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                    }}
                  />
                </button>
              );
            })()}

            {themeMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.3), 0 6px 16px -4px rgba(0, 0, 0, 0.15)',
                  minWidth: '290px',
                  padding: '8px',
                  zIndex: 1200,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  padding: '4px 10px 6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border)',
                  marginBottom: '2px'
                }}>
                  <span>System Appearance Theme</span>
                  <span style={{
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '999px',
                    background: 'var(--hover-bg)',
                    color: 'var(--text-muted)',
                    fontWeight: 600
                  }}>
                    {APP_THEMES.length} Themes
                  </span>
                </div>
                {APP_THEMES.map(th => {
                  const isActive = th.id === theme;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      data-keep-icon="true"
                      onClick={() => {
                        applyAppTheme(th.id);
                        setTheme(th.id);
                        setThemeMenuOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: isActive ? `1px solid var(--primary)` : '1px solid transparent',
                        background: isActive ? 'var(--primary)' : 'transparent',
                        color: isActive ? 'var(--primary-text, #ffffff)' : 'var(--text-title)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        transition: 'all 0.15s ease',
                        fontSize: '0.8125rem',
                        fontWeight: isActive ? 700 : 500,
                        boxShadow: isActive ? '0 2px 8px -1px rgba(0, 0, 0, 0.2)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'var(--hover-bg)';
                          e.currentTarget.style.color = 'var(--text-title)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-title)';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                        <span style={{ fontSize: '15px', lineHeight: 1 }}>{th.icon}</span>
                        <span style={{ fontSize: '0.8125rem' }}>{th.name}</span>
                      </div>
                      {isActive ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.25)'
                        }}>
                          <Check size={13} color="#ffffff" strokeWidth={3} />
                        </span>
                      ) : (
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: th.color,
                            display: 'inline-block',
                            opacity: 0.8
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notification Center */}
          <NotificationCenter alerts={alerts} setTab={setTab} />

          {/* POS Quick Button */}
          {canSell && currentTab !== 'pos' && currentTab !== 'sales' && currentTab !== 'orders' && (
            <button
              onClick={() => setTab('pos')}
              className="btn btn-primary btn-sm"
              style={{ padding: '0 0.65rem', height: '30px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Open New Sale (POS)"
            >
              <PlusCircle size={14} />
              <span>New Sale</span>
            </button>
          )}

          {/* SuperOwner Tenant Switcher */}
          {isSuperOwner && (
            <div style={{ position: 'relative' }} ref={superOwnerMenuRef}>
              <button
                type="button"
                onClick={() => setSuperOwnerDropdownOpen(!superOwnerDropdownOpen)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 10px',
                  height: '30px',
                  borderRadius: '7px',
                  background: '#FEF3C7',
                  border: '1px solid #FCD34D',
                  color: '#92400E',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title="SuperOwner Mode: Switch between any business tenant"
              >
                <span>🔧 SuperOwner Mode</span>
                <span style={{ color: '#D97706', fontWeight: 400 }}>|</span>
                <span>Viewing: <strong>{tenant?.business_name || BRAND_NAME}</strong></span>
                <ChevronDown size={13} />
              </button>
              {superOwnerDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: '260px',
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                  zIndex: 1000,
                  padding: '6px',
                  maxHeight: '340px',
                  overflowY: 'auto'
                }}>
                  <div style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Switch Tenant Workspace
                  </div>
                  {tenantsList.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        enterTenant(t);
                        setSuperOwnerDropdownOpen(false);
                        window.location.reload();
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: tenant?.id === t.id ? '#F0FDFA' : 'transparent',
                        color: tenant?.id === t.id ? '#0F766E' : '#1E293B',
                        fontSize: '12px',
                        fontWeight: tenant?.id === t.id ? 700 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{t.business_name}</div>
                        <div style={{ fontSize: '10px', color: '#94A3B8' }}>{t.id} • {t.plan}</div>
                      </div>
                      {tenant?.id === t.id && <CheckCircle2 size={14} color="#0F766E" />}
                    </button>
                  ))}
                  <div style={{ borderTop: '1px solid #E2E8F0', margin: '4px 0', padding: '4px 0 0' }}>
                    <button
                      onClick={() => {
                        setSuperOwnerDropdownOpen(false);
                        window.history.pushState({}, '', '/superowner/dashboard');
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'center',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#0F766E',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Open Control Panel →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          <div style={{ width: '1px', height: '22px', background: 'var(--border, #e2e8f0)', margin: '0 2px' }} />

          {/* TOP-RIGHT USER PROFILE TRIGGER */}
          <div style={{ position: 'relative' }} ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '3px 8px 3px 4px',
                borderRadius: '8px',
                background: userMenuOpen ? 'var(--hover-bg, #f1f5f9)' : 'transparent',
                border: userMenuOpen ? '1px solid var(--border, #cbd5e1)' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="User Account & Profile Menu"
              aria-label="User Account Menu"
            >
              {/* Avatar with Status Indicator */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.85rem',
                position: 'relative',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)'
              }}>
                {userInitial}
                <span style={{
                  position: 'absolute',
                  bottom: '0',
                  right: '0',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#10b981',
                  border: '1.5px solid var(--bg-card, #ffffff)'
                }} />
              </div>

              {/* Name and Role Label */}
              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }} className="hide-mobile">
                <span style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--text-title, #0f172a)',
                  lineHeight: 1.2,
                  maxWidth: '130px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {user?.full_name || user?.username}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>
                  {roleLabel}
                </span>
              </div>

              <ChevronDown
                size={14}
                color="var(--text-muted, #64748b)"
                style={{
                  transform: userMenuOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                  marginLeft: '2px'
                }}
              />
            </button>

            {/* UPGRADED CLEAN USER MENU DROPDOWN */}
            {userMenuOpen && (
              <div
                className="saas-dropdown-menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 7px)',
                  right: 0,
                  width: '260px',
                  maxHeight: 'calc(100vh - 75px)',
                  overflowY: 'auto',
                  background: 'var(--dropdown-bg, var(--bg-card, #FFFFFF))',
                  border: '1px solid var(--border, #E5E7EB)',
                  borderRadius: '14px',
                  boxShadow: 'var(--shadow-card, 0 8px 24px rgba(0,0,0,0.15))',
                  padding: '8px',
                  zIndex: 1000,
                  boxSizing: 'border-box',
                  animation: 'dropdownSlideFade 0.16s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                {/* Dismissible Try New Look Prompt */}
                {theme !== 'midnight-amber' && !tryNewLookDismissed && (
                  <div
                    style={{
                      margin: '4px',
                      marginBottom: '8px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #0A1128 0%, #1E293B 100%)',
                      border: '1px solid #F59E0B',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        ✨ Try the new look
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTryNewLookDismissed(true);
                          try { localStorage.setItem('dismiss_try_midnight_amber', 'true'); } catch {}
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '2px', display: 'flex' }}
                        title="Dismiss"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <div style={{ color: '#CBD5E1', fontSize: '11px', marginBottom: '8px', lineHeight: 1.4 }}>
                      Switch to Midnight Amber for an upgraded navy sidebar and amber accents.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        applyAppTheme('midnight-amber');
                        setTheme('midnight-amber');
                        setTryNewLookDismissed(true);
                        try { localStorage.setItem('dismiss_try_midnight_amber', 'true'); } catch {}
                      }}
                      style={{
                        background: '#F59E0B',
                        color: '#1E1B18',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      Switch to Midnight Amber <ArrowRight size={12} />
                    </button>
                  </div>
                )}

                {/* --- TOP USER CARD --- */}
                <div
                  style={{
                    padding: '12px 12px 10px',
                    background: 'var(--hover-bg, #F8FAFC)',
                    borderRadius: '10px',
                    margin: '4px',
                    marginBottom: '8px',
                    border: '1px solid var(--border, #F1F5F9)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #0F766E 0%, #14b8a6 100%)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '15px',
                        flexShrink: 0,
                        boxShadow: '0 2px 6px rgba(15, 118, 110, 0.25)'
                      }}
                    >
                      {userInitial}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: 'var(--text-title, #111827)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: 1.25
                        }}
                      >
                        {user?.full_name || user?.username || 'User'}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-muted, #6B7280)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '2px'
                        }}
                      >
                        {userEmail}
                      </div>
                    </div>
                  </div>

                  {/* Row below: [ADMINISTRATOR badge] [SHOPOS ENTERPRISE badge] */}
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 7px',
                        borderRadius: '9999px',
                        border: '1px solid var(--border, #E5E7EB)',
                        color: 'var(--text-value, #374151)',
                        background: 'var(--bg-card, #FFFFFF)'
                      }}
                    >
                      {roleLabel || 'ADMINISTRATOR'}
                    </span>

                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        background: currentPlan === 'enterprise' ? '#7C3AED' : (currentPlan === 'pro' ? '#0F766E' : '#6B7280'),
                        color: '#FFFFFF',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      {currentPlan === 'enterprise' && <><span>ENTERPRISE</span> <ShieldCheck size={10} /></>}
                      {currentPlan === 'pro' && <><span>PRO</span> ⭐</>}
                      {currentPlan === 'free' && 'FREE PLAN'}
                    </span>
                  </div>

                  {/* Business row: 🏪 Shop Name + business type chip */}
                  <div
                    style={{
                      marginTop: '8px',
                      paddingTop: '6px',
                      borderTop: '1px solid var(--border, #E5E7EB)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                      <span style={{ fontSize: '13px' }}>🏪</span>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--text-title, #374151)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {tenant?.business_name || 'My Shop'}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#0F766E',
                        background: 'rgba(15, 118, 110, 0.15)',
                        border: '1px solid rgba(15, 118, 110, 0.3)',
                        borderRadius: '9999px',
                        padding: '1px 7px',
                        flexShrink: 0
                      }}
                    >
                      {businessTypeLabel}
                    </span>
                  </div>

                  {/* PLAN STATUS: "● Free plan" OR "● Active • Renews <date>" */}
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '11px',
                      color: 'var(--text-muted, #6B7280)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span style={{ color: '#10B981', fontSize: '9px' }}>●</span>
                    {currentPlan === 'free' ? (
                      <span>Free plan</span>
                    ) : (
                      <span>Active • Renews {renewalText}</span>
                    )}
                  </div>
                </div>

                {/* --- MENU ITEMS --- */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {/* Divider label: ACCOUNT */}
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: 'var(--text-muted, #9CA3AF)',
                      letterSpacing: '0.05em',
                      padding: '6px 10px 2px',
                      textTransform: 'uppercase'
                    }}
                  >
                    Account
                  </div>

                  <button
                    type="button"
                    onClick={() => openAccountModal('profile')}
                    style={{
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: 'var(--text-value, #374151)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--hover-bg, #F4F6F9)';
                      e.currentTarget.style.color = 'var(--primary, #0F766E)';
                      const svg = e.currentTarget.querySelector('svg');
                      if (svg) svg.style.color = 'var(--primary, #0F766E)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-value, #374151)';
                      const svg = e.currentTarget.querySelector('svg');
                      if (svg) svg.style.color = 'var(--text-muted, #9CA3AF)';
                    }}
                  >
                    <User size={16} color="var(--text-muted, #9CA3AF)" style={{ flexShrink: 0, transition: 'color 0.15s ease' }} />
                    <span style={{ flex: 1 }}>My Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openAccountModal('security')}
                    style={{
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: 'var(--text-value, #374151)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--hover-bg, #F4F6F9)';
                      e.currentTarget.style.color = 'var(--primary, #0F766E)';
                      const svg = e.currentTarget.querySelector('svg');
                      if (svg) svg.style.color = 'var(--primary, #0F766E)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-value, #374151)';
                      const svg = e.currentTarget.querySelector('svg');
                      if (svg) svg.style.color = 'var(--text-muted, #9CA3AF)';
                    }}
                  >
                    <KeyRound size={16} color="var(--text-muted, #9CA3AF)" style={{ flexShrink: 0, transition: 'color 0.15s ease' }} />
                    <span style={{ flex: 1 }}>Change Password</span>
                  </button>

                  {/* Divider label: BUSINESS */}
                  <div style={{ height: '1px', background: 'var(--border, #F1F5F9)', margin: '4px 0' }} />
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: 'var(--text-muted, #9CA3AF)',
                      letterSpacing: '0.05em',
                      padding: '4px 10px 2px',
                      textTransform: 'uppercase'
                    }}
                  >
                    Business
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setTab('settings');
                      setUserMenuOpen(false);
                    }}
                    style={{
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: 'var(--text-value, #374151)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--hover-bg, #F4F6F9)';
                      e.currentTarget.style.color = 'var(--primary, #0F766E)';
                      const svg = e.currentTarget.querySelector('svg');
                      if (svg) svg.style.color = 'var(--primary, #0F766E)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-value, #374151)';
                      const svg = e.currentTarget.querySelector('svg');
                      if (svg) svg.style.color = 'var(--text-muted, #9CA3AF)';
                    }}
                  >
                    <Sliders size={16} color="var(--text-muted, #9CA3AF)" style={{ flexShrink: 0, transition: 'color 0.15s ease' }} />
                    <span style={{ flex: 1 }}>Shop Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateSettingsTab('staff')}
                    style={{
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: 'var(--text-value, #374151)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--hover-bg, #F4F6F9)';
                      e.currentTarget.style.color = 'var(--primary, #0F766E)';
                      const svg = e.currentTarget.querySelector('svg');
                      if (svg) svg.style.color = 'var(--primary, #0F766E)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-value, #374151)';
                      const svg = e.currentTarget.querySelector('svg');
                      if (svg) svg.style.color = 'var(--text-muted, #9CA3AF)';
                    }}
                  >
                    <Users size={16} color="var(--text-muted, #9CA3AF)" style={{ flexShrink: 0, transition: 'color 0.15s ease' }} />
                    <span style={{ flex: 1 }}>Staff & Access</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateSettingsTab('billing')}
                    style={{
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: 'var(--text-value, #374151)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--hover-bg, #F4F6F9)';
                      e.currentTarget.style.color = 'var(--primary, #0F766E)';
                      const svg = e.currentTarget.querySelector('svg');
                      if (svg) svg.style.color = 'var(--primary, #0F766E)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-value, #374151)';
                      const svg = e.currentTarget.querySelector('svg');
                      if (svg) svg.style.color = 'var(--text-muted, #9CA3AF)';
                    }}
                  >
                    <BarChart3 size={16} color="var(--text-muted, #9CA3AF)" style={{ flexShrink: 0, transition: 'color 0.15s ease' }} />
                    <span style={{ flex: 1 }}>My Plan & Billing</span>
                  </button>

                  {/* Divider label: SUPPORT */}
                  <div style={{ height: '1px', background: 'var(--border, #F1F5F9)', margin: '4px 0' }} />
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: 'var(--text-muted, #9CA3AF)',
                      letterSpacing: '0.05em',
                      padding: '4px 10px 2px',
                      textTransform: 'uppercase'
                    }}
                  >
                    Support
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setSupportModal('help');
                    }}
                    style={{
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: 'var(--text-value, #374151)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--hover-bg, #F4F6F9)';
                      e.currentTarget.style.color = 'var(--primary, #0F766E)';
                      const svg = e.currentTarget.querySelector('svg');
                      if (svg) svg.style.color = 'var(--primary, #0F766E)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-value, #374151)';
                      const svg = e.currentTarget.querySelector('svg');
                      if (svg) svg.style.color = 'var(--text-muted, #9CA3AF)';
                    }}
                  >
                    <BookOpen size={16} color="var(--text-muted, #9CA3AF)" style={{ flexShrink: 0, transition: 'color 0.15s ease' }} />
                    <span style={{ flex: 1 }}>Help & Docs</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setSupportModal('contact');
                    }}
                    style={{
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: 'var(--text-value, #374151)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--hover-bg, #F4F6F9)';
                      e.currentTarget.style.color = 'var(--primary, #0F766E)';
                      const svg = e.currentTarget.querySelector('svg');
                      if (svg) svg.style.color = 'var(--primary, #0F766E)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-value, #374151)';
                      const svg = e.currentTarget.querySelector('svg');
                      if (svg) svg.style.color = 'var(--text-muted, #9CA3AF)';
                    }}
                  >
                    <MessageSquare size={16} color="var(--text-muted, #9CA3AF)" style={{ flexShrink: 0, transition: 'color 0.15s ease' }} />
                    <span style={{ flex: 1 }}>Contact Support</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setSupportModal('bug');
                    }}
                    style={{
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: 'var(--text-value, #374151)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--hover-bg, #F4F6F9)';
                      e.currentTarget.style.color = 'var(--primary, #0F766E)';
                      const svg = e.currentTarget.querySelector('svg');
                      if (svg) svg.style.color = 'var(--primary, #0F766E)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-value, #374151)';
                      const svg = e.currentTarget.querySelector('svg');
                      if (svg) svg.style.color = 'var(--text-muted, #9CA3AF)';
                    }}
                  >
                    <Bug size={16} color="var(--text-muted, #9CA3AF)" style={{ flexShrink: 0, transition: 'color 0.15s ease' }} />
                    <span style={{ flex: 1 }}>Report a Bug</span>
                  </button>

                  {/* Divider before Sign Out */}
                  <div style={{ height: '1px', background: 'var(--border, #F1F5F9)', margin: '4px 0' }} />

                  {/* [→ Sign Out] Color: #DC2626 (red) */}
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    style={{
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#DC2626',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(220, 38, 38, 0.12)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LogOut size={16} color="#DC2626" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* DEDICATED USER ACCOUNT MODAL (Preserved) */}
      <UserProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        initialTab={profileModalTab}
      />

      {/* SAAS SUPPORT MODAL: HELP & DOCUMENTATION */}
      <Modal
        isOpen={supportModal === 'help'}
        onClose={() => setSupportModal(null)}
        title={`${BRAND_NAME} Knowledge Base & User Guide`}
        subtitle="Quick reference guide, workflows, and hotkeys"
        icon={<BookOpen size={22} color="#0F766E" />}
        maxWidth="560px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Card 1 */}
          <div
            style={{
              background: '#F8FAFC',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              padding: '16px 18px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>⚡</span>
              <span style={{ color: '#0F766E', fontWeight: 600, fontSize: '15px' }}>
                1. High-Speed POS Counter Sales
              </span>
            </div>
            <p style={{ margin: '6px 0 0 0', color: '#374151', fontSize: '14px', lineHeight: 1.6 }}>
              Scan barcodes with a handheld scanner or press <code style={{ background: '#EEF2F6', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>Alt + 1</code> to switch instantly to POS mode. Press Enter to process walk-in counter sales and automatically print receipts.
            </p>
          </div>

          {/* Card 2 */}
          <div
            style={{
              background: '#F8FAFC',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              padding: '16px 18px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>📦</span>
              <span style={{ color: '#0284C7', fontWeight: 600, fontSize: '15px' }}>
                2. Batch & Expiry Surveillance
              </span>
            </div>
            <p style={{ margin: '6px 0 0 0', color: '#374151', fontSize: '14px', lineHeight: 1.6 }}>
              Manage multiple expiry dates and batch lots per item. ${BRAND_NAME} enforces FIFO (First In, First Out) deduction and displays alert badges for items near expiry in the top notification tray.
            </p>
          </div>

          {/* Card 3 */}
          <div
            style={{
              background: '#F8FAFC',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              padding: '16px 18px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>📒</span>
              <span style={{ color: '#7C3AED', fontWeight: 600, fontSize: '15px' }}>
                3. Customer Ledgers
              </span>
            </div>
            <p style={{ margin: '6px 0 0 0', color: '#374151', fontSize: '14px', lineHeight: 1.6 }}>
              Record credit sales, share WhatsApp account statements with customers, and track partial disbursements with live double-entry party ledgers.
            </p>
          </div>

          {/* Card 4 - Dark code block style keyboard shortcuts */}
          <div
            style={{
              background: '#111827',
              borderRadius: '10px',
              padding: '16px',
              color: '#F9FAFB'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '15px' }}>⌨️</span>
              <span style={{ color: '#86EFAC', fontWeight: 600, fontSize: '14px' }}>
                4. Keyboard Shortcuts Cheatsheet
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 8px', fontFamily: 'monospace', color: '#86EFAC', fontSize: '12px' }}>
                  Alt + 1
                </span>
                <span style={{ color: '#D1D5DB' }}>POS Terminal</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 8px', fontFamily: 'monospace', color: '#86EFAC', fontSize: '12px' }}>
                  Alt + 2
                </span>
                <span style={{ color: '#D1D5DB' }}>Inventory List</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 8px', fontFamily: 'monospace', color: '#86EFAC', fontSize: '12px' }}>
                  Alt + 3
                </span>
                <span style={{ color: '#D1D5DB' }}>Sales & Orders</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 8px', fontFamily: 'monospace', color: '#86EFAC', fontSize: '12px' }}>
                  Alt + 4
                </span>
                <span style={{ color: '#D1D5DB' }}>Purchases</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 8px', fontFamily: 'monospace', color: '#86EFAC', fontSize: '12px' }}>
                  Alt + B
                </span>
                <span style={{ color: '#D1D5DB' }}>Toggle Sidebar</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 8px', fontFamily: 'monospace', color: '#86EFAC', fontSize: '12px' }}>
                  Alt + 0
                </span>
                <span style={{ color: '#D1D5DB' }}>Dashboard</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* SAAS SUPPORT MODAL: CONTACT SUPPORT */}
      <Modal
        isOpen={supportModal === 'contact'}
        onClose={() => setSupportModal(null)}
        title={`Contact ${BRAND_NAME} Support`}
        subtitle="Dedicated assistance for your store operations"
        icon={<MessageSquare size={22} color="#0F766E" />}
        maxWidth="520px"
        footer={!contactSubmitted ? (
          <>
            <button
              type="button"
              onClick={() => setSupportModal(null)}
              style={{
                height: '40px',
                padding: '0 20px',
                border: '1px solid #E5E7EB',
                borderRadius: '10px',
                background: '#FFFFFF',
                color: '#374151',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F4F6F9')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!contactMessage.trim()) return alert('Please enter your question or request.');
                setContactSubmitted(true);
                setContactMessage('');
              }}
              style={{
                height: '40px',
                padding: '0 20px',
                background: '#0F766E',
                color: '#FFFFFF',
                borderRadius: '10px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#065F46')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#0F766E')}
            >
              <span>Send Message</span>
              <ArrowRight size={15} />
            </button>
          </>
        ) : null}
      >
        {contactSubmitted ? (
          <div style={{ textAlign: 'center', padding: '24px 12px' }}>
            <CheckCircle2 size={48} color="#10B981" style={{ margin: '0 auto 14px' }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 700, color: '#111827' }}>
              Message Received!
            </h4>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              Our dedicated support team will reach out to <strong>{userEmail}</strong> within 1 hour.
            </p>
            <button
              type="button"
              onClick={() => { setContactSubmitted(false); setSupportModal(null); }}
              style={{
                height: '40px',
                padding: '0 24px',
                background: '#0F766E',
                color: '#FFFFFF',
                borderRadius: '10px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Close Window
            </button>
          </div>
        ) : (
          <div>
            {/* Contact info card: #F0FDF4, border #BBF7D0 */}
            <div
              style={{
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '12px',
                padding: '16px 18px',
                marginBottom: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '13px',
                color: '#166534'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📱</span>
                <span><strong>WhatsApp:</strong> +92 300 0746767</span>
              </div>
              {SUPPORT_EMAIL && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📧</span>
                  <span><strong>Email:</strong> {SUPPORT_EMAIL}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🕐</span>
                <span><strong>Hours:</strong> Mon – Sat: 9:00 AM – 10:00 PM PKT</span>
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '6px'
                }}
              >
                How can we help?
              </label>
              <textarea
                rows={4}
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="Describe your inquiry, billing question, or custom setup request..."
                style={{
                  width: '100%',
                  height: '100px',
                  borderRadius: '10px',
                  border: '1px solid #E5E7EB',
                  padding: '12px 14px',
                  fontSize: '14px',
                  color: '#111827',
                  background: '#FFFFFF',
                  boxSizing: 'border-box',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s, box-shadow 0.15s'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0F766E';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(15, 118, 110, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* SAAS SUPPORT MODAL: REPORT A BUG */}
      <Modal
        isOpen={supportModal === 'bug'}
        onClose={() => setSupportModal(null)}
        title="Report an Issue or Bug"
        subtitle="Help us identify and resolve platform problems"
        icon={<Bug size={22} color="#DC2626" />}
        maxWidth="520px"
        footer={!bugSubmitted ? (
          <>
            <button
              type="button"
              onClick={() => setSupportModal(null)}
              style={{
                height: '40px',
                padding: '0 20px',
                border: '1px solid #E5E7EB',
                borderRadius: '10px',
                background: '#FFFFFF',
                color: '#374151',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F4F6F9')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!bugDescription.trim()) return alert('Please describe the issue.');
                setBugSubmitted(true);
                setBugDescription('');
              }}
              style={{
                height: '40px',
                padding: '0 20px',
                background: '#DC2626',
                color: '#FFFFFF',
                borderRadius: '10px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#B91C1C')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#DC2626')}
            >
              Submit Report
            </button>
          </>
        ) : null}
      >
        {bugSubmitted ? (
          <div style={{ textAlign: 'center', padding: '24px 12px' }}>
            <CheckCircle2 size={48} color="#10B981" style={{ margin: '0 auto 14px' }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 700, color: '#111827' }}>
              Issue Report Logged!
            </h4>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              Thank you for helping us improve ${BRAND_NAME}. Our engineering team has received your report with diagnostic details.
            </p>
            <button
              type="button"
              onClick={() => { setBugSubmitted(false); setSupportModal(null); }}
              style={{
                height: '40px',
                padding: '0 24px',
                background: '#0F766E',
                color: '#FFFFFF',
                borderRadius: '10px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Close Window
            </button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '6px'
                }}
              >
                Issue Category
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '12px', fontSize: '16px', pointerEvents: 'none' }}>
                  🐛
                </span>
                <select
                  value={bugCategory}
                  onChange={(e) => setBugCategory(e.target.value)}
                  style={{
                    width: '100%',
                    height: '44px',
                    borderRadius: '10px',
                    border: '1px solid #E5E7EB',
                    padding: '0 14px 0 42px',
                    fontSize: '14px',
                    color: '#111827',
                    background: '#FFFFFF',
                    boxSizing: 'border-box',
                    outline: 'none',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#0F766E';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(15, 118, 110, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <option>Display</option>
                  <option>POS Terminal & Invoicing</option>
                  <option>Barcode & Thermal Printing</option>
                  <option>Inventory & Stock Batches</option>
                  <option>Customers</option>
                  <option>Performance or Slowness</option>
                  <option>Other Feedback</option>
                </select>
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '6px'
                }}
              >
                Describe the issue *
              </label>
              <textarea
                rows={4}
                value={bugDescription}
                onChange={(e) => setBugDescription(e.target.value)}
                placeholder="What happened? Please describe what you observed..."
                style={{
                  width: '100%',
                  height: '120px',
                  borderRadius: '10px',
                  border: '1px solid #E5E7EB',
                  padding: '12px 14px',
                  fontSize: '14px',
                  color: '#111827',
                  background: '#FFFFFF',
                  boxSizing: 'border-box',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s, box-shadow 0.15s'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0F766E';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(15, 118, 110, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
