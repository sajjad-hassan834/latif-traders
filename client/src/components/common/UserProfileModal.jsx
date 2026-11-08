import React, { useState, useEffect } from 'react';
import {
  User,
  KeyRound,
  CheckCircle,
  AlertTriangle,
  Lock,
  Mail,
  ShieldCheck
} from 'lucide-react';
import Modal from './Modal';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function UserProfileModal({ isOpen, onClose, initialTab = 'profile' }) {
  const { user, role, roleLabel, isAdmin } = useAuth();
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

  const userInitial = user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U';

  const headerAvatar = (
    <div
      style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #0F766E 0%, #14b8a6 100%)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: '16px',
        boxShadow: '0 4px 12px rgba(15, 118, 110, 0.25)'
      }}
    >
      {userInitial}
    </div>
  );

  const inputStyle = {
    width: '100%',
    height: '44px',
    borderRadius: '10px',
    border: '1px solid #E5E7EB',
    padding: '0 14px',
    fontSize: '14px',
    color: '#111827',
    background: '#ffffff',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '6px'
  };

  const handleInputFocus = (e) => {
    e.currentTarget.style.borderColor = '#0F766E';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(15, 118, 110, 0.1)';
  };

  const handleInputBlur = (e) => {
    e.currentTarget.style.borderColor = '#E5E7EB';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="User Profile & Security"
      subtitle="Manage your personal credentials and account settings"
      icon={headerAvatar}
      maxWidth="520px"
      bodyPadding="0"
    >
      {/* TABS (My Profile / Change Password) */}
      <div
        style={{
          display: 'flex',
          padding: '0 28px',
          borderBottom: '1px solid #F3F4F6',
          background: '#FFFFFF'
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          style={{
            height: '44px',
            fontSize: '13px',
            padding: '0 4px',
            marginRight: '20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'profile' ? '2px solid #0F766E' : '2px solid transparent',
            color: activeTab === 'profile' ? '#0F766E' : '#6B7280',
            fontWeight: activeTab === 'profile' ? 600 : 500,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <User size={15} />
          <span>My Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          style={{
            height: '44px',
            fontSize: '13px',
            padding: '0 4px',
            marginRight: '20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'security' ? '2px solid #0F766E' : '2px solid transparent',
            color: activeTab === 'security' ? '#0F766E' : '#6B7280',
            fontWeight: activeTab === 'security' ? 600 : 500,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <KeyRound size={15} />
          <span>Change Password</span>
        </button>
      </div>

      {/* TAB 1: MY PROFILE */}
      {activeTab === 'profile' && (
        <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {profileMessage && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: profileMessage.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                  border: `1px solid ${profileMessage.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
                  color: profileMessage.type === 'success' ? '#065F46' : '#DC2626'
                }}
              >
                {profileMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                <span>{profileMessage.text}</span>
              </div>
            )}

            {/* Read-only Username + Role Badge */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Username</label>
                <input
                  type="text"
                  disabled
                  value={user?.username || ''}
                  style={{
                    ...inputStyle,
                    background: '#F9FAFB',
                    color: '#9CA3AF',
                    cursor: 'not-allowed'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px', display: 'block' }}>
                  Username cannot be changed
                </span>
              </div>

              <div>
                <label style={labelStyle}>Assigned Role</label>
                <div
                  style={{
                    ...inputStyle,
                    display: 'flex',
                    alignItems: 'center',
                    background: '#F9FAFB'
                  }}
                >
                  <span
                    style={{
                      background: '#FEF2F2',
                      color: '#DC2626',
                      border: '1px solid #FECACA',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}
                  >
                    {roleLabel || 'ADMINISTRATOR'}
                  </span>
                </div>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label style={labelStyle}>Full Display Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Mudassir Arif"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>

            {/* Email Address */}
            <div>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@example.com"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
          </div>

          {/* MODAL FOOTER */}
          <div
            style={{
              padding: '16px 28px 24px',
              borderTop: '1px solid #F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px'
            }}
          >
            <button
              type="button"
              onClick={onClose}
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
              type="submit"
              disabled={profileSaving}
              style={{
                height: '40px',
                padding: '0 20px',
                background: '#0F766E',
                color: '#FFFFFF',
                borderRadius: '10px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: profileSaving ? 'not-allowed' : 'pointer',
                opacity: profileSaving ? 0.7 : 1,
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => !profileSaving && (e.currentTarget.style.background = '#065F46')}
              onMouseLeave={(e) => !profileSaving && (e.currentTarget.style.background = '#0F766E')}
            >
              {profileSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: CHANGE PASSWORD */}
      {activeTab === 'security' && (
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {passwordMessage && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: passwordMessage.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                  border: `1px solid ${passwordMessage.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
                  color: passwordMessage.type === 'success' ? '#065F46' : '#DC2626'
                }}
              >
                {passwordMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                <span>{passwordMessage.text}</span>
              </div>
            )}

            <div>
              <label style={labelStyle}>Current Password *</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>

            <div>
              <label style={labelStyle}>New Password *</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>

            <div>
              <label style={labelStyle}>Confirm New Password *</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
          </div>

          {/* MODAL FOOTER */}
          <div
            style={{
              padding: '16px 28px 24px',
              borderTop: '1px solid #F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px'
            }}
          >
            <button
              type="button"
              onClick={onClose}
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
              type="submit"
              disabled={passwordSaving}
              style={{
                height: '40px',
                padding: '0 20px',
                background: '#0F766E',
                color: '#FFFFFF',
                borderRadius: '10px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: passwordSaving ? 'not-allowed' : 'pointer',
                opacity: passwordSaving ? 0.7 : 1,
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => !passwordSaving && (e.currentTarget.style.background = '#065F46')}
              onMouseLeave={(e) => !passwordSaving && (e.currentTarget.style.background = '#0F766E')}
            >
              {passwordSaving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
