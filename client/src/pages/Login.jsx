import React, { useState } from 'react';
import { 
  Snowflake, 
  Lock, 
  User, 
  LogIn, 
  ShieldAlert, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Boxes, 
  Zap, 
  HelpCircle,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  X,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
    <div className="login-universe">
      <div className="login-stage">
        {/* LEFT ENTERPRISE SHOWCASE PANEL */}
        <div className="login-hero-pane">
          <div>
            <div className="login-brand-badge">
              <div className="login-brand-icon">
                <Snowflake size={22} />
              </div>
              <div>
                <h2 className="login-brand-title">LATIF TRADERS</h2>
                <div className="login-brand-sub">Frozen Food ERP & POS</div>
              </div>
            </div>

            <div className="login-hero-content">
              <h1 className="login-hero-heading">
                Cold-Chain & <span>Commerce</span> System.
              </h1>
              <p className="login-hero-desc">
                High-volume frozen food wholesale, cold room batch expiry tracking, counter POS, and automated ledgers.
              </p>

              <div className="login-feature-list">
                <div className="login-feature-item">
                  <div className="login-feature-icon">
                    <Boxes size={15} />
                  </div>
                  <div className="login-feature-text">
                    <h4>Sub-Zero FIFO Batch Control</h4>
                    <p>Expiry dates & cold room rack assignments.</p>
                  </div>
                </div>

                <div className="login-feature-item">
                  <div className="login-feature-icon">
                    <Zap size={15} />
                  </div>
                  <div className="login-feature-text">
                    <h4>Counter POS & Thermal Billing</h4>
                    <p>Barcode checkout, quick cash & thermal receipts.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="login-hero-footer">
            <div className="login-status-indicator">
              <span className="login-pulse-dot"></span>
              <span>All Systems Online</span>
            </div>
            <span>v2.4 Enterprise</span>
          </div>
        </div>

        {/* RIGHT AUTHENTICATION CARD */}
        <div className="login-form-pane">
          <div>
            <div className="login-form-header">
              <h3>Sign In</h3>
              <p>Enter your staff credentials to access the terminal.</p>
            </div>

            {errorMsg && (
              <div style={{
                padding: '0.65rem 0.85rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '0.785rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.85rem',
                lineHeight: 1.35
              }}>
                <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="login-field-group">
                <label>Username / Staff ID</label>
                <div className="login-input-wrap">
                  <User size={18} className="login-input-icon" />
                  <input
                    type="text"
                    className="login-input"
                    required
                    autoFocus
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              <div className="login-field-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <label style={{ margin: 0 }}>Password</label>
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
                      background: 'none',
                      border: 'none',
                      color: '#0284c7',
                      fontSize: '0.745rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    <KeyRound size={12} />
                    <span>Forgot Password?</span>
                  </button>
                </div>
                <div className="login-input-wrap">
                  <Lock size={18} className="login-input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="login-input"
                    style={{ paddingRight: '2.75rem' }}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0.85rem 0 1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: '#475569', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ borderRadius: '4px', accentColor: '#0284c7' }}
                  />
                  <span>Keep me signed in</span>
                </label>
                <span style={{ fontSize: '0.775rem', color: '#64748b' }}>
                  Press <kbd style={{ padding: '2px 5px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.7rem' }}>Enter ↵</kbd>
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="login-submit-btn"
              >
                <LogIn size={18} />
                <span>{loading ? 'Authenticating...' : 'Sign In to Workspace'}</span>
              </button>
            </form>
          </div>

          {/* SECURE TERMINAL NOTICE */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.65rem', 
              padding: '0.75rem 0.9rem', 
              background: '#f8fafc', 
              borderRadius: '8px', 
              border: '1px solid #e2e8f0',
              marginBottom: '1rem'
            }}>
              <ShieldCheck size={18} style={{ color: '#0284c7', flexShrink: 0 }} />
              <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
                <strong style={{ color: '#1e293b' }}>Authorized Staff Access Only</strong><br />
                User accounts and role permissions are managed exclusively by the Administrator.
              </div>
            </div>

            <div className="login-footer-trust">
              <ShieldCheck size={14} style={{ color: '#10b981' }} />
              <span>TLS 1.3 Encrypted • Latif Traders Security Guard</span>
            </div>
          </div>
        </div>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      {showForgotModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '440px', width: '90%', animation: 'modalFadeIn 0.2s ease-out' }}>
            <div className="modal-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={18} style={{ color: '#0284c7' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>Staff Password Reset</h3>
              </div>
              <button 
                onClick={() => setShowForgotModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
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
                  borderBottom: forgotTab === 'request' ? '2px solid #0284c7' : '2px solid transparent',
                  background: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: forgotTab === 'request' ? '#0284c7' : '#64748b',
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
                  borderBottom: forgotTab === 'status' ? '2px solid #0284c7' : '2px solid transparent',
                  background: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: forgotTab === 'status' ? '#0284c7' : '#64748b',
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
                    style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
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
                      style={{ padding: '0 1rem', whiteSpace: 'nowrap', width: 'auto' }}
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

