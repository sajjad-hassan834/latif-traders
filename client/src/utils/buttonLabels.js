/**
 * Marks labelled action buttons (icon + text) with data-has-label="1" so CSS
 * (theme-buttons.css) can drop the decorative icon. Icon-only buttons, sidebar,
 * header controls, dropdown rows and filter selectors are intentionally skipped.
 */
const ACTION_BUTTON = 'button[class*="btn"], button[class*="pill"], button[class*="action"]';
const EXCLUDE =
  '.sidebar *, aside *, nav *, .dropdown-item, .modal-close-btn, .sadax-filter-btn, .sadax-select-btn, .sadax-icon-btn, .sadax-action-dots-btn, .btn-table-dots, .pos-stepper-btn, [class*="dots"], [class*="icon-btn"], [data-keep-icon]';

function markButtons(root = document) {
  root.querySelectorAll(ACTION_BUTTON).forEach((el) => {
    if (el.tagName !== 'BUTTON') return;
    const hasIcon = el.querySelector('svg');
    const hasText = (el.textContent || '').trim().length > 0;
    const excluded = el.matches(EXCLUDE);
    if (hasIcon && hasText && !excluded) el.setAttribute('data-has-label', '1');
    else el.removeAttribute('data-has-label');
  });
}

export function initButtonLabels() {
  if (typeof window === 'undefined' || window.__buttonLabelsInit) return;
  window.__buttonLabelsInit = true;
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      markButtons();
    });
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  schedule();
}
