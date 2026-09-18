import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
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
import Users from './pages/Users';
import Settings from './pages/Settings';
import ErrorBoundary from './components/common/ErrorBoundary';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { api } from './utils/api';

function MainApp() {
  const { user, loading, role, roleLabel, defaultTab, hasTabAccess } = useAuth();
  const [currentTab, setTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alerts, setAlerts] = useState({ low_stock_count: 0, near_expiry_count: 0 });

  // When user loads or changes, ensure currentTab is an allowed tab
  useEffect(() => {
    if (user) {
      if (!hasTabAccess(currentTab)) {
        setTab(defaultTab || 'dashboard');
      }
    }
  }, [user, role]);

  useEffect(() => {
    if (user) {
      // Fetch badge alert counts
      api.get('/reports/dashboard').then(res => {
        if (res && res.success) {
          setAlerts({
            low_stock_count: res.data?.low_stock_count || 0,
            near_expiry_count: res.data?.near_expiry_count || 0
          });
        }
      }).catch(err => console.error(err));
    }
  }, [user, currentTab]);

  // Global Quick Switch Shortcuts (Alt + 0-7) with role validation
  useEffect(() => {
    const handleGlobalShortcuts = (e) => {
      if (!e.altKey) return;
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
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#38bdf8',
        fontWeight: 600
      }}>
        Initializing Latif Traders System...
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const isTabAllowed = hasTabAccess(currentTab);

  return (
    <div className="app-container">
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar
        currentTab={currentTab}
        setTab={setTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
      />

      <div className="main-content">
        <Header
          currentTab={currentTab}
          setTab={setTab}
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          alerts={alerts}
        />

        <main className="page-body">
          <ErrorBoundary fallbackTitle="Application Error" key={currentTab}>
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
                {currentTab === 'sales' && <SalesList />}
                {currentTab === 'inventory' && <Inventory />}
                {currentTab === 'stock-adjust' && <StockAdjustment />}
                {currentTab === 'purchases' && <Purchases />}
                {currentTab === 'customers' && <Customers />}
                {currentTab === 'suppliers' && <Suppliers />}
                {currentTab === 'expenses' && <Expenses />}
                {currentTab === 'cashflow' && <CashFlow />}
                {currentTab === 'reports' && <Reports />}
                {currentTab === 'users' && <Users />}
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
