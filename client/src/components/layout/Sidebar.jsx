import React, { useState, useEffect } from 'react';
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
  X,
  ChevronDown
} from 'lucide-react';
import TenantLogo from '../common/TenantLogo';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { getTerminology } from '../../utils/terminology';

export default function Sidebar({ currentTab, setTab, isOpen, setIsOpen, isCollapsed, toggleCollapse }) {
  const { role, roleLabel, isAdmin, tenant, plan } = useAuth();
  const userRole = role || 'sales';
  const term = getTerminology(tenant?.business_type);

  const menuSections = [
    {
      title: 'MAIN NAVIGATION',
      roles: ['admin', 'sales', 'inventory', 'accountant'],
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'inventory', 'accountant', 'sales'] },
        { id: 'pos', label: 'POS', icon: ShoppingCart, roles: ['admin', 'sales'] },
        { id: 'sales', label: 'Orders', icon: Receipt, roles: ['admin', 'sales', 'accountant'] }
      ]
    },
    {
      title: term.inventorySection.toUpperCase(),
      roles: ['admin', 'inventory', 'sales', 'accountant'],
      items: [
        { id: 'inventory', label: term.products, icon: Package, roles: ['admin', 'inventory', 'sales'] },
        { id: 'stock-adjust', label: 'Adjustments', icon: Sliders, roles: ['admin', 'inventory'] },
        { id: 'purchases', label: term.purchases, icon: ArrowDownToLine, roles: ['admin', 'inventory', 'accountant'] }
      ]
    },
    {
      title: 'PARTIES & LEDGERS',
      roles: ['admin', 'sales', 'accountant', 'inventory'],
      items: [
        { id: 'customers', label: 'Customers', icon: Users, roles: ['admin', 'sales', 'accountant'] },
        { id: 'suppliers', label: 'Suppliers', icon: Building2, roles: ['admin', 'inventory', 'accountant'] }
      ]
    },
    {
      title: 'FINANCE & AUDIT',
      roles: ['admin', 'accountant', 'sales', 'inventory'],
      items: [
        { id: 'expenses', label: 'Expenses', icon: Wallet, roles: ['admin', 'accountant'] },
        { id: 'cashflow', label: 'Cashbook', icon: DollarSign, roles: ['admin', 'accountant'] },
        { id: 'reports', label: 'Analytics', icon: BarChart3, roles: ['admin', 'sales', 'inventory', 'accountant'] }
      ]
    },
    {
      title: 'SYSTEM & SETTINGS',
      roles: ['admin'],
      items: [
        { id: 'settings', label: 'Settings', icon: Sliders, roles: ['admin'] }
      ]
    }
  ];

  const [brandInfo, setBrandInfo] = useState({
    name: tenant?.business_name || '',
    tagline: ''
  });

  // Track collapsed state for sections with localStorage persistence
  const [collapsedSections, setCollapsedSections] = useState(() => {
    try {
      const saved = localStorage.getItem('lt_sidebar_collapsed_sections');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    api.get('/settings').then(res => {
      if (res?.success && res.settings) {
        setBrandInfo({
          name: res.settings.shop_name || res.settings.business_name || tenant?.business_name || 'My Shop',
          tagline: res.settings.tagline || ''
        });
      }
    }).catch(() => {});

    const handleSettingsUpdate = (e) => {
      const detail = e?.detail;
      setBrandInfo({
        name: detail?.shop_name || detail?.business_name || tenant?.business_name || 'My Shop',
        tagline: detail?.tagline || ''
      });
    };
    window.addEventListener('settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('settings_updated', handleSettingsUpdate);
  }, [tenant]);

  // Filter sections that have at least one visible item for this role
  const visibleSections = menuSections.map(section => {
    const visibleItems = section.items.filter(item => {
      if (isAdmin) return true;
      return item.roles.includes(userRole);
    });
    return { ...section, visibleItems };
  }).filter(section => section.visibleItems.length > 0);

  // Auto-expand the section containing the active tab so the user never gets lost
  useEffect(() => {
    if (!currentTab) return;
    const parent = visibleSections.find(s => s.visibleItems.some(item => item.id === currentTab));
    if (parent && collapsedSections[parent.title]) {
      setCollapsedSections(prev => {
        const next = { ...prev, [parent.title]: false };
        localStorage.setItem('lt_sidebar_collapsed_sections', JSON.stringify(next));
        return next;
      });
    }
  }, [currentTab]);

  const toggleSection = (sectionTitle) => {
    setCollapsedSections(prev => {
      const next = { ...prev, [sectionTitle]: !prev[sectionTitle] };
      localStorage.setItem('lt_sidebar_collapsed_sections', JSON.stringify(next));
      return next;
    });
  };

  const handleNavClick = (tabId) => {
    setTab(tabId);
    if (setIsOpen) {
      setIsOpen(false);
    }
  };

  const shopDisplayName = tenant?.business_name || brandInfo.name || 'My Shop';

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
      {/* BRAND LOGO HEADER */}
      <div className="sidebar-header">
        <div className="sidebar-header-inner">
          <div className="brand-icon">
            <TenantLogo tenant={tenant} size={32} />
          </div>
          <div className="brand-text">
            <h2 title={shopDisplayName}>
              {shopDisplayName}
            </h2>
            <div className="brand-badge-wrap">
              <span className="brand-plan-badge" style={{
                background: plan === 'pro' ? 'rgba(56, 189, 248, 0.2)' : (plan === 'enterprise' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(148, 163, 184, 0.2)'),
                color: plan === 'pro' ? '#38bdf8' : (plan === 'enterprise' ? '#c084fc' : '#94a3b8'),
                border: `1px solid ${plan === 'pro' ? 'rgba(56, 189, 248, 0.4)' : (plan === 'enterprise' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(148, 163, 184, 0.3)')}`
              }}>
                ShoppyOS {plan === 'enterprise' ? 'Enterprise' : (plan === 'pro' ? 'Pro' : 'Free')}
              </span>
            </div>
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

      {/* NAVIGATION ITEMS */}
      <nav className="sidebar-nav" style={{ paddingBottom: '0.5rem', flex: 1 }}>
        {visibleSections.map((section, idx) => {
          const isSectionCollapsed = isCollapsed ? false : Boolean(collapsedSections[section.title]);
          const hasActiveItem = section.visibleItems.some(item => item.id === currentTab);

          return (
            <div key={idx} className="sidebar-section">
              <button
                type="button"
                onClick={() => !isCollapsed && toggleSection(section.title)}
                className={`sidebar-section-header-btn ${hasActiveItem ? 'has-active' : ''}`}
                title={!isCollapsed ? `Click to ${isSectionCollapsed ? 'expand' : 'collapse'} ${section.title}` : undefined}
                aria-expanded={!isSectionCollapsed}
                tabIndex={isCollapsed ? -1 : 0}
              >
                <div className="sidebar-section-title-wrap">
                  <span className="sidebar-section-title">{section.title}</span>
                  {hasActiveItem && isSectionCollapsed && (
                    <span className="sidebar-active-dot" title="Active item inside" />
                  )}
                </div>
                <ChevronDown
                  size={12}
                  className={`sidebar-section-chevron ${isSectionCollapsed ? 'collapsed' : ''}`}
                />
              </button>
              {idx > 0 && <div className="sidebar-rail-divider" key={`div-${idx}`} />}

              <div className={`sidebar-section-items ${isSectionCollapsed ? 'collapsed' : ''}`}>
                {section.visibleItems.map(item => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`nav-item ${isActive ? 'active' : ''}`}
                      title={isCollapsed ? item.label : undefined}
                      aria-label={item.label}
                      data-tooltip={item.label}
                    >
                      <span className="nav-item-icon-wrap">
                        <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                      </span>
                      <span className="nav-item-label">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
