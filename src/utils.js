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
 * Convert a remote image URL into a base64 data URL so html2canvas can
 * render it (export silently drops cross-origin images whose host does
 * not send CORS headers). Tries a direct CORS load first, then falls
 * back to the wsrv.nl image proxy. Resolves null when both fail.
 */
const imageDataURLCache = new Map();

function imageToDataURL(url) {
  if (!url || url.startsWith('data:')) return Promise.resolve(url);
  if (imageDataURLCache.has(url)) return Promise.resolve(imageDataURLCache.get(url));

  const load = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = src;
  });

  const proxied = 'https://images.weserv.nl/?url=' + encodeURIComponent(url);
  return load(url)
    .catch(() => load(proxied))
    .catch(() => null)
    .then((dataUrl) => {
      imageDataURLCache.set(url, dataUrl);
      return dataUrl;
    });
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

/**
 * Parse the first numeric value from a cm field (handles ranges like "7-12")
 */
function parseCm(val, fallback) {
  if (!val) return fallback;
  const m = String(val).match(/[\d.]+/);
  return m ? Math.max(1, parseFloat(m[0])) : fallback;
}

/**
 * Get product dimensions (width, height, depth) based on its orientation and rotation.
 * orientation: 'front' | 'side' | 'top'
 * rotation: 0 | 90
 */
function getProductDimensions(p, shelfDepth = 48) {
  // Parse original dimensions
  const origW = parseCm(p.width, 10);
  const origH = parseCm(p.height, 20);
  const fallbackD = clamp(origW * 1.3, 4, shelfDepth * 0.85);
  const origD = parseCm(p.depth, fallbackD);

  const orientation = p.orientation || 'front';
  const rotation = parseInt(p.rotation) || 0;

  let w = origW;
  let h = origH;
  let d = origD;

  // Apply Orientation mapping
  if (orientation === 'side') {
    w = origD;
    h = origH;
    d = origW;
  } else if (orientation === 'top') {
    w = origW;
    h = origD;
    d = origH;
  }

  // Apply 90 degree rotation (swaps width and height, depth remains same)
  if (rotation === 90) {
    const temp = w;
    w = h;
    h = temp;
  }

  return { width: w, height: h, depth: d };
}

