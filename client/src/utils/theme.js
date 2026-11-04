import { api } from './api';
import sharedThemes from '../../../shared/themes.json';

export const APP_THEMES = sharedThemes.themes;
export const ALLOWED_THEMES = sharedThemes.allowedThemes;
export const DEFAULT_THEME = sharedThemes.defaultTheme;

export const PUBLIC_THEMES = [
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' }
];

// Scope B (App) storage keys
const APP_THEME_KEY = 'shopos-app-theme';
const LEGACY_APP_KEY = 'lt_theme';

// Scope A (Public) storage key
const PUBLIC_THEME_KEY = 'shopos-public-theme';

// Map legacy theme identifiers if present
export function normalizeAppTheme(raw) {
  if (raw === 'light') return 'classic';
  if (raw === 'emerald') return 'green';
  if (ALLOWED_THEMES.includes(raw)) return raw;
  return DEFAULT_THEME;
}

export function normalizePublicTheme(raw) {
  if (raw === 'dark') return 'dark';
  return 'light';
}

export function getSavedAppTheme() {
  const saved = localStorage.getItem(APP_THEME_KEY) || localStorage.getItem(LEGACY_APP_KEY);
  return normalizeAppTheme(saved);
}

export function getSavedPublicTheme() {
  if (typeof window !== 'undefined' && window.location?.search) {
    const qTheme = new URLSearchParams(window.location.search).get('theme');
    if (qTheme === 'dark' || qTheme === 'light') return qTheme;
  }
  const saved = localStorage.getItem(PUBLIC_THEME_KEY);
  return normalizePublicTheme(saved);
}

/**
 * Activate Scope B: App Theme
 * Sets `data-app-theme` on <html> and removes `data-public-theme`.
 * Portals (modals, dropdowns) inherit from <html>.
 */
export function applyAppTheme(themeId, skipServerSync = false) {
  const active = normalizeAppTheme(themeId);
  localStorage.setItem(APP_THEME_KEY, active);
  localStorage.setItem(LEGACY_APP_KEY, active); // keep legacy key in sync

  const root = document.documentElement;
  root.removeAttribute('data-public-theme');
  root.setAttribute('data-app-theme', active);
  const legacyTheme = active === 'dark' ? 'dark' : (active === 'green' ? 'emerald' : (active === 'indigo' ? 'indigo' : 'light'));
  root.setAttribute('data-theme', legacyTheme);
  root.style.colorScheme = active === 'dark' ? 'dark' : 'light';

  if (document.body) {
    document.body.className = `app-theme-${active} theme-${legacyTheme} ${active === 'dark' ? 'dark dark-mode' : ''}`;
    document.body.setAttribute('data-app-theme', active);
    document.body.setAttribute('data-theme', legacyTheme);
  }

  // Sync with backend preferences if logged in
  if (!skipServerSync) {
    const token = localStorage.getItem('lt_token');
    if (token) {
      api.patch('/me/preferences', { theme: active }).catch(() => {
        // Fallback to legacy endpoint if needed
        api.post('/settings', { theme: active }).catch(() => {});
      });
    }
  }
}

/**
 * Activate Scope A: Public Theme
 * Sets `data-public-theme` on <html> and removes `data-app-theme`.
 */
export function applyPublicTheme(themeId) {
  const active = normalizePublicTheme(themeId);
  localStorage.setItem(PUBLIC_THEME_KEY, active);

  const root = document.documentElement;
  root.removeAttribute('data-app-theme');
  root.removeAttribute('data-theme');
  root.setAttribute('data-public-theme', active);
  root.style.colorScheme = active;

  if (document.body) {
    document.body.className = `public-theme-${active}`;
    document.body.setAttribute('data-public-theme', active);
    document.body.removeAttribute('data-app-theme');
    document.body.removeAttribute('data-theme');
  }
}

export function cycleAppTheme() {
  const current = getSavedAppTheme();
  const themeIds = ALLOWED_THEMES;
  const currentIndex = themeIds.indexOf(current);
  const nextTheme = themeIds[(currentIndex + 1) % themeIds.length];
  applyAppTheme(nextTheme);
  return nextTheme;
}

export function togglePublicTheme() {
  const current = getSavedPublicTheme();
  const nextTheme = current === 'dark' ? 'light' : 'dark';
  applyPublicTheme(nextTheme);
  return nextTheme;
}

export function getCurrentTheme() {
  return getSavedAppTheme();
}

export function setTheme(themeId) {
  applyAppTheme(themeId);
}

export const AVAILABLE_THEMES = APP_THEMES;
export default {
  applyAppTheme,
  applyPublicTheme,
  getSavedAppTheme,
  getSavedPublicTheme,
  cycleAppTheme,
  togglePublicTheme,
  getCurrentTheme,
  setTheme,
  APP_THEMES,
  PUBLIC_THEMES
};
