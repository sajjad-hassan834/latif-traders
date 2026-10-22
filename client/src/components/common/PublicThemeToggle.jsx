import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getSavedPublicTheme, applyPublicTheme } from '../../utils/theme';

export default function PublicThemeToggle({ style = {} }) {
  const [theme, setTheme] = useState(() => getSavedPublicTheme());

  useEffect(() => {
    const handleSync = (e) => {
      if (e?.detail) setTheme(e.detail);
    };
    window.addEventListener('public_theme_changed', handleSync);
    return () => window.removeEventListener('public_theme_changed', handleSync);
  }, []);

  const toggle = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    applyPublicTheme(nextTheme);
    setTheme(nextTheme);
  };

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      className="public-theme-toggle"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        background: 'var(--pub-bg-card, #ffffff)',
        border: '1px solid var(--pub-border, #cbd5e1)',
        color: 'var(--pub-text, #0f172a)',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        flexShrink: 0,
        ...style
      }}
    >
      {isDark ? (
        <Sun size={17} color="#fbbf24" strokeWidth={2.2} />
      ) : (
        <Moon size={17} color="#475569" strokeWidth={2.2} />
      )}
    </button>
  );
}
