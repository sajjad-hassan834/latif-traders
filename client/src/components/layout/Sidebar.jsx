import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  ArrowDownToLine,
  Users,
  Building2,
  Wallet,
  DollarSign,
  BarChart3,
  Sliders,
  X
} from 'lucide-react';
import LtLogo from '../common/LtLogo';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';

const MENU_SECTIONS = [
  {
    title: 'Sales',
    roles: ['admin', 'sales'],
    items: [
      { id: 'pos', label: 'New Sale', icon: ShoppingCart, roles: ['admin', 'sales'] },
      { id: 'sales', label: 'History', icon: Receipt, roles: ['admin', 'sales', 'accountant'] }
    ]
  },
  {
    title: 'Overview',
    roles: ['admin', 'inventory', 'accountant'],
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'inventory', 'accountant'] }
    ]
  },
  {
    title: 'Inventory',
    roles: ['admin', 'inventory', 'sales'],
    items: [
      { id: 'inventory', label: 'Products', icon: Package, roles: ['admin', 'inventory', 'sales'] },
      { id: 'stock-adjust', label: 'Adjustments', icon: Sliders, roles: ['admin', 'inventory'] },
      { id: 'purchases', label: 'Purchase', icon: ArrowDownToLine, roles: ['admin', 'inventory', 'accountant'] }
    ]
  },
  {
    title: 'Parties',
    roles: ['admin', 'sales', 'accountant', 'inventory'],
    items: [
      { id: 'customers', label: 'Customers', icon: Users, roles: ['admin', 'sales', 'accountant'] },
      { id: 'suppliers', label: 'Suppliers', icon: Building2, roles: ['admin', 'inventory', 'accountant'] }
    ]
  },
  {
    title: 'Finance',
    roles: ['admin', 'accountant'],
    items: [
      { id: 'expenses', label: 'Expenses', icon: Wallet, roles: ['admin', 'accountant'] },
      { id: 'cashflow', label: 'Cashbook', icon: DollarSign, roles: ['admin', 'accountant'] }
    ]
  },
  {
    title: 'Reports',
    roles: ['admin', 'sales', 'inventory', 'accountant'],
    items: [
      { id: 'reports', label: 'Analytics', icon: BarChart3, roles: ['admin', 'sales', 'inventory', 'accountant'] },
      { id: 'stock-valuation', label: 'Stock Valuation', icon: Package, roles: ['admin', 'inventory', 'accountant'] }
    ]
  },
  {
    title: 'Admin',
    roles: ['admin'],
    items: [
      { id: 'users', label: 'Staff', icon: Users, roles: ['admin'] },
      { id: 'settings', label: 'Settings', icon: Sliders, roles: ['admin'] }
    ]
  }
];

export default function Sidebar({ currentTab, setTab, isOpen, setIsOpen, isCollapsed, toggleCollapse }) {
  const { role, isAdmin } = useAuth();
  const userRole = role || 'sales';

  const [brandInfo, setBrandInfo] = React.useState({
    name: localStorage.getItem('lt_shop_name') || 'Latif Traders',
    tagline: localStorage.getItem('lt_shop_tagline') || 'CHICKEN SUPPLIER'
  });

  React.useEffect(() => {
    // Fetch live shop branding directly from server on mount
    api.get('/settings').then(res => {
      if (res?.success && res.settings) {
        if (res.settings.shop_name) localStorage.setItem('lt_shop_name', res.settings.shop_name);
        if (res.settings.tagline) localStorage.setItem('lt_shop_tagline', res.settings.tagline);
        setBrandInfo({
          name: res.settings.shop_name || 'Latif Traders',
          tagline: res.settings.tagline || 'CHICKEN SUPPLIER'
        });
      }
    }).catch(() => {});

    const handleSettingsUpdate = (e) => {
      const detail = e?.detail;
      setBrandInfo({
        name: detail?.shop_name || localStorage.getItem('lt_shop_name') || 'Latif Traders',
        tagline: detail?.tagline || localStorage.getItem('lt_shop_tagline') || 'CHICKEN SUPPLIER'
      });
    };
    window.addEventListener('settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('settings_updated', handleSettingsUpdate);
  }, []);

  // Filter sections that have at least one visible item for this role
  const visibleSections = MENU_SECTIONS.map(section => {
    const visibleItems = section.items.filter(item => {
      if (isAdmin) return true;
      return item.roles.includes(userRole);
    });
    return { ...section, visibleItems };
  }).filter(section => section.visibleItems.length > 0);

  const handleNavClick = (tabId) => {
    setTab(tabId);
    if (setIsOpen) {
      setIsOpen(false);
    }
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
          <div className="brand-icon" style={{ flexShrink: 0, background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LtLogo size={32} />
          </div>
          <div className="brand-text" style={{ minWidth: 0, overflow: 'hidden' }}>
            <h2 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.95rem' }} title={brandInfo.name}>
              {brandInfo.name}
            </h2>
            <p style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.7rem' }} title={brandInfo.tagline}>
              {brandInfo.tagline}
            </p>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={() => setIsOpen && setIsOpen(false)}
          className="mobile-close-sidebar-btn"
          aria-label="Close Sidebar"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav" style={{ paddingBottom: '1rem' }}>
        {visibleSections.map((section, idx) => (
          <div key={idx} className="sidebar-section">
            <div className="sidebar-section-title">{section.title}</div>
            {section.visibleItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
