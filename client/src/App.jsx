import { BRAND_NAME } from './config/brand';
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import LandingPage from './pages/LandingPage';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PosSales from './pages/PosSales';
import SalesList from './pages/SalesList';
import Inventory from './pages/Inventory';
import StockAdjustment from './pages/StockAdjustment';
import Purchases from './pages/Purchases';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Expenses from './pages/Expenses';
import CashFlow from './pages/CashFlow';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import SuperOwnerDashboard from './pages/SuperOwnerDashboard';
import ForcedPasswordChange from './components/auth/ForcedPasswordChange';
import ErrorBoundary from './components/common/ErrorBoundary';
import BrandPreview from './pages/BrandPreview';
import { ShieldAlert, ArrowLeft, AlertTriangle, ArrowRight, Sparkles, CheckCircle2, Circle, X } from 'lucide-react';
import { api } from './utils/api';
import { applyAppTheme as applyThemeHelper } from './utils/theme';

// Map URLs to active workspace tabs
const ROUTE_TAB_MAP = {
  '/dashboard': 'dashboard',
  '/pos': 'pos',
  '/orders': 'sales',
  '/sales': 'sales',
  '/products': 'inventory',
  '/inventory': 'inventory',
  '/adjustments': 'stock-adjust',
  '/stock-adjust': 'stock-adjust',
  '/purchases': 'purchases',
  '/customers': 'customers',
  '/suppliers': 'suppliers',
  '/expenses': 'expenses',
  '/cashbook': 'cashflow',
  '/cashflow': 'cashflow',
  '/analytics': 'reports',
  '/reports': 'reports',
  '/settings': 'settings',
  '/staff': 'settings'
};

const TAB_ROUTE_MAP = {
  dashboard: '/dashboard',
  pos: '/pos',
  sales: '/orders',
  inventory: '/products',
  'stock-adjust': '/adjustments',
  purchases: '/purchases',
  customers: '/customers',
  suppliers: '/suppliers',
  expenses: '/expenses',
  cashflow: '/cashbook',
  reports: '/analytics',
  settings: '/settings'
};

function resolveInitialTab() {
  const path = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
  const search = window.location.search;
  const hash = window.location.hash.toLowerCase();

  if (path === '/settings/billing' || path === '/billing' || hash === '#billing') {
    return 'settings';
  }
  if (path === '/settings/staff' || path === '/staff' || path === '/users' || hash === '#staff' || hash === '#users') {
    return 'settings';
  }
  if (ROUTE_TAB_MAP[path]) {
    return ROUTE_TAB_MAP[path];
  }
  if (path.startsWith('/settings') || search.includes('tab=')) return 'settings';
  return 'dashboard';
}

