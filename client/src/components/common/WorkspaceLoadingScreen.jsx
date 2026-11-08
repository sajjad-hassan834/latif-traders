import React, { useState, useEffect } from 'react';
import BrandLogo from './BrandLogo';
import { BRAND_NAME } from '../../config/brand';
import { RefreshCw, LogIn } from 'lucide-react';

export default function WorkspaceLoadingScreen() {
  const [showTimeoutHelp, setShowTimeoutHelp] = useState(false);

  // Read current saved theme
  const themeName = (typeof window !== 'undefined' && (
    localStorage.getItem('shopos_app_theme') ||
    localStorage.getItem('lt_theme') ||
    'midnight-amber'
  )) || 'midnight-amber';

  const isDark = themeName === 'dark' || themeName === 'midnight-amber' || themeName === 'royal-indigo';

  useEffect(() => {
    // If loading takes > 4.5s (e.g. slow network or pending request), offer quick actions
    const timer = setTimeout(() => {
      setShowTimeoutHelp(true);
    }, 4500);
    return () => clearTimeout(timer);
  }, []);

  const handleReload = () => {
    window.location.reload();
  };

  const handleResetToLogin = () => {
    try {
      localStorage.removeItem('lt_token');
      localStorage.removeItem('lt_user');
      window.location.href = '/login';
    } catch (_) {
      window.location.reload();
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDark
          ? 'radial-gradient(ellipse at 50% 30%, #17223b 0%, #090e1a 100%)'
          : 'radial-gradient(ellipse at 50% 30%, #f0fdf4 0%, #f8fafc 100%)',
        color: isDark ? '#f8fafc' : '#0f172a',
        fontFamily: "'Instrument Sans', system-ui, -apple-system, sans-serif",
        padding: '24px',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Subtle ambient lighting orb */}
      <div
        style={{
          position: 'absolute',
          top: '35%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '380px',
          height: '380px',
          background: isDark
            ? 'radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 65%)'
            : 'radial-gradient(circle, rgba(15, 118, 110, 0.10) 0%, transparent 65%)',
          pointerEvents: 'none',
          borderRadius: '50%',
          filter: 'blur(30px)'
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          zIndex: 1,
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center'
        }}
      >
        {/* Brand Logo with soft entrance animation */}
        <div style={{ transform: 'scale(1.05)', marginBottom: '4px' }}>
          <BrandLogo variant="horizontal" size={40} tone={isDark ? 'light' : 'auto'} />
        </div>

        {/* Status Pill Card */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            background: isDark ? 'rgba(30, 41, 59, 0.85)' : '#ffffff',
            border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #e2e8f0',
            backdropFilter: 'blur(8px)',
            padding: '12px 22px',
            borderRadius: '9999px',
            boxShadow: isDark
              ? '0 10px 30px rgba(0, 0, 0, 0.45)'
              : '0 6px 20px rgba(0, 0, 0, 0.06)'
          }}
        >
          {/* Circular Spinner */}
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              border: isDark ? '2.5px solid rgba(245, 158, 11, 0.25)' : '2.5px solid rgba(15, 118, 110, 0.2)',
              borderTopColor: isDark ? '#F59E0B' : '#0F766E',
              animation: 'workspaceSpin 0.75s linear infinite',
              flexShrink: 0
            }}
          />

          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: isDark ? '#F8FAFC' : '#1e293b',
              letterSpacing: '-0.01em'
            }}
          >
            Loading {BRAND_NAME} Workspace...
          </span>
        </div>

        {/* Progress narrative */}
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            lineHeight: 1.5,
            color: isDark ? '#94A3B8' : '#64748b',
            maxWidth: '340px'
          }}
        >
          Preparing point-of-sale registers, trade catalog, and local encrypted cache.
        </p>

        {/* Timeout Grace Helper: Appears after 4.5 seconds if network or token is stuck */}
        {showTimeoutHelp && (
          <div
            style={{
              marginTop: '12px',
              padding: '14px 18px',
              borderRadius: '12px',
              background: isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.9)',
              border: isDark ? '1px solid rgba(148, 163, 184, 0.2)' : '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              alignItems: 'center',
              animation: 'fadeInHelp 0.25s ease'
            }}
          >
            <span style={{ fontSize: '12px', color: isDark ? '#CBD5E1' : '#475569' }}>
              Workspace taking longer than expected to synchronize?
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '7px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: isDark ? '#F59E0B' : '#0F766E',
                  color: isDark ? '#1E1B18' : '#ffffff',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={13} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleResetToLogin}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '7px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: 'transparent',
                  color: isDark ? '#94A3B8' : '#64748b',
                  border: isDark ? '1px solid rgba(148, 163, 184, 0.3)' : '1px solid #cbd5e1',
                  cursor: 'pointer'
                }}
              >
                <LogIn size={13} />
                Sign In Again
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes workspaceSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeInHelp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

