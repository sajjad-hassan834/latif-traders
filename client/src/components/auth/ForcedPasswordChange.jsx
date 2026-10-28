import React, { useState } from 'react';
import { Lock, ShieldAlert, CheckCircle, AlertTriangle, ArrowRight, LogOut } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function ForcedPasswordChange({ onSuccess }) {
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMsg('New password must be different from your temporary password.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/auth/change-password', {
        currentPassword,
        newPassword
      });

      if (res && res.success && res.token) {
        setSuccessMsg('Password updated successfully! Redirecting...');
        localStorage.setItem('lt_token', res.token);
        if (onSuccess) {
          onSuccess(res.token);
        }
      } else {
        setErrorMsg(res?.message || 'Failed to update password.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error updating password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '1.5rem',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
        padding: '2rem',
        boxSizing: 'border-box'
      }}>
        {/* Header Icon & Title */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: '#FEF3C7',
            color: '#D97706',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <ShieldAlert size={30} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.5rem' }}>
            Password Change Required
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0, lineHeight: 1.45 }}>
            Hello <strong>{user?.username}</strong>, your account requires a password update before you can access the application.
          </p>
        </div>

        {/* Error / Success Notifications */}
        {errorMsg && (
          <div style={{
            padding: '0.75rem 1rem',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            color: '#DC2626',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.25rem'
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            padding: '0.75rem 1rem',
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: '8px',
            color: '#065F46',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.25rem'
          }}>
            <CheckCircle size={18} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              Current (or Temporary) Password *
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#94A3B8' }} />
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter temporary password"
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  padding: '0 12px 0 38px',
                  fontSize: '0.875rem',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              New Password * (min 8 characters)
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#94A3B8' }} />
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new strong password"
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  padding: '0 12px 0 38px',
                  fontSize: '0.875rem',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              Confirm New Password *
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#94A3B8' }} />
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  padding: '0 12px 0 38px',
                  fontSize: '0.875rem',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              height: '44px',
              marginTop: '0.5rem',
              background: '#0F766E',
              color: '#FFFFFF',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'background 0.15s ease'
            }}
          >
            <span>{loading ? 'Updating Password...' : 'Update Password & Continue'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Footer sign out option */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '1rem' }}>
          <button
            type="button"
            onClick={logout}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748B',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <LogOut size={14} />
            <span>Sign out instead</span>
          </button>
        </div>
      </div>
    </div>
  );
}
