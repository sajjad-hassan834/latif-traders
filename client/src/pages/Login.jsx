import React, { useState, useEffect } from 'react';
import BrandLogo from '../components/common/BrandLogo';
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
  Loader2,
  Copy,
  Check
} from 'lucide-react';
import PublicThemeToggle from '../components/common/PublicThemeToggle';
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
    pageBg: 'var(--bg)',
    textColor: 'var(--ink)',
    headerBg: 'color-mix(in srgb, var(--bg) 92%, transparent)',
    headerBorder: 'var(--line)',
    cardBg: 'var(--paper)',
    cardBorder: 'var(--line)',
    cardShadow: 'var(--pub-card-shadow)',
    inputBg: 'var(--pub-input-bg)',
    inputBorder: 'var(--line)',
    inputText: 'var(--ink)',
    labelColor: 'var(--ink)',
    subText: 'var(--mut)',
    titleColor: 'var(--ink)',
    noticeBg: 'var(--soft)',
    noticeBorder: 'var(--line)'
  };

  const [authNotice, setAuthNotice] = useState(() => {
    const notice = sessionStorage.getItem('auth_notice');
    if (notice) {
      sessionStorage.removeItem('auth_notice');
      return notice;
    }
    return '';
  });

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotTab, setForgotTab] = useState('request'); // 'request' or 'status'
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotNote, setForgotNote] = useState('');
  const [forgotContact, setForgotContact] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('');
  const [forgotToken, setForgotToken] = useState('');
  const [tokenCopied, setTokenCopied] = useState(false);
  const [forgotErrorMsg, setForgotErrorMsg] = useState('');
  const [statusTokenInput, setStatusTokenInput] = useState('');
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
      const isNetworkUnreachable = !err.status && (
        err.name === 'TypeError' ||
        msg.toLowerCase().includes('failed to fetch') ||
        msg.toLowerCase().includes('networkerror')
      );
      if (isNetworkUnreachable) {
        setErrorMsg('Backend server unreachable. Please check connection or retry in a few seconds.');
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
        if (res.reset_token) {
          setForgotToken(res.reset_token);
          setStatusTokenInput(res.reset_token);
        }
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
    const tokenToCheck = (statusTokenInput || forgotToken || '').trim();
    if (!tokenToCheck) {
      setForgotErrorMsg('Please enter your Reset Token.');
      return;
    }

    try {
      setStatusLoading(true);
      setStatusResult(null);
      const res = await api.get(`/auth/forgot-password-status?token=${encodeURIComponent(tokenToCheck)}`);
      if (res && res.success) {
        setStatusResult(res);
      } else {
        setForgotErrorMsg(res.message || 'Failed to check status.');
      }
    } catch (err) {
      setForgotErrorMsg(err.message || 'Invalid or expired reset token.');
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      maxWidth: '100vw',
      boxSizing: 'border-box',
      overflowX: 'hidden',
      background: t.pageBg,
      color: t.textColor,
      fontFamily: 'var(--font-body)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* ═════════ TOP NAVBAR (Identical to Register page) ═════════ */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        width: '100%',
        boxSizing: 'border-box',
        padding: '12px 16px',
        borderBottom: `1px solid ${t.headerBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: t.headerBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
      }}>
        <div
          onClick={onNavigateLanding}
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <BrandLogo variant="horizontal" size={32} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '14px' }}>
          <PublicThemeToggle />
          <button
            onClick={onNavigateRegister}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--gold)', color: '#241800', fontWeight: 600, cursor: 'pointer', fontSize: '13px', borderRadius: '999px', border: 'none', transition: 'transform 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.95)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'none'}
          >
            Sign Up
          </button>
        </div>
      </header>

      {/* ═════════ CENTERED CARD CONTAINER ═════════ */}
      <main style={{
        flex: 1,
        width: '100%',
        maxWidth: '100vw',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '32px 16px 48px',
        overflowX: 'hidden'
      }}>
        <div style={{
          width: 'min(440px, 100%)',
          maxWidth: '100%',
          margin: 'auto 0',
          background: t.cardBg,
          borderRadius: '16px',
          boxShadow: t.cardShadow,
          padding: '32px 24px',
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
              marginBottom: '8px'
            }}>
              <BrandLogo variant="horizontal" size={40} />
            </div>
            <div style={{ fontSize: '13px', color: t.subText, margin: 0, textAlign: 'center' }}>
              Sign in to your account
            </div>
          </div>

          {/* AUTH NOTICE / SESSION REVOCATION BANNER */}
          {authNotice && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#d97706',
              fontSize: '13px',
              marginBottom: '20px'
            }}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{authNotice}</span>
            </div>
          )}

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
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    color: focusedField === 'username' ? 'var(--deep)' : 'var(--mut)',
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
                    border: focusedField === 'username' ? '2px solid var(--gold)' : '1px solid var(--line)',
                    boxShadow: focusedField === 'username' ? '0 0 0 3px rgba(244, 166, 42, 0.25)' : 'none',
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
                    color: 'var(--leaf)',
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
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    color: focusedField === 'password' ? 'var(--deep)' : 'var(--mut)',
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
                    border: focusedField === 'password' ? '2px solid var(--gold)' : '1px solid var(--line)',
                    boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(244, 166, 42, 0.25)' : 'none',
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
                    top: '50%',
                    transform: 'translateY(-50%)',
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
                  accentColor: 'var(--deep)',
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
                background: 'var(--gold)', color: '#241800', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '999px', border: 'none', boxShadow: '0 4px 14px rgba(244, 166, 42, 0.35)',
                transition: 'background 0.2s, opacity 0.2s',
                opacity: loading ? 0.8 : 1
              }}
              onMouseEnter={e => !loading && (e.currentTarget.style.background = '#e59920')}
              onMouseLeave={e => !loading && (e.currentTarget.style.background = 'var(--gold)')}
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
                color: 'var(--leaf)',
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
                  borderBottom: forgotTab === 'request' ? '2px solid var(--primary, #0F4D3A)' : '2px solid transparent',
                  background: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: forgotTab === 'request' ? 'var(--primary, #0F4D3A)' : '#64748b',
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
                  borderBottom: forgotTab === 'status' ? '2px solid var(--primary, #0F4D3A)' : '2px solid transparent',
                  background: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: forgotTab === 'status' ? 'var(--primary, #0F4D3A)' : '#64748b',
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
                  padding: '0.85rem 1rem',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  marginBottom: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: '#15803d', fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.4, marginBottom: forgotToken ? '0.75rem' : 0 }}>
                    <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{forgotSuccessMsg}</span>
                  </div>

                  {forgotToken && (
                    <div style={{ background: '#ffffff', padding: '0.65rem 0.75rem', borderRadius: '6px', border: '1px solid #dcfce7' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Your Reset Tracking Token:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <code style={{ fontSize: '0.75rem', wordBreak: 'break-all', fontFamily: 'monospace', color: '#0f172a', flex: 1, background: '#f8fafc', padding: '4px 6px', borderRadius: '4px' }}>
                          {forgotToken}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(forgotToken);
                            setTokenCopied(true);
                            setTimeout(() => setTokenCopied(false), 2000);
                          }}
                          style={{
                            padding: '4px 8px',
                            background: tokenCopied ? '#15803d' : 'var(--primary, #0F4D3A)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.72rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {tokenCopied ? <Check size={12} /> : <Copy size={12} />}
                          <span>{tokenCopied ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotTab('status');
                          setStatusTokenInput(forgotToken);
                        }}
                        style={{
                          width: '100%',
                          padding: '0.45rem',
                          background: '#0F766E',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Check Approval Status for this Token →
                      </button>
                    </div>
                  )}
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
                      background: 'var(--primary, #0F4D3A)'
                    }}
                  >
                    <Send size={16} />
                    <span>{forgotSubmitting ? 'Submitting to Admin...' : 'Submit Request to Admin'}</span>
                  </button>
                </form>
              ) : (
                <div>
                  <p style={{ fontSize: '0.785rem', color: '#64748b', margin: '0 0 1rem', lineHeight: 1.4 }}>
                    Enter your Reset Token to check if your Administrator has approved your request.
                  </p>

                  <form onSubmit={handleCheckStatus} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <input
                      type="text"
                      className="login-input"
                      required
                      placeholder="Paste your reset token"
                      value={statusTokenInput}
                      onChange={(e) => setStatusTokenInput(e.target.value)}
                      style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}
                    />
                    <button
                      type="submit"
                      disabled={statusLoading}
                      className="login-submit-btn"
                      style={{ padding: '0 1rem', whiteSpace: 'nowrap', width: 'auto', background: 'var(--primary, #0F4D3A)' }}
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
                          {statusResult.status ? statusResult.status.toUpperCase() : 'UNKNOWN'}
                        </span>
                      </div>

                      {statusResult.status === 'pending' && (
                        <div style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Clock size={15} />
                          <span>Your request is pending review by your Administrator.</span>
                        </div>
                      )}

                      {statusResult.status === 'approved' && (
                        <div>
                          <div style={{ color: '#15803d', fontWeight: 600, marginBottom: '0.35rem' }}>
                            ✓ Request Approved by Admin!
                          </div>
                          <div style={{ background: '#ffffff', padding: '0.65rem 0.75rem', borderRadius: '6px', border: '1px solid #bbf7d0', marginBottom: '0.5rem', color: '#166534', fontSize: '0.785rem' }}>
                            Your Administrator has generated a temporary password. For security, temporary passwords are provided directly by your administrator. Please contact your administrator to receive it, then sign in.
                          </div>
                        </div>
                      )}

                      {statusResult.status === 'rejected' && (
                        <div style={{ color: '#b91c1c' }}>
                          <strong>Request Declined:</strong> Your password reset request was not approved. Please contact your Administrator directly.
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
