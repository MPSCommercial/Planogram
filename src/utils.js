/* ═══════════════════════════════════════════════════════
   utils.js — Shared utility functions
   ═══════════════════════════════════════════════════════ */

const $ = (id) => document.getElementById(id);

/**
 * Clamp a number between min and max
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Escape HTML entities
 */
function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Determine contrasting text color for a given hex background
 */
function contrast(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.58 ? '#1b1a18' : '#fff';
}

/**
 * Get initials from a product name (max 2 characters)
 */
function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/**
 * Truncate name if too long
 */
function shortName(name) {
  return name.length > 16 ? name.slice(0, 14) + '..' : name;
}

/**
 * Show toast notification
 */
function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

/**
 * Generate a unique ID
 */
function uid() {
  return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}
