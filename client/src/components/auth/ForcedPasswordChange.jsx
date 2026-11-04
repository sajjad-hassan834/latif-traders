import React, { useState } from 'react';
import { Lock, ShieldAlert, CheckCircle, AlertTriangle, ArrowRight, LogOut } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../common/BrandLogo';

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
      background: 'var(--bg, #F2F6F3)',
      color: 'var(--ink, #0C2B22)',
      padding: '1.5rem',
      fontFamily: 'var(--font-body, system-ui, -apple-system, sans-serif)',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'var(--paper, #FFFFFF)',
        border: '1px solid var(--line, #D3DFD8)',
        borderRadius: '20px',
        boxShadow: 'var(--pub-card-shadow, 0 20px 25px -5px rgba(0, 0, 0, 0.1))',
        padding: '2.25rem',
        boxSizing: 'border-box'
      }}>
        {/* Brand Logo Lockup */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'center' }}>
            <BrandLogo variant="horizontal" size={32} />
          </div>

          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'rgba(244, 166, 42, 0.15)',
            color: 'var(--gold, #F4A62A)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem'
          }}>
            <ShieldAlert size={28} />
          </div>

          <h2 style={{
            fontFamily: 'var(--font-display, inherit)',
            fontSize: '1.4rem',
            fontWeight: 800,
            color: 'var(--ink, #0C2B22)',
            margin: '0 0 0.5rem',
            letterSpacing: '-0.02em'
          }}>
            Password Change Required
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--mut, #4C6258)', margin: 0, lineHeight: 1.5 }}>
            Hello <strong style={{ color: 'var(--ink, #0C2B22)' }}>{user?.username}</strong>, your account requires a password update before you can access the application.
          </p>
        </div>

        {/* Error / Success Notifications */}
        {errorMsg && (
          <div style={{
            padding: '0.75rem 1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            color: 'var(--red, #D92D5A)',
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
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '10px',
            color: 'var(--green, #10b981)',
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
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink, #0C2B22)', marginBottom: '0.4rem' }}>
              Current (or Temporary) Password *
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--mut, #4C6258)', pointerEvents: 'none' }} />
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter temporary password"
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '10px',
                  border: '1px solid var(--line, #D3DFD8)',
                  background: 'var(--pub-input-bg, var(--paper, #FFFFFF))',
                  color: 'var(--ink, #0C2B22)',
                  padding: '0 14px 0 42px',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink, #0C2B22)', marginBottom: '0.4rem' }}>
              New Password * (min 8 characters)
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--mut, #4C6258)', pointerEvents: 'none' }} />
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new strong password"
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '10px',
                  border: '1px solid var(--line, #D3DFD8)',
                  background: 'var(--pub-input-bg, var(--paper, #FFFFFF))',
                  color: 'var(--ink, #0C2B22)',
                  padding: '0 14px 0 42px',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink, #0C2B22)', marginBottom: '0.4rem' }}>
              Confirm New Password *
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--mut, #4C6258)', pointerEvents: 'none' }} />
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '10px',
                  border: '1px solid var(--line, #D3DFD8)',
                  background: 'var(--pub-input-bg, var(--paper, #FFFFFF))',
                  color: 'var(--ink, #0C2B22)',
                  padding: '0 14px 0 42px',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              height: '46px',
              marginTop: '0.5rem',
              background: 'var(--gold, #F4A62A)',
              color: '#241800',
              borderRadius: '999px',
              border: 'none',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 14px rgba(244, 166, 42, 0.35)',
              transition: 'background 0.15s ease, transform 0.15s ease'
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.filter = 'brightness(0.95)'; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.filter = 'none'; }}
          >
            <span>{loading ? 'Updating Password...' : 'Update Password & Continue'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Footer sign out option */}
        <div style={{ marginTop: '1.75rem', textAlign: 'center', borderTop: '1px solid var(--line, #D3DFD8)', paddingTop: '1rem' }}>
          <button
            type="button"
            onClick={logout}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--mut, #4C6258)',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink, #0C2B22)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--mut, #4C6258)'; }}
          >
            <LogOut size={14} />
            <span>Sign out instead</span>
          </button>
        </div>
      </div>
    </div>
  );
}
