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
 * Pack shot to draw for a product, following the face it is turned to.
 * Falls back to the front shot when that face was never photographed.
 */
function productImage(p) {
  const faces = p.faces;
  if (!faces) return p.image;
  return faces[p.orientation || 'front'] || faces.front || p.image;
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
 * Total shelf surface in square metres: every shelf board's width × depth.
 * Custom segment widths already add up to spec.width, so they need no special
 * case here.
 */
function shelfAreaM2(spec) {
  const width = parseFloat(spec && spec.width) || 0;
  const depth = parseFloat(spec && spec.depth) || 0;
  const shelves = parseInt(spec && spec.shelves, 10) || 0;
  return (width * depth * shelves) / 10000;
}

/**
 * How many units of a product fit one behind the other on the shelf (max), and
 * how many are actually placed there (used). `product.rows` holds the user's
 * choice; without one, only 1 row is assumed placed — `max` is left for the
 * capacity badge to show what *could* fit, not what's auto-filled.
 */
function depthRows(product, shelfDepth = 48) {
  const dims = getProductDimensions(product, shelfDepth);
  const max = Math.max(1, Math.floor(shelfDepth / dims.depth));
  const wanted = parseInt(product.rows, 10);
  return { max, used: clamp(wanted > 0 ? wanted : 1, 1, max), depth: dims.depth };
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


/**
 * A shelf "column" is one horizontal slot. Stored as:
 *   "p_a"                    one product
 *   ["p_a", "p_b"]           depth layers front→back (index 0 = front)
 *   [["p_a", "p_c"], "p_b"]  a depth layer may itself be a vertical stack, bottom→top
 * Legacy data (plain ids) needs no migration.
 */
function depthLayers(col) { return Array.isArray(col) ? col : [col]; }
function stackIds(layer) { return Array.isArray(layer) ? layer : [layer]; }
/** Every product id in the column, front layer first, bottom→top within a layer. */
function colIds(col) { return depthLayers(col).flatMap(stackIds); }
function flatPlacements(arr) { return (arr || []).flatMap(colIds); }
/** Collapse a list back to the stored form; null when empty. Works for both axes. */
function packCol(items) {
  // A lone layer that is itself a stack must stay wrapped, or it reads as depth layers.
  return items.length === 0 ? null : items.length === 1 && !Array.isArray(items[0]) ? items[0] : items;
}
/** Drop products that fail `keep`, collapsing stacks/columns that end up empty. */
function pruneColumns(arr, keep) {
  return (arr || [])
    .map((col) => packCol(depthLayers(col).map((l) => packCol(stackIds(l).filter(keep))).filter(Boolean)))
    .filter(Boolean);
}
/**
 * Column footprint (cm): width = widest product incl. facing; depth = depth
 * layers laid end to end (each as deep as its deepest stacked product);
 * height = tallest depth layer (stacked products summed, incl. their own Stack).
 */
function colMetrics(col, shelfDepth = 48) {
  let width = 0, depth = 0, height = 0;
  depthLayers(col).forEach((layer) => {
    let layerDepth = 0, layerHeight = 0;
    stackIds(layer).forEach((pid) => {
      const p = products.find((q) => q.id === pid);
      if (!p) return;
      const dims = getProductDimensions(p, shelfDepth);
      width = Math.max(width, dims.width * (p.facing || 1));
      layerDepth = Math.max(layerDepth, depthRows(p, shelfDepth).used * dims.depth);
      layerHeight += dims.height * Math.max(1, p.stack || 1);
    });
    depth += layerDepth;
    height = Math.max(height, layerHeight);
  });
  return { width, depth, height, over: depth > shelfDepth };
}
