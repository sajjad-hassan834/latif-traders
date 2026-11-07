import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';
import { applyAppTheme, applyPublicTheme, getSavedAppTheme, getSavedPublicTheme } from '../utils/theme';

const AuthContext = createContext(null);

const ROLE_PERMISSIONS = {
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
    'settings'
  ],
  superowner: [
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
    'settings'
  ],
  sales: [
    'pos',
    'sales',
    'inventory',
    'customers',
    'reports'
  ],
  inventory: [
    'dashboard',
    'inventory',
    'stock-adjust',
    'purchases',
    'suppliers',
    'reports'
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

const ROLE_DEFAULT_TABS = {
  admin: 'dashboard',
  superowner: 'dashboard',
  sales: 'pos',
  inventory: 'inventory',
  accountant: 'dashboard'
};

const ROLE_LABELS = {
  admin: 'Administrator',
  superowner: 'Superowner',
  sales: 'Cashier',
  inventory: 'Inventory',
  accountant: 'Accountant'
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('lt_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [mustChangePassword, setMustChangePassword] = useState(() => !!(user?.must_change_password));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem('lt_token');
      if (!token) {
        setUser(null);
        setMustChangePassword(false);
        applyPublicTheme(getSavedPublicTheme());
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        if (res && res.success && res.user) {
          setUser(res.user);
          setMustChangePassword(!!res.user.must_change_password);
          localStorage.setItem('lt_user', JSON.stringify(res.user));
          applyAppTheme(res.user.theme || getSavedAppTheme());
        } else {
          setUser(null);
          setMustChangePassword(false);
          applyPublicTheme(getSavedPublicTheme());
        }
      } catch (err) {
        setUser(null);
        setMustChangePassword(false);
        localStorage.removeItem('lt_token');
        localStorage.removeItem('lt_user');
        applyPublicTheme(getSavedPublicTheme());
      } finally {
        setLoading(false);
      }
    }

    checkAuth();

    const handleExpired = () => {
      setUser(null);
      setMustChangePassword(false);
      applyPublicTheme(getSavedPublicTheme());
    };
    const handlePwChangeRequired = () => {
      setMustChangePassword(true);
    };

    window.addEventListener('auth_expired', handleExpired);
    window.addEventListener('password_change_required', handlePwChangeRequired);
    return () => {
      window.removeEventListener('auth_expired', handleExpired);
      window.removeEventListener('password_change_required', handlePwChangeRequired);
    };
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    if (res && res.success && res.token) {
      localStorage.setItem('lt_token', res.token);
      localStorage.setItem('lt_user', JSON.stringify(res.user));
      setUser(res.user);
      setMustChangePassword(!!res.user?.must_change_password);
      applyAppTheme(res.user?.theme || getSavedAppTheme());
      return res.user;
    }
    throw new Error(res?.message || 'Login failed');
  };

  const register = async (registrationData) => {
    const res = await api.post('/auth/register', registrationData);
    if (res && res.success && res.token) {
      localStorage.setItem('lt_token', res.token);
      localStorage.setItem('lt_user', JSON.stringify(res.user));
      setUser(res.user);
      applyAppTheme(res.user?.theme || getSavedAppTheme());
      return res.user;
    }
    throw new Error(res?.message || 'Registration failed');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore network failure on logout
    }
    const savedPublicTheme = localStorage.getItem('shopos-public-theme');
    localStorage.clear();
    sessionStorage.clear();
    if (savedPublicTheme) {
      localStorage.setItem('shopos-public-theme', savedPublicTheme);
    }
    setUser(null);
    applyPublicTheme(getSavedPublicTheme());
  };

  const [activeImpersonatedTenant, setActiveImpersonatedTenant] = useState(() => {
    const tid = localStorage.getItem('lt_superowner_tenant_id');
    const tname = localStorage.getItem('lt_superowner_tenant_name');
    return tid ? { id: tid, business_name: tname || tid } : null;
  });

  const enterTenant = (targetTenant) => {
    if (!targetTenant) return;
    localStorage.setItem('lt_superowner_tenant_id', targetTenant.id);
    localStorage.setItem('lt_superowner_tenant_name', targetTenant.business_name || targetTenant.id);
    setActiveImpersonatedTenant({
      id: targetTenant.id,
      business_name: targetTenant.business_name || targetTenant.id
    });
  };

  const exitTenant = () => {
    localStorage.removeItem('lt_superowner_tenant_id');
    localStorage.removeItem('lt_superowner_tenant_name');
    setActiveImpersonatedTenant(null);
  };

  const updateTenantInfo = (updatedFields) => {
    setUser(prev => {
      if (!prev) return prev;
      const updatedTenant = { ...(prev.tenant || {}), ...updatedFields };
      const updatedUser = {
        ...prev,
        business_name: updatedFields.business_name || prev.business_name,
        business_type: updatedFields.business_type || prev.business_type,
        plan: updatedFields.plan || prev.plan,
        logo_url: updatedFields.logo_url !== undefined ? updatedFields.logo_url : prev.logo_url,
        tenant: updatedTenant
      };
      localStorage.setItem('lt_user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  // Helper permission checks
  const role = user?.role || 'sales';
  const isSuperOwner = role === 'superowner';
  const isAdmin = role === 'admin' || isSuperOwner;
  const isSales = role === 'sales';
  const isInventory = role === 'inventory';
  const isAccountant = role === 'accountant';

  const canSell = isAdmin || isSales;
  const canManageInventory = isAdmin || isInventory;
  const canViewFinances = isAdmin || isAccountant;

  const allowedTabs = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.sales;
  const defaultTab = isSuperOwner ? 'dashboard' : (ROLE_DEFAULT_TABS[role] || 'pos');
  const roleLabel = ROLE_LABELS[role] || role.toUpperCase();

  const tenant = activeImpersonatedTenant ? {
    id: activeImpersonatedTenant.id,
    business_name: activeImpersonatedTenant.business_name,
    business_type: 'retail_general',
    plan: 'enterprise'
  } : (user?.tenant || {
    id: user?.tenant_id || '',
    business_name: user?.business_name || 'My Shop',
    business_type: user?.business_type || 'retail_general',
    plan: user?.plan || 'free',
    logo_url: user?.logo_url || null
  });
  const plan = tenant.plan || user?.plan || 'free';
  const businessType = tenant.business_type || 'retail_general';

  const completeForcedPasswordChange = (freshToken) => {
    if (freshToken) {
      localStorage.setItem('lt_token', freshToken);
    }
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, must_change_password: false };
      localStorage.setItem('lt_user', JSON.stringify(updated));
      return updated;
    });
    setMustChangePassword(false);
  };

  const hasTabAccess = (tabId) => {
    if (isAdmin || isSuperOwner) return true;
    const canonical = (tabId === 'users' || tabId === 'staff' || tabId === 'billing' || tabId === 'plan')
      ? 'settings'
      : (tabId === 'stock-valuation' ? 'reports' : tabId);
    return allowedTabs.includes(canonical);
  };

  return (
    <AuthContext.Provider value={{
      user,
      mustChangePassword,
      completeForcedPasswordChange,
      tenant,
      plan,
      businessType,
      loading,
      login,
      register,
      logout,
      updateTenantInfo,
      role,
      roleLabel,
      isSuperOwner,
      activeImpersonatedTenant,
      enterTenant,
      exitTenant,
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
