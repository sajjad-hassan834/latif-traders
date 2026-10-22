import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  User, 
  ArrowRight, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Store,
  Sun,
  Moon,
  X,
  XCircle,
  CheckCircle2,
  Clock,
  Send,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { getSavedPublicTheme, applyPublicTheme } from '../utils/theme';

export default function Login({ onNavigateRegister, onNavigateLanding }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Field focus states
  const [focusedField, setFocusedField] = useState(null);

  // Theme Sync
  const [theme, setTheme] = useState(() => getSavedPublicTheme());
  const isDark = theme === 'dark';

  useEffect(() => {
    applyPublicTheme(getSavedPublicTheme());
    const handleThemeSync = (e) => {
      if (e?.detail) setTheme(e.detail);
    };
    window.addEventListener('public_theme_changed', handleThemeSync);
    return () => window.removeEventListener('public_theme_changed', handleThemeSync);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyPublicTheme(next);
    setTheme(next);
  };

  const t = {
    pageBg: isDark ? '#0b1120' : '#F0F4F8',
    textColor: isDark ? '#f8fafc' : '#111827',
    headerBg: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
    headerBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
    cardBg: isDark ? '#131d31' : '#FFFFFF',
    cardBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
    cardShadow: isDark ? '0 25px 60px -15px rgba(0, 0, 0, 0.7)' : '0 4px 24px rgba(0,0,0,0.08)',
    inputBg: isDark ? '#0f172a' : '#ffffff',
    inputBorder: isDark ? 'rgba(255, 255, 255, 0.14)' : '#E5E7EB',
    inputText: isDark ? '#ffffff' : '#111827',
    labelColor: isDark ? '#cbd5e1' : '#374151',
    subText: isDark ? '#94a3b8' : '#6B7280',
    titleColor: isDark ? '#ffffff' : '#111827',
    noticeBg: isDark ? '#0f172a' : '#F9FAFB',
    noticeBorder: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6'
  };

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotTab, setForgotTab] = useState('request'); // 'request' or 'status'
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotNote, setForgotNote] = useState('');
  const [forgotContact, setForgotContact] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('');
  const [forgotErrorMsg, setForgotErrorMsg] = useState('');
  const [statusResult, setStatusResult] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      setLoading(true);
      await login(username, password);
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('failed')) {
        setErrorMsg('Backend server unreachable. Connect your Railway URL in Vercel settings (VITE_API_URL).');
      } else {
        setErrorMsg(msg || 'Invalid username or password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotErrorMsg('');
    setForgotSuccessMsg('');
    if (!forgotUsername.trim()) {
      setForgotErrorMsg('Please enter your staff username.');
      return;
    }

    try {
      setForgotSubmitting(true);
      const res = await api.post('/auth/forgot-password', {
        username: forgotUsername.trim(),
        request_note: forgotNote.trim(),
        contact_info: forgotContact.trim()
      });

      if (res.success) {
        setForgotSuccessMsg(res.message);
      } else {
        setForgotErrorMsg(res.message || 'Failed to submit reset request.');
      }
    } catch (err) {
      setForgotErrorMsg(err.message || 'Server error submitting request.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleCheckStatus = async (e) => {
    e.preventDefault();
    setForgotErrorMsg('');
    if (!forgotUsername.trim()) {
      setForgotErrorMsg('Please enter your staff username.');
      return;
    }

    try {
      setStatusLoading(true);
      setStatusResult(null);
      const res = await api.get(`/auth/forgot-password-status/${encodeURIComponent(forgotUsername.trim())}`);
      if (res.success) {
        if (!res.request) {
          setForgotErrorMsg(`No reset requests found for "${forgotUsername}".`);
        } else {
          setStatusResult(res.request);
        }
      } else {
        setForgotErrorMsg(res.message || 'Failed to check status.');
      }
    } catch (err) {
      setForgotErrorMsg(err.message || 'Error checking status.');
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: t.pageBg,
      color: t.textColor,
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* ═════════ TOP NAVBAR (Identical to Register page) ═════════ */}
      <header style={{
        padding: '16px 32px',
        borderBottom: `1px solid ${t.headerBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: t.headerBg,
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
      }}>
        <div
          onClick={onNavigateLanding}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <img
            src="/logo.png"
            alt="ShopOS Logo"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              objectFit: 'contain',
              boxShadow: '0 2px 8px rgba(2, 102, 254, 0.25)'
            }}
          />
          <span style={{ fontSize: '20px', fontWeight: 800, color: t.titleColor, letterSpacing: '-0.5px' }}>
            Shop<span style={{ color: '#0266FE' }}>OS</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '14px' }}>
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: `1px solid ${t.headerBorder}`,
              background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
              color: t.textColor,
              cursor: 'pointer'
            }}
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
          <button
            onClick={onNavigateRegister}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid #0266FE',
              background: '#0266FE',
              color: '#ffffff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '13px',
              boxShadow: '0 2px 8px rgba(2, 102, 254, 0.25)',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#0052cc'}
            onMouseLeave={e => e.currentTarget.style.background = '#0266FE'}
          >
            Sign Up
          </button>
        </div>
      </header>

      {/* ═════════ CENTERED CARD CONTAINER ═════════ */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 20px'
      }}>
        <div style={{
          width: '480px',
          maxWidth: '90vw',
          background: t.cardBg,
          borderRadius: '16px',
          boxShadow: t.cardShadow,
          padding: '40px 48px',
          border: `1px solid ${t.cardBorder}`,
          boxSizing: 'border-box'
        }}>
          {/* 1. LOGO + BRAND (top center) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '32px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              marginBottom: '8px'
            }}>
              <img
                src="/logo.png"
                alt="ShopOS Logo"
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  objectFit: 'contain',
                  boxShadow: '0 4px 14px rgba(2, 102, 254, 0.28)'
                }}
              />
              <span style={{ fontSize: '24px', fontWeight: 800, color: t.titleColor, letterSpacing: '-0.5px' }}>
                Shop<span style={{ color: '#0266FE' }}>OS</span>
              </span>
            </div>
            <div style={{ fontSize: '13px', color: t.subText, margin: 0, textAlign: 'center' }}>
              Sign in to your account
            </div>
          </div>

          {/* ERROR ALERT BANNER */}
          {errorMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '13px',
              marginBottom: '20px'
            }}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 2. FORM FIELDS */}
          <form onSubmit={handleSubmit}>
            {/* Email or Username */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: t.labelColor,
                marginBottom: '6px'
              }}>
                Email or Username
              </label>
              <div style={{ position: 'relative' }}>
                <User
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '15px',
                    color: focusedField === 'username' ? '#0266FE' : '#9CA3AF',
                    transition: 'color 0.2s'
                  }}
                />
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Enter your email or username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    width: '100%',
                    height: '48px',
                    borderRadius: '10px',
                    border: focusedField === 'username' ? '1px solid #0266FE' : `1px solid ${t.inputBorder}`,
                    boxShadow: focusedField === 'username' ? '0 0 0 3px rgba(2, 102, 254, 0.15)' : 'none',
                    background: t.inputBg,
                    color: t.inputText,
                    fontSize: '14px',
                    padding: '0 14px 0 44px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s'
                  }}
                />
              </div>
            </div>

            {/* Password with Forgot Password link */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: t.labelColor, margin: 0 }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotUsername(username);
                    setForgotSuccessMsg('');
                    setForgotErrorMsg('');
                    setStatusResult(null);
                    setShowForgotModal(true);
                  }}
                  style={{
                    fontSize: '12px',
                    color: '#0266FE',
                    fontWeight: 600,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Forgot Password?
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <Lock
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '15px',
                    color: focusedField === 'password' ? '#0266FE' : '#9CA3AF',
                    transition: 'color 0.2s'
                  }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    width: '100%',
                    height: '48px',
                    borderRadius: '10px',
                    border: focusedField === 'password' ? '1px solid #0266FE' : `1px solid ${t.inputBorder}`,
                    boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(2, 102, 254, 0.15)' : 'none',
                    background: t.inputBg,
                    color: t.inputText,
                    fontSize: '14px',
                    padding: '0 44px 0 44px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '15px',
                    background: 'none',
                    border: 'none',
                    color: '#9CA3AF',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* "Keep me signed in" checkbox */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  accentColor: '#0266FE',
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              />
              <label
                htmlFor="rememberMe"
                style={{
                  fontSize: '13px',
                  color: t.labelColor,
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                Keep me signed in
              </label>
            </div>

            {/* 3. SIGN IN BUTTON */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '10px',
                border: 'none',
                background: '#0266FE',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(2, 102, 254, 0.35)',
                transition: 'background 0.2s, opacity 0.2s',
                opacity: loading ? 0.8 : 1
              }}
              onMouseEnter={e => !loading && (e.currentTarget.style.background = '#0052cc')}
              onMouseLeave={e => !loading && (e.currentTarget.style.background = '#0266FE')}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* 4. DIVIDER */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            margin: '20px 0',
            color: '#9CA3AF',
            fontSize: '12px'
          }}>
            <div style={{ flex: 1, height: '1px', background: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }} />
            <span style={{ padding: '0 12px' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }} />
          </div>

          {/* 5. BOTTOM LINKS */}
          <div style={{ textAlign: 'center', fontSize: '14px', color: t.subText }}>
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onNavigateRegister}
              style={{
                background: 'none',
                border: 'none',
                color: '#0266FE',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0
              }}
            >
              Sign Up
            </button>
          </div>
        </div>
      </main>

      {/* ═════════ FORGOT PASSWORD MODAL ═════════ */}
      {showForgotModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '440px', width: '90%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Staff Password Reset</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Submit a ticket or check status of your request</p>
              </div>
              <button 
                type="button"
                className="modal-close-btn"
                onClick={() => setShowForgotModal(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => { setForgotTab('request'); setForgotErrorMsg(''); setForgotSuccessMsg(''); }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: 'none',
                  borderBottom: forgotTab === 'request' ? '2px solid #0266FE' : '2px solid transparent',
                  background: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: forgotTab === 'request' ? '#0266FE' : '#64748b',
                  cursor: 'pointer'
                }}
              >
                1. Submit Request
              </button>
              <button
                type="button"
                onClick={() => { setForgotTab('status'); setForgotErrorMsg(''); setForgotSuccessMsg(''); }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: 'none',
                  borderBottom: forgotTab === 'status' ? '2px solid #0266FE' : '2px solid transparent',
                  background: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: forgotTab === 'status' ? '#0266FE' : '#64748b',
                  cursor: 'pointer'
                }}
              >
                2. Check Status
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.25rem' }}>
              {forgotErrorMsg && (
                <div style={{
                  padding: '0.65rem 0.85rem',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  color: '#b91c1c',
                  fontSize: '0.785rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <XCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{forgotErrorMsg}</span>
                </div>
              )}

              {forgotSuccessMsg && (
                <div style={{
                  padding: '0.75rem 0.9rem',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  color: '#15803d',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  lineHeight: 1.4
                }}>
                  <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{forgotSuccessMsg}</span>
                </div>
              )}

              {forgotTab === 'request' ? (
                <form onSubmit={handleForgotSubmit}>
                  <p style={{ fontSize: '0.785rem', color: '#64748b', margin: '0 0 1rem', lineHeight: 1.4 }}>
                    Enter your staff username. Your request will be forwarded to the Administrator to reset your password.
                  </p>

                  <div className="login-field-group" style={{ marginBottom: '0.85rem' }}>
                    <label style={{ fontSize: '0.785rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>
                      Your Username / Staff ID *
                    </label>
                    <div className="login-input-wrap">
                      <User size={16} className="login-input-icon" />
                      <input
                        type="text"
                        className="login-input"
                        required
                        placeholder="e.g. cashier"
                        value={forgotUsername}
                        onChange={(e) => setForgotUsername(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="login-field-group" style={{ marginBottom: '0.85rem' }}>
                    <label style={{ fontSize: '0.785rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>
                      Contact Number / Cell (Optional)
                    </label>
                    <input
                      type="text"
                      className="login-input"
                      placeholder="e.g. 0300-1234567"
                      value={forgotContact}
                      onChange={(e) => setForgotContact(e.target.value)}
                    />
                  </div>

                  <div className="login-field-group" style={{ marginBottom: '1.25rem' }}>
                    <label style={{ fontSize: '0.785rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>
                      Message for Admin (Optional)
                    </label>
                    <textarea
                      className="login-input"
                      style={{ height: '65px', resize: 'none' }}
                      placeholder="e.g. Forgot password, please assign new password for counter POS"
                      value={forgotNote}
                      onChange={(e) => setForgotNote(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={forgotSubmitting}
                    className="login-submit-btn"
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: '#0266FE'
                    }}
                  >
                    <Send size={16} />
                    <span>{forgotSubmitting ? 'Submitting to Admin...' : 'Submit Request to Admin'}</span>
                  </button>
                </form>
              ) : (
                <div>
                  <p style={{ fontSize: '0.785rem', color: '#64748b', margin: '0 0 1rem', lineHeight: 1.4 }}>
                    Check if your Administrator has approved your password reset request.
                  </p>

                  <form onSubmit={handleCheckStatus} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <input
                      type="text"
                      className="login-input"
                      required
                      placeholder="Enter username to check"
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={statusLoading}
                      className="login-submit-btn"
                      style={{ padding: '0 1rem', whiteSpace: 'nowrap', width: 'auto', background: '#0266FE' }}
                    >
                      {statusLoading ? 'Checking...' : 'Check Status'}
                    </button>
                  </form>

                  {statusResult && (
                    <div style={{
                      padding: '1rem',
                      background: statusResult.status === 'approved' ? '#f0fdf4' : statusResult.status === 'pending' ? '#fffbeb' : '#fef2f2',
                      border: `1px solid ${statusResult.status === 'approved' ? '#86efac' : statusResult.status === 'pending' ? '#fde68a' : '#fecaca'}`,
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      lineHeight: 1.5
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: '#1e293b' }}>Status:</span>
                        <span className={`badge ${
                          statusResult.status === 'approved' ? 'badge-success' :
                          statusResult.status === 'pending' ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {statusResult.status.toUpperCase()}
                        </span>
                      </div>

                      {statusResult.status === 'pending' && (
                        <div style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Clock size={15} />
                          <span>Request is awaiting review by Administrator.</span>
                        </div>
                      )}

                      {statusResult.status === 'approved' && (
                        <div>
                          <div style={{ color: '#15803d', fontWeight: 600, marginBottom: '0.35rem' }}>
                            ✓ Request Approved by Admin!
                          </div>
                          {statusResult.temporary_password && (
                            <div style={{ background: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #bbf7d0', marginBottom: '0.5rem' }}>
                              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Your New Password:</span><br />
                              <strong style={{ fontSize: '1rem', color: '#0f172a', letterSpacing: '1px' }}>{statusResult.temporary_password}</strong>
                            </div>
                          )}
                          {statusResult.admin_note && (
                            <div style={{ color: '#334155', fontSize: '0.75rem' }}>
                              <strong>Note from Admin:</strong> {statusResult.admin_note}
                            </div>
                          )}
                        </div>
                      )}

                      {statusResult.status === 'rejected' && (
                        <div style={{ color: '#b91c1c' }}>
                          <strong>Request Rejected:</strong> {statusResult.admin_note || 'Please contact Administrator directly.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
