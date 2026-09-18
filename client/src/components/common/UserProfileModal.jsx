import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  KeyRound,
  CheckCircle,
  AlertTriangle,
  X,
  Lock,
  Mail,
  UserCheck,
  ShieldCheck,
  Info
} from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function UserProfileModal({ isOpen, onClose, initialTab = 'profile' }) {
  const { user, role, roleLabel, isAdmin, isSales, isInventory, isAccountant } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);

  // Profile form state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setFullName(user?.full_name || '');
      setEmail(user?.email || '');
      setProfileMessage(null);
      setPasswordMessage(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [isOpen, initialTab, user]);

  if (!isOpen) return null;

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setProfileSaving(true);
      setProfileMessage(null);
      const res = await api.put('/auth/profile', { full_name: fullName, email });
      if (res && res.success) {
        setProfileMessage({ type: 'success', text: 'Profile updated successfully!' });
        if (res.user) {
          localStorage.setItem('lt_user', JSON.stringify(res.user));
        }
      } else {
        setProfileMessage({ type: 'error', text: res?.message || 'Failed to update profile.' });
      }
    } catch (err) {
      setProfileMessage({ type: 'error', text: err.message || 'Error updating profile.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }

    try {
      setPasswordSaving(true);
      setPasswordMessage(null);
      const res = await api.post('/auth/change-password', { currentPassword, newPassword });
      if (res && res.success) {
        setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMessage({ type: 'error', text: res?.message || 'Failed to change password.' });
      }
    } catch (err) {
      setPasswordMessage({ type: 'error', text: err.message || 'Error changing password.' });
    } finally {
      setPasswordSaving(false);
    }
  };

  const permissionsList = [
    { label: 'Point of Sale (POS) Counter Billing', granted: isAdmin || isSales },
    { label: 'Sales History & Invoice Viewing', granted: isAdmin || isSales || isAccountant },
    { label: 'Frozen Food Inventory & Batch Lookup', granted: true },
    { label: 'Physical Stock Adjustments & Waste Logging', granted: isAdmin || isInventory },
    { label: 'Supplier Purchases & Restocking Receiving', granted: isAdmin || isInventory || isAccountant },
    { label: 'Customer Accounts & Credit / Udhaar Ledgers', granted: isAdmin || isSales || isAccountant },
    { label: 'Supplier Accounts & Disbursement Ledgers', granted: isAdmin || isInventory || isAccountant },
    { label: 'Operating Expenses & Bills Logging', granted: isAdmin || isAccountant },
    { label: 'Cashbook & Cash Drawer Management', granted: isAdmin || isAccountant },
    { label: 'Daily Sales & Day-End Z-Register Reports', granted: isAdmin || isSales || isAccountant },
    { label: 'Stock Valuation & Expiry Alerts Reports', granted: isAdmin || isInventory || isAccountant },
    { label: 'Profit & Loss (P&L) Financial Statements', granted: isAdmin || isAccountant },
    { label: 'Staff Account Management & Audit Logs', granted: isAdmin },
    { label: 'Database Backups & System Configuration', granted: isAdmin }
  ];

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '540px', padding: 0, overflow: 'hidden' }}>
        {/* MODAL HEADER */}
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.9rem'
            }}>
              {user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U'}
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>User Account & Security</h3>
              <p style={{ fontSize: '0.725rem', color: '#64748b' }}>Manage your personal profile, credentials, and access</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: '#94a3b8', padding: '4px', borderRadius: '4px' }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* TABS HEADER */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          background: '#fafafa',
          padding: '0 1rem'
        }}>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              padding: '0.65rem 0.9rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: activeTab === 'profile' ? '#0284c7' : '#64748b',
              borderBottom: activeTab === 'profile' ? '2px solid #0284c7' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <User size={14} />
            <span>My Profile</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            style={{
              padding: '0.65rem 0.9rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: activeTab === 'security' ? '#0284c7' : '#64748b',
              borderBottom: activeTab === 'security' ? '2px solid #0284c7' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <KeyRound size={14} />
            <span>Change Password</span>
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            style={{
              padding: '0.65rem 0.9rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: activeTab === 'permissions' ? '#0284c7' : '#64748b',
              borderBottom: activeTab === 'permissions' ? '2px solid #0284c7' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ShieldCheck size={14} />
            <span>Role Permissions</span>
          </button>
        </div>

        {/* TAB 1: MY PROFILE */}
        {activeTab === 'profile' && (
          <form onSubmit={handleUpdateProfile}>
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {profileMessage && (
                <div style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: profileMessage.type === 'success' ? '#ecfdf5' : '#fef2f2',
                  border: `1px solid ${profileMessage.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                  color: profileMessage.type === 'success' ? '#065f46' : '#991b1b'
                }}>
                  {profileMessage.type === 'success' ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
                  <span>{profileMessage.text}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-control"
                    disabled
                    value={user?.username || ''}
                    style={{ background: '#f1f5f9', cursor: 'not-allowed', fontWeight: 600 }}
                  />
                  <span style={{ fontSize: '0.675rem', color: '#94a3b8', marginTop: '2px', display: 'block' }}>
                    Username cannot be changed
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Assigned Role</label>
                  <div style={{
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 0.65rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px'
                  }}>
                    <span className={`role-badge-pill role-badge-${role || 'sales'}`}>
                      {roleLabel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Full Display Name *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Tariq Mehmood"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address (Optional)</label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@latiftraders.com"
                />
              </div>
            </div>

            <div style={{
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem'
            }}>
              <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button type="submit" disabled={profileSaving} className="btn btn-primary btn-sm">
                {profileSaving ? 'Saving...' : 'Save Profile Details'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: CHANGE PASSWORD */}
        {activeTab === 'security' && (
          <form onSubmit={handleChangePassword}>
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {passwordMessage && (
                <div style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: passwordMessage.type === 'success' ? '#ecfdf5' : '#fef2f2',
                  border: `1px solid ${passwordMessage.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                  color: passwordMessage.type === 'success' ? '#065f46' : '#991b1b'
                }}>
                  {passwordMessage.type === 'success' ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
                  <span>{passwordMessage.text}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Current Password *</label>
                <input
                  type="password"
                  className="form-control"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password *</label>
                <input
                  type="password"
                  className="form-control"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password *</label>
                <input
                  type="password"
                  className="form-control"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>
            </div>

            <div style={{
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem'
            }}>
              <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button type="submit" disabled={passwordSaving} className="btn btn-primary btn-sm">
                {passwordSaving ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: ROLE PERMISSIONS */}
        {activeTab === 'permissions' && (
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{
              padding: '0.65rem 0.85rem',
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '6px',
              fontSize: '0.775rem',
              color: '#0369a1',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Info size={16} flexShrink={0} />
              <span>
                Permissions are governed by your assigned role (<strong>{roleLabel}</strong>). Contact a system administrator to adjust your permissions.
              </span>
            </div>

            <div style={{
              maxHeight: '280px',
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: '6px'
            }}>
              {permissionsList.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderBottom: idx < permissionsList.length - 1 ? '1px solid #f1f5f9' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.775rem',
                    background: item.granted ? '#ffffff' : '#fafafa'
                  }}
                >
                  <span style={{ color: item.granted ? '#0f172a' : '#94a3b8', fontWeight: item.granted ? 600 : 400 }}>
                    {item.label}
                  </span>
                  <span style={{
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontSize: '0.675rem',
                    fontWeight: 700,
                    background: item.granted ? '#ecfdf5' : '#f1f5f9',
                    color: item.granted ? '#059669' : '#94a3b8',
                    border: `1px solid ${item.granted ? '#a7f3d0' : '#e2e8f0'}`
                  }}>
                    {item.granted ? 'Allowed' : 'Restricted'}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
              <button type="button" onClick={onClose} className="btn btn-primary btn-sm">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
