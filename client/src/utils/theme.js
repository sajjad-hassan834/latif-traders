import { api } from './api';

export const APP_THEMES = [
  { id: 'classic', name: 'Classic Light', icon: '☀️', color: '#0284C7' },
  { id: 'dark', name: 'Midnight Dark', icon: '🌙', color: '#0EA5E9' },
  { id: 'green', name: 'Emerald Green', icon: '🍃', color: '#059669' },
  { id: 'indigo', name: 'Royal Indigo', icon: '🔮', color: '#4F46E5' }
];

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
  if (['classic', 'dark', 'green', 'indigo'].includes(raw)) return raw;
  return 'classic';
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

  window.dispatchEvent(new CustomEvent('app_theme_changed', { detail: active }));
  window.dispatchEvent(new CustomEvent('theme_changed', { detail: active }));
  return active;
}

/**
 * Activate Scope A: Public Site Theme (Landing, Login, Register)
 * Sets `data-public-theme` on <html> and removes `data-app-theme`.
 */
export function applyPublicTheme(themeId) {
  const active = normalizePublicTheme(themeId);
  localStorage.setItem(PUBLIC_THEME_KEY, active);

  const root = document.documentElement;
  root.removeAttribute('data-app-theme');
  root.setAttribute('data-public-theme', active);
  root.style.colorScheme = active === 'dark' ? 'dark' : 'light';

  if (document.body) {
    document.body.className = `public-theme-${active}`;
  }

  window.dispatchEvent(new CustomEvent('public_theme_changed', { detail: active }));
  return active;
}

/**
 * Toggle between Public Light and Dark
 */
export function togglePublicTheme() {
  const current = getSavedPublicTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  return applyPublicTheme(next);
}

/**
 * Toggle between App Themes (Classic -> Dark -> Green -> Indigo -> Classic)
 */
export function toggleAppTheme() {
  const current = getSavedAppTheme();
  const themeIds = APP_THEMES.map(t => t.id);
  const nextIndex = (themeIds.indexOf(current) + 1) % themeIds.length;
  return applyAppTheme(themeIds[nextIndex]);
}

/**
 * Called when logging out or navigating to public pages:
 * Clears app theme attribute so portals and public pages don't leak.
 */
export function activatePublicScope() {
  const pubTheme = getSavedPublicTheme();
  applyPublicTheme(pubTheme);
}

/**
 * Called when logging in or entering authenticated app:
 * Ensures app theme attribute is active on <html>.
 */
export function activateAppScope(preferredTheme) {
  const appTheme = preferredTheme ? normalizeAppTheme(preferredTheme) : getSavedAppTheme();
  applyAppTheme(appTheme, true);
}

// Backwards-compatible aliases
export const applyTheme = applyAppTheme;
export const toggleTheme = toggleAppTheme;
export const AVAILABLE_THEMES = APP_THEMES;

