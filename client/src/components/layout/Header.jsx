import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  PlusCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  User,
  KeyRound,
  ShieldCheck,
  LogOut,
  Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import UserProfileModal from '../common/UserProfileModal';

export default function Header({ currentTab, setTab, toggleSidebar, alerts = {} }) {
  const { user, logout, role, roleLabel, isAdmin, canSell, hasTabAccess } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState('profile');
  const userMenuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tabTitles = {
    dashboard: 'Business Overview & Analytics',
    pos: 'Point of Sale (POS) Counter',
    sales: 'Sales Transactions & Invoices',
    inventory: 'Frozen Food Inventory & Batches',
    'stock-adjust': 'Stock Adjustments & Waste Log',
    purchases: 'Supplier Purchases & Restocking',
    customers: 'Customer Accounts & Ledgers',
    suppliers: 'Supplier Accounts & Ledgers',
    expenses: 'Operating Expenses & Bills',
    cashflow: 'Daily Cashbook & Flow',
    reports: 'Financial & Inventory Reports',
    users: 'User Management & Staff Accounts',
    settings: 'System Configuration & Backups'
  };

  const openAccountModal = (tab) => {
    setProfileModalTab(tab);
    setProfileModalOpen(true);
    setUserMenuOpen(false);
  };

  const userInitial = user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U';

  return (
    <>
      <header className="top-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <button
            onClick={toggleSidebar}
            className="btn btn-secondary btn-sm mobile-hamburger-btn"
            aria-label="Toggle Navigation Menu"
          >
            <Menu size={16} />
          </button>
          <h1 className="page-title" title={tabTitles[currentTab] || 'Latif Traders'}>
            {tabTitles[currentTab] || 'Latif Traders'}
          </h1>
        </div>

        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* Low Stock Indicator */}
          {alerts.low_stock_count > 0 && (
            <button
              onClick={() => hasTabAccess('inventory') && setTab('inventory')}
              className="badge badge-warning"
              title={`${alerts.low_stock_count} items below minimum stock`}
              style={{ cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <AlertTriangle size={13} />
              <span>{alerts.low_stock_count} <span className="hide-mobile">Low Stock</span></span>
            </button>
          )}

          {/* Near Expiry Indicator */}
          {alerts.near_expiry_count > 0 && (
            <button
              onClick={() => hasTabAccess('reports') && setTab('reports')}
              className="badge badge-danger"
              title={`${alerts.near_expiry_count} batches expiring soon`}
              style={{ cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <Clock size={13} />
              <span>{alerts.near_expiry_count} <span className="hide-mobile">Expiring</span></span>
            </button>
          )}

          {/* POS Quick Button */}
          {canSell && currentTab !== 'pos' && (
            <button
              onClick={() => setTab('pos')}
              className="btn btn-primary btn-sm"
              style={{ padding: '0 0.65rem', height: '30px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Open POS Terminal"
            >
              <PlusCircle size={14} />
              <span><span className="hide-mobile">New Sale </span>POS</span>
            </button>
          )}

          {/* Divider */}
          <div style={{ width: '1px', height: '22px', background: '#e2e8f0', margin: '0 2px' }} />

          {/* TOP-RIGHT USER PROFILE MENU */}
          <div style={{ position: 'relative' }} ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '3px 8px 3px 4px',
                borderRadius: '8px',
                background: userMenuOpen ? '#f1f5f9' : 'transparent',
                border: userMenuOpen ? '1px solid #cbd5e1' : '1px solid transparent',
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
                  border: '1.5px solid #ffffff'
                }} />
              </div>

              {/* Name and Role Label */}
              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }} className="hide-mobile">
                <span style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  lineHeight: 1.2,
                  maxWidth: '130px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {user?.full_name || user?.username}
                </span>
                <span style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                  {roleLabel}
                </span>
              </div>

              <ChevronDown
                size={14}
                color="#64748b"
                style={{
                  transform: userMenuOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                  marginLeft: '2px'
                }}
              />
            </button>

            {/* DEDICATED USER ACCOUNT MENU DROPDOWN */}
            {userMenuOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '255px',
                background: '#ffffff',
                borderRadius: '10px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.08)',
                border: '1px solid #e2e8f0',
                padding: '0.5rem',
                zIndex: 1000,
                animation: 'fadeIn 0.15s ease'
              }}>
                {/* User Profile Card Header */}
                <div style={{
                  padding: '0.75rem',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #edf2f7',
                  marginBottom: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: '#0284c7',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.95rem'
                    }}>
                      {userInitial}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color: '#0f172a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {user?.full_name}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                        @{user?.username}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`role-badge-pill role-badge-${role || 'sales'}`}>
                      {roleLabel}
                    </span>
                    <span style={{ fontSize: '0.675rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                      ● Online
                    </span>
                  </div>
                </div>

                {/* USER ACCOUNT ACTIONS (NOT PAGE LINKS!) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <button
                    onClick={() => openAccountModal('profile')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.55rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      color: '#334155',
                      fontWeight: 500,
                      width: '100%',
                      textAlign: 'left'
                    }}
                    className="dropdown-hover"
                  >
                    <User size={15} color="#0284c7" />
                    <span>My Profile Details</span>
                  </button>

                  <button
                    onClick={() => openAccountModal('security')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.55rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      color: '#334155',
                      fontWeight: 500,
                      width: '100%',
                      textAlign: 'left'
                    }}
                    className="dropdown-hover"
                  >
                    <KeyRound size={15} color="#0284c7" />
                    <span>Change Password</span>
                  </button>

                  <button
                    onClick={() => openAccountModal('permissions')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.55rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      color: '#334155',
                      fontWeight: 500,
                      width: '100%',
                      textAlign: 'left'
                    }}
                    className="dropdown-hover"
                  >
                    <ShieldCheck size={15} color="#0284c7" />
                    <span>My Role & Permissions</span>
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => {
                        setTab('users');
                        setUserMenuOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: '0.55rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        color: '#334155',
                        fontWeight: 500,
                        width: '100%',
                        textAlign: 'left',
                        borderTop: '1px dashed #e2e8f0',
                        marginTop: '0.2rem',
                        paddingTop: '0.5rem'
                      }}
                      className="dropdown-hover"
                    >
                      <Users size={15} color="#6366f1" />
                      <span>User Management (Staff & Roles)</span>
                    </button>
                  )}
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: '#e2e8f0', margin: '0.4rem 0' }} />

                {/* Sign Out Button */}
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.55rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    color: '#dc2626',
                    fontWeight: 600,
                    width: '100%',
                    textAlign: 'left',
                    background: '#fef2f2'
                  }}
                  className="dropdown-hover"
                >
                  <LogOut size={15} color="#dc2626" />
                  <span>Sign Out of Session</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* DEDICATED USER ACCOUNT MODAL */}
      <UserProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        initialTab={profileModalTab}
      />
    </>
  );
}
