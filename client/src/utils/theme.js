import { api } from './api';

export const AVAILABLE_THEMES = [
  { id: 'light', name: 'Classic Light', icon: '☀️', color: '#0266fe', desc: 'ShopOS Classic Blue' },
  { id: 'dark', name: 'Midnight Dark', icon: '🌙', color: '#38bdf8', desc: 'OLED Slate Dark' },
  { id: 'emerald', name: 'Emerald Green', icon: '🍃', color: '#059669', desc: 'Fresh Business Green' },
  { id: 'indigo', name: 'Royal Indigo', icon: '🔮', color: '#6366f1', desc: 'Modern Purple/Indigo' }
];

export function getInitialTheme() {
  const saved = localStorage.getItem('lt_theme');
  if (['light', 'dark', 'emerald', 'indigo'].includes(saved)) return saved;
  return 'light';
}

let isApplying = false;

export function applyTheme(theme, skipDispatch = false) {
  const valid = ['light', 'dark', 'emerald', 'indigo'];
  const active = valid.includes(theme) ? theme : 'light';
  localStorage.setItem('lt_theme', active);
  document.documentElement.setAttribute('data-theme', active);
  document.documentElement.style.colorScheme = active === 'dark' ? 'dark' : 'light';

  document.body.classList.remove('theme-light', 'theme-dark', 'theme-emerald', 'theme-indigo');
  document.body.classList.add(`theme-${active}`);

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
  const order = ['light', 'dark', 'emerald', 'indigo'];
  const nextIdx = (order.indexOf(active) + 1) % order.length;
  const next = order[nextIdx];
  applyTheme(next);

  // Sync to server settings if user has active session
  const token = localStorage.getItem('lt_token');
  if (token) {
    api.post('/settings', { theme: next }).catch(() => {});
  }

  return next;
}

