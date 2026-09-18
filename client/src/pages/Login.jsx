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
  ReceiptText, 
  TrendingUp,
  Crown,
  ShoppingCart,
  Package,
  Calculator
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

  const setDemoUser = (u, p) => {
    setUsername(u);
    setPassword(p);
    setErrorMsg('');
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
                  <span style={{ fontSize: '0.725rem', color: '#64748b' }}>Default: role123</span>
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

          {/* QUICK ROLE SELECTOR FOR DEMO / ACCESS */}
          <div>
            <div className="login-demo-section">
              <div className="login-demo-label">
                <span>Quick Role Access</span>
                <span style={{ color: '#0284c7', fontWeight: 600 }}>Click to fill</span>
              </div>
              <div className="login-demo-grid">
                <button
                  type="button"
                  onClick={() => setDemoUser('admin', 'admin123')}
                  className={`login-demo-btn ${username === 'admin' ? 'active' : ''}`}
                >
                  <div className="login-demo-badge" style={{ color: '#d97706', background: '#fef3c7', borderColor: '#fde68a' }}>
                    <Crown size={14} />
                  </div>
                  <div className="login-demo-info">
                    <span className="login-demo-title">Administrator</span>
                    <span className="login-demo-user">admin</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDemoUser('cashier', 'cashier123')}
                  className={`login-demo-btn ${username === 'cashier' ? 'active' : ''}`}
                >
                  <div className="login-demo-badge" style={{ color: '#0284c7', background: '#e0f2fe', borderColor: '#bae6fd' }}>
                    <ShoppingCart size={14} />
                  </div>
                  <div className="login-demo-info">
                    <span className="login-demo-title">Cashier Staff</span>
                    <span className="login-demo-user">cashier</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDemoUser('store', 'store123')}
                  className={`login-demo-btn ${username === 'store' ? 'active' : ''}`}
                >
                  <div className="login-demo-badge" style={{ color: '#059669', background: '#d1fae5', borderColor: '#a7f3d0' }}>
                    <Package size={14} />
                  </div>
                  <div className="login-demo-info">
                    <span className="login-demo-title">Store & Stock</span>
                    <span className="login-demo-user">store</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDemoUser('accountant', 'accountant123')}
                  className={`login-demo-btn ${username === 'accountant' ? 'active' : ''}`}
                >
                  <div className="login-demo-badge" style={{ color: '#7c3aed', background: '#ede9fe', borderColor: '#ddd6fe' }}>
                    <Calculator size={14} />
                  </div>
                  <div className="login-demo-info">
                    <span className="login-demo-title">Accountant</span>
                    <span className="login-demo-user">accountant</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="login-footer-trust">
              <ShieldCheck size={14} style={{ color: '#10b981' }} />
              <span>TLS 1.3 Encrypted • Latif Traders Security Guard</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
