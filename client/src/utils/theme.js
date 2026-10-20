import { api } from './api';

export function getInitialTheme() {
  const saved = localStorage.getItem('lt_theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return 'light';
}

let isApplying = false;

export function applyTheme(theme, skipDispatch = false) {
  const active = (theme === 'dark' || theme === 'light') ? theme : 'light';
  localStorage.setItem('lt_theme', active);
  document.documentElement.setAttribute('data-theme', active);
  document.documentElement.style.colorScheme = active;

  if (active === 'dark') {
    document.body.classList.add('theme-dark');
    document.body.classList.remove('theme-light');
  } else {
    document.body.classList.add('theme-light');
    document.body.classList.remove('theme-dark');
  }

  if (!skipDispatch && !isApplying) {
    isApplying = true;
    try {
      window.dispatchEvent(new CustomEvent('theme_changed', { detail: active }));
    } finally {
      isApplying = false;
    }
  }

  return active;
}

export function toggleTheme(currentTheme) {
  const active = currentTheme || localStorage.getItem('lt_theme') || 'light';
  const next = active === 'dark' ? 'light' : 'dark';
  applyTheme(next);

  // Sync to server settings if user has active session
  const token = localStorage.getItem('lt_token');
  if (token) {
    api.post('/settings', { theme: next }).catch(() => {});
  }

  return next;
}
