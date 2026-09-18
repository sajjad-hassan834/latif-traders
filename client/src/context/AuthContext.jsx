import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext(null);

export const ROLE_PERMISSIONS = {
  admin: [
    'dashboard',
    'pos',
    'sales',
    'inventory',
    'stock-adjust',
    'purchases',
    'customers',
    'suppliers',
    'expenses',
    'cashflow',
    'reports',
    'users',
    'settings'
  ],
  sales: [
    'pos',
    'sales',
    'inventory',
    'customers',
    'reports' // for Daily Sales and Day-End Register
  ],
  inventory: [
    'dashboard',
    'inventory',
    'stock-adjust',
    'purchases',
    'suppliers',
    'reports' // for Stock Valuation and Batch Expiry
  ],
  accountant: [
    'dashboard',
    'sales',
    'purchases',
    'customers',
    'suppliers',
    'expenses',
    'cashflow',
    'reports'
  ]
};

export const ROLE_DEFAULT_TABS = {
  admin: 'dashboard',
  sales: 'pos',
  inventory: 'inventory',
  accountant: 'dashboard'
};

export const ROLE_LABELS = {
  admin: 'Administrator',
  sales: 'Cashier / Sales',
  inventory: 'Store / Inventory',
  accountant: 'Accountant'
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('lt_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem('lt_token');
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        if (res && res.success && res.user) {
          setUser(res.user);
          localStorage.setItem('lt_user', JSON.stringify(res.user));
        } else {
          setUser(null);
        }
      } catch (err) {
        setUser(null);
        localStorage.removeItem('lt_token');
        localStorage.removeItem('lt_user');
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    if (res && res.success && res.token) {
      localStorage.setItem('lt_token', res.token);
      localStorage.setItem('lt_user', JSON.stringify(res.user));
      setUser(res.user);
      return res.user;
    }
    throw new Error(res?.message || 'Login failed');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore network failure on logout
    }
    localStorage.removeItem('lt_token');
    localStorage.removeItem('lt_user');
    setUser(null);
  };

  // Helper permission checks
  const role = user?.role || 'sales';
  const isAdmin = role === 'admin';
  const isSales = role === 'sales';
  const isInventory = role === 'inventory';
  const isAccountant = role === 'accountant';

  const canSell = isAdmin || isSales;
  const canManageInventory = isAdmin || isInventory;
  const canViewFinances = isAdmin || isAccountant;

  const allowedTabs = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.sales;
  const defaultTab = ROLE_DEFAULT_TABS[role] || 'pos';
  const roleLabel = ROLE_LABELS[role] || role.toUpperCase();

  const hasTabAccess = (tabId) => {
    if (isAdmin) return true;
    return allowedTabs.includes(tabId);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      role,
      roleLabel,
      isAdmin,
      isSales,
      isInventory,
      isAccountant,
      canSell,
      canManageInventory,
      canViewFinances,
      allowedTabs,
      defaultTab,
      hasTabAccess
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