function MainApp() {
  const { user, loading, role, roleLabel, defaultTab, hasTabAccess, tenant, plan, isSuperOwner, activeImpersonatedTenant, exitTenant, enterTenant, mustChangePassword, completeForcedPasswordChange } = useAuth();
  const [superOwnerView, setSuperOwnerView] = useState(() => {
    return window.location.pathname === '/superowner/dashboard';
  });
  const [currentTab, setTabState] = useState(resolveInitialTab);

  // Centralized tab navigator that automatically resolves sub-tabs and synchronizes browser URL
  const setTab = (target, replace = false) => {
    if (target === 'users' || target === 'staff') {
      try {
        const url = new URL(window.location.href);
        url.pathname = '/settings';
        url.searchParams.set('tab', 'staff');
        window.history.pushState({}, '', url.toString());
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('settings_tab_change', { detail: 'staff' }));
      setTabState('settings');
      return;
    }

    if (target === 'billing' || target === 'plan') {
      try {
        const url = new URL(window.location.href);
        url.pathname = '/settings';
        url.searchParams.set('tab', 'billing');
        window.history.pushState({}, '', url.toString());
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('settings_tab_change', { detail: 'billing' }));
      setTabState('settings');
      return;
    }

    if (target === 'stock-valuation') {
      setTabState('reports');
      try {
        window.history.pushState({}, '', '/analytics');
      } catch (_) {}
      return;
    }

    const routePath = TAB_ROUTE_MAP[target] || `/${target}`;
    if (window.location.pathname !== routePath) {
      try {
        if (replace) {
          window.history.replaceState({}, '', routePath);
        } else {
          window.history.pushState({}, '', routePath);
        }
      } catch (_) {}
    }

    setTabState(target);
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('lt_sidebar_collapsed') === 'true';
  });
  const [alerts, setAlerts] = useState({ low_stock_count: 0, near_expiry_count: 0 });

  // Public navigation views: 'landing' (default), 'login', 'register'
  const [publicView, setPublicView] = useState(() => {
    const path = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
    if (path === '/login' || window.location.hash === '#login') return 'login';
    if (path === '/register' || window.location.hash === '#register') return 'register';
    return 'landing';
  });

  const navigatePublic = (view) => {
    setPublicView(view);
    try {
      const targetPath = view === 'login' ? '/login' : (view === 'register' ? '/register' : '/');
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }
    } catch (_) {}
  };

  useEffect(() => {
    const handleLocation = () => {
      const path = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
      if (path === '/superowner/dashboard') {
        setSuperOwnerView(true);
      } else if (path.startsWith('/superowner/tenant/')) {
        const tid = path.split('/superowner/tenant/')[1];
        if (tid) {
          enterTenant({ id: tid, business_name: tid });
          window.history.replaceState({}, '', '/');
          setSuperOwnerView(false);
        }
      } else {
        setSuperOwnerView(false);
      }

      if (path === '/brand') {
        setPublicView('brand');
      } else if (path === '/login') {
        setPublicView('login');
      } else if (path === '/register') {
        setPublicView('register');
      } else if (path === '/' || path === '') {
        setPublicView('landing');
      }

      if (path === '/staff' || path === '/settings/staff') {
        setTabState('settings');
        window.dispatchEvent(new CustomEvent('settings_tab_change', { detail: 'staff' }));
      } else if (ROUTE_TAB_MAP[path]) {
        setTabState(ROUTE_TAB_MAP[path]);
      }
    };

    window.addEventListener('popstate', handleLocation);
    handleLocation();
    return () => window.removeEventListener('popstate', handleLocation);
  }, []);

  useEffect(() => {
    if (user && (window.location.pathname === '/register' || window.location.pathname === '/login')) {
      try {
        window.history.replaceState({}, '', '/');
      } catch (_) {}
    } else if (!user) {
      const path = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
      if (path !== '/' && path !== '/login' && path !== '/register' && path !== '/brand') {
        try {
          window.history.replaceState({}, '', '/login');
          setPublicView('login');
        } catch (_) {}
      }
    }
  }, [user]);

  // Soft limit quota banner state
  const [quotaNotice, setQuotaNotice] = useState(null);

  // First-time onboarding checklist
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState(null);

  useEffect(() => {
    if (user && currentTab === 'dashboard') {
      api.get('/settings/onboarding-status').then(res => {
        if (res?.success && res.onboarding) {
          setOnboardingStatus(res.onboarding);
          if (!res.onboarding.dismissed && !res.onboarding.allDone) {
            setShowOnboarding(true);
          } else {
            setShowOnboarding(false);
          }
        }
      }).catch(() => {});
    } else {
      setShowOnboarding(false);
    }
  }, [user, currentTab]);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('lt_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Theme initialization & event listeners
  useEffect(() => {
    applyThemeHelper(localStorage.getItem('lt_theme') || 'classic');
  }, []);

  // When user loads or changes, ensure currentTab is an allowed tab
  useEffect(() => {
    if (user) {
      if (!hasTabAccess(currentTab)) {
        setTab(defaultTab || 'dashboard');
      }
    }
  }, [user, role]);

  // Load shop branding settings on mount, login, and window focus
  useEffect(() => {
    if (!user) return;
    const syncSettings = () => {
      api.get('/settings').then(res => {
        if (res && res.success && res.settings) {
          const shopName = res.settings.shop_name || res.settings.business_name || tenant?.business_name || 'Shop';
          // lt_shop_name removed
          document.title = `${shopName} - ${BRAND_NAME}`;
          if (res.settings.tagline) localStorage.setItem('lt_shop_tagline', res.settings.tagline);
          if (res.settings.phone) localStorage.setItem('lt_phone', res.settings.phone);
          if (res.settings.email) localStorage.setItem('lt_email', res.settings.email);
          if (res.settings.address) localStorage.setItem('lt_address', res.settings.address);
          if (res.settings.theme && !localStorage.getItem('lt_theme')) {
            applyThemeHelper(res.settings.theme);
          }
          window.dispatchEvent(new CustomEvent('settings_updated', { detail: res.settings }));
        }
      }).catch(() => {});
    };

    syncSettings();
    window.addEventListener('focus', syncSettings);
    return () => window.removeEventListener('focus', syncSettings);
  }, [user, tenant]);

  useEffect(() => {
    if (user) {
      api.get('/reports/dashboard').then(res => {
        if (res && res.success) {
          setAlerts({
            low_stock_count: res.data?.low_stock_count || 0,
            near_expiry_count: res.data?.near_expiry_count || 0,
            low_stock_items: res.data?.low_stock_items || [],
            near_expiry_batches: res.data?.near_expiry_batches || []
          });
        }
      }).catch(err => console.error(err));

      // Check Free plan limits
      if (plan === 'free') {
        api.get('/settings/billing').then(res => {
          if (res?.success && res.billing?.usage) {
            const { products, invoices_this_month } = res.billing.usage;
            if (products.used >= 40 || invoices_this_month.used >= 80) {
              setQuotaNotice({
                productsUsed: products.used,
                productsLimit: products.limit,
                invoicesUsed: invoices_this_month.used,
                invoicesLimit: invoices_this_month.limit
              });
            } else {
              setQuotaNotice(null);
            }
          }
        }).catch(() => {});
      }
    }
  }, [user, currentTab, plan]);

  // Global Quick Switch Shortcuts
  useEffect(() => {
    const handleGlobalShortcuts = (e) => {
      if (!e.altKey) return;
      if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebarCollapse();
        return;
      }
      const targetMap = {
        '1': 'pos',
        '2': 'inventory',
        '3': 'sales',
        '4': 'purchases',
        '5': 'customers',
        '6': 'cashflow',
        '7': 'reports',
        '0': 'dashboard'
      };

      const target = targetMap[e.key];
      if (target) {
        e.preventDefault();
        if (hasTabAccess(target)) {
          setTab(target);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [hasTabAccess]);

  if (loading) {
    const isDark = (localStorage.getItem('lt_theme') || 'light') === 'dark';
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDark ? '#090d16' : '#f8fafc',
        color: isDark ? '#38bdf8' : '#0284c7',
        fontWeight: 600,
        fontSize: '15px'
      }}>
        Loading ${BRAND_NAME} Workspace...
      </div>
    );
  }

  // ── Brand Preview Route (Dev Only) ──
  if (publicView === 'brand' || window.location.pathname.toLowerCase().replace(/\/$/, '') === '/brand') {
    return <BrandPreview />;
  }

  // ── Unauthenticated Views: Landing, Login, Register ──
  if (!user) {
    if (publicView === 'register') {
      return (
        <Register
          onNavigateLogin={() => navigatePublic('login')}
          onNavigateLanding={() => navigatePublic('landing')}
        />
      );
    }
    if (publicView === 'login') {
      return (
        <Login
          onNavigateRegister={() => navigatePublic('register')}
          onNavigateLanding={() => navigatePublic('landing')}
        />
      );
    }
    return (
      <LandingPage
        onNavigateLogin={() => navigatePublic('login')}
        onNavigateRegister={() => navigatePublic('register')}
      />
    );
  }

  // ── Forced Password Change Screen ──
  if (user && mustChangePassword) {
    return <ForcedPasswordChange onSuccess={completeForcedPasswordChange} />;
  }

  // ── SuperOwner Direct Route ──
  if (user && isSuperOwner && superOwnerView) {
    return <SuperOwnerDashboard />;
  }

  const isTabAllowed = hasTabAccess(currentTab);

  return (
    <div className={`app-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar
        currentTab={currentTab}
        setTab={setTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        isCollapsed={sidebarCollapsed}
        toggleCollapse={toggleSidebarCollapse}
      />

      <div className="main-content">
        {/* SuperOwner Impersonation Banner */}
        {isSuperOwner && (
          <div style={{
            background: '#FEF3C7',
            borderBottom: '1px solid #FCD34D',
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#92400E',
            fontWeight: 600,
            zIndex: 99
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={15} color="#D97706" />
              <span>⚠️ Viewing as: <strong>{tenant?.business_name || 'Selected Tenant'}</strong> (SuperOwner)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/superowner/dashboard');
                  setSuperOwnerView(true);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #D97706',
                  background: '#FFFFFF',
                  color: '#92400E',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Control Panel
              </button>
              {activeImpersonatedTenant && (
                <button
                  onClick={() => {
                    exitTenant();
                    window.location.reload();
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#D97706',
                    color: '#FFFFFF',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Exit Tenant View
                </button>
              )}
            </div>
          </div>
        )}

        <Header
          currentTab={currentTab}
          setTab={setTab}
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarCollapsed={sidebarCollapsed}
          toggleSidebarCollapse={toggleSidebarCollapse}
          alerts={alerts}
        />

        <main className="page-body">
          {/* Soft Quota Alert Banner for Free plan users approaching limit */}
          {quotaNotice && (
            <div style={{
              margin: '0 0 1.25rem 0',
              padding: '0.85rem 1.25rem',
              borderRadius: '10px',
              background: '#fef3c7',
              border: '1px solid #fde68a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              color: '#92400e',
              fontSize: '0.85rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
                <span>
                  <strong>Free Plan Usage Warning:</strong> You have used{' '}
                  <strong>{quotaNotice.productsUsed}/{quotaNotice.productsLimit}</strong> products and{' '}
                  <strong>{quotaNotice.invoicesUsed}/{quotaNotice.invoicesLimit}</strong> invoices this month.
                  Upgrade to Pro to remove all limits.
                </span>
              </div>
              <button
                onClick={() => setTab('settings')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#0284c7',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Upgrade to Pro
                <ArrowRight size={13} />
              </button>
            </div>
          )}

          {/* Welcome Onboarding Checklist for newly registered tenants (Dashboard only) */}
          {showOnboarding && currentTab === 'dashboard' && !tenant?.is_default && (
            <div style={{
              margin: '0 0 1.25rem 0',
              padding: '1.25rem',
              borderRadius: '12px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
              position: 'relative'
            }}>
              <button
                onClick={() => {
                  setShowOnboarding(false);
                  api.post('/settings', { onboarding_dismissed: 'true' }).catch(() => {});
                }}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
                title="Dismiss onboarding banner"
              >
                <X size={16} />
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Sparkles size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-title)' }}>
                  Welcome to {BRAND_NAME}, {tenant?.business_name || 'Partner'}! 🎉
                </h3>
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Your shop workspace is ready. Follow this quick checklist to begin operating:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  onClick={() => setTab('inventory')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-page)',
                    color: 'var(--text-title)',
                    fontSize: '0.785rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {onboardingStatus?.hasProduct ? (
                    <CheckCircle2 size={14} style={{ color: 'var(--money-green)' }} />
                  ) : (
                    <Circle size={14} style={{ color: 'var(--text-muted)' }} />
                  )}
                  <span style={{ textDecoration: onboardingStatus?.hasProduct ? 'line-through' : 'none', opacity: onboardingStatus?.hasProduct ? 0.75 : 1 }}>
                    1. Add your first product
                  </span>
                </button>
                <button
                  onClick={() => setTab('pos')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-page)',
                    color: 'var(--text-title)',
                    fontSize: '0.785rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {onboardingStatus?.hasSale ? (
                    <CheckCircle2 size={14} style={{ color: 'var(--money-green)' }} />
                  ) : (
                    <Circle size={14} style={{ color: 'var(--text-muted)' }} />
                  )}
                  <span style={{ textDecoration: onboardingStatus?.hasSale ? 'line-through' : 'none', opacity: onboardingStatus?.hasSale ? 0.75 : 1 }}>
                    2. Make your first POS sale
                  </span>
                </button>
                <button
                  onClick={() => setTab('customers')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-page)',
                    color: 'var(--text-title)',
                    fontSize: '0.785rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {onboardingStatus?.hasCustomer ? (
                    <CheckCircle2 size={14} style={{ color: 'var(--money-green)' }} />
                  ) : (
                    <Circle size={14} style={{ color: 'var(--text-muted)' }} />
                  )}
                  <span style={{ textDecoration: onboardingStatus?.hasCustomer ? 'line-through' : 'none', opacity: onboardingStatus?.hasCustomer ? 0.75 : 1 }}>
                    3. Add a customer
                  </span>
                </button>
                <button
                  onClick={() => setTab('settings')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-page)',
                    color: 'var(--text-title)',
                    fontSize: '0.785rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {onboardingStatus?.hasProfileAndLogo ? (
                    <CheckCircle2 size={14} style={{ color: 'var(--money-green)' }} />
                  ) : (
                    <Circle size={14} style={{ color: 'var(--text-muted)' }} />
                  )}
                  <span style={{ textDecoration: onboardingStatus?.hasProfileAndLogo ? 'line-through' : 'none', opacity: onboardingStatus?.hasProfileAndLogo ? 0.75 : 1 }}>
                    4. Setup business profile & logo
                  </span>
                </button>
              </div>
            </div>
          )}

          <ErrorBoundary fallbackTitle="Application Error">
            {!isTabAllowed ? (
              <div className="card" style={{
                maxWidth: '520px',
                margin: '3.5rem auto',
                textAlign: 'center',
                padding: '2.5rem 1.5rem',
                border: '1px solid #fed7aa',
                background: '#fff'
              }}>
                <div style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: '#fff7ed',
                  color: '#f97316',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}>
                  <ShieldAlert size={28} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                  Access Restricted
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                  Your assigned role (<strong>{roleLabel}</strong>) does not have authorization to view this module.
                </p>
                <button
                  onClick={() => setTab(defaultTab)}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', margin: '0 auto' }}
                >
                  <ArrowLeft size={14} />
                  <span>Go to My Default Workspace</span>
                </button>
              </div>
            ) : (
              <>
                {currentTab === 'dashboard' && <Dashboard setTab={setTab} />}
                {currentTab === 'pos' && <PosSales />}
                {currentTab === 'sales' && <SalesList setTab={setTab} />}
                {currentTab === 'inventory' && <Inventory setTab={setTab} />}
                {currentTab === 'stock-adjust' && <StockAdjustment setTab={setTab} />}
                {currentTab === 'purchases' && <Purchases />}
                {currentTab === 'customers' && <Customers />}
                {currentTab === 'suppliers' && <Suppliers />}
                {currentTab === 'expenses' && <Expenses />}
                {currentTab === 'cashflow' && <CashFlow />}
                {currentTab === 'reports' && <Reports />}
                {currentTab === 'settings' && <Settings />}
              </>
            )}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
