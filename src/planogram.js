/* ═══════════════════════════════════════════════════════
   planogram.js — Multi-segment planogram canvas logic
   Free-placement: products sized by actual cm dimensions
   ═══════════════════════════════════════════════════════ */

let shelfData = {}; // { "seg-shelf": [productId, ...] }
let spec = {};

const PX_PER_CM = 3.4;   // horizontal scale: pixels per centimeter
const MIN_ITEM_W = 34;    // minimum px width for very narrow products

/**
 * Parse the first numeric value from a cm field (handles ranges like "7-12")
 */
function parseCm(val, fallback) {
  if (!val) return fallback;
  const m = String(val).match(/[\d.]+/);
  return m ? Math.max(1, parseFloat(m[0])) : fallback;
}

/**
 * Read the shelf specification from form inputs
 */
function readSpec() {
  return {
    name: $('planogramName').value.trim() || 'Multiple Segment Planogram',
    segments: clamp(parseInt($('numSegments').value) || 3, 1, 8),
    shelves: clamp(parseInt($('shelvesPerSegment').value) || 6, 1, 12),
    width: clamp(parseInt($('overallWidth').value) || 360, 60, 1200),
    height: clamp(parseInt($('overallHeight').value) || 220, 80, 400),
    depth: clamp(parseInt($('shelfDepth').value) || 48, 10, 120),
    gap: clamp(parseInt($('gapSize').value) || 28, 8, 80),
    shelfThickness: clamp(parseInt($('shelfThickness').value) || 3, 1, 12),
    backColor: $('backColor').value,
    shelfColor: $('shelfColor').value,
    hasBackPanel: $('hasBackPanel').checked,
    hasSidePanel: $('hasSidePanel').checked,
    hasDivider: $('hasSegmentDivider').checked,
  };
}

/**
 * Build the entire multi-segment planogram canvas
 */
function buildShelf() {
  spec = readSpec();
  shelfData = {};

  const wrap = $('gondolaWrap');
  wrap.innerHTML = '';

  const outer = document.createElement('div');
  outer.className = 'gondola-outer';
  if (spec.hasSidePanel) outer.classList.add('with-sides');
  if (!spec.hasBackPanel) outer.classList.add('no-back');

  const segWidthPx = Math.round((spec.width / spec.segments) * PX_PER_CM);
  const gapPx = clamp(Math.round(spec.gap * 0.44), 8, 40);
  const shelfThickPx = Math.max(5, spec.shelfThickness * 2);
  const cellH = clamp(Math.round((spec.height / spec.shelves) * 2.2), 64, 140);

  for (let seg = 0; seg < spec.segments; seg++) {
    if (seg > 0 && spec.hasDivider) {
      const divider = document.createElement('div');
      divider.className = 'segment-divider';
      outer.appendChild(divider);
    }

    const segment = document.createElement('div');
    segment.className = 'segment';

    const inner = document.createElement('div');
    inner.className = 'segment-inner';
    inner.style.setProperty('--back-panel', spec.hasBackPanel ? spec.backColor : '#efe8dc');
    inner.style.background = spec.hasBackPanel ? spec.backColor : '';
    inner.style.setProperty('--shelf-surface', spec.shelfColor);

    for (let shelf = 0; shelf < spec.shelves; shelf++) {
      const row = makeShelfRow(seg, shelf, segWidthPx, gapPx, shelfThickPx, cellH);
      inner.appendChild(row);
    }

    segment.appendChild(inner);
    outer.appendChild(segment);
  }

  wrap.appendChild(outer);
  updateBoardMeta();
  updateSummary();
  saveState();
  showToast(`สร้าง ${spec.segments} segment planogram แล้ว`);
}

/**
 * Create a shelf row element (free-placement flex container)
 */
function makeShelfRow(seg, shelf, segWidthPx, gapPx, shelfThickPx, cellH) {
  const el = document.createElement('div');
  el.className = 'shelf-row';
  el.id = `shelf-${seg}-${shelf}`;
  el.dataset.label = `S${spec.shelves - shelf}`;
  el.style.width = `${segWidthPx}px`;
  el.style.setProperty('--gap', `${gapPx}px`);
  el.style.setProperty('--shelf-thick', `${shelfThickPx}px`);
  el.style.setProperty('--cell-h', `${cellH}px`);
  el.style.setProperty('--shelf-surface', spec.shelfColor);
  el.style.marginBottom = shelf < spec.shelves - 1 ? `${gapPx}px` : '0';

  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.classList.add('drag-over');
  });

  el.addEventListener('dragleave', (e) => {
    if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over');
  });

  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drag-over');
    const productId = e.dataTransfer.getData('text/plain');
    if (!productId) return;
    const insertIdx = dropInsertIndex(el, seg, shelf, e.clientX);
    insertProduct(productId, seg, shelf, insertIdx);
  });

  el.addEventListener('click', (e) => {
    if (e.target.closest('.shelf-product')) return;
    if (!selectedProductId) { showToast('เลือกสินค้าก่อน'); return; }
    placeProduct(selectedProductId, seg, shelf);
  });

  return el;
}

/**
 * Compute insert index from a drop x-coordinate
 */
function dropInsertIndex(el, seg, shelf, clientX) {
  const rect = el.getBoundingClientRect();
  const dropX = clientX - rect.left;
  const key = `${seg}-${shelf}`;
  const items = shelfData[key] || [];
  let cumX = 0;
  for (let i = 0; i < items.length; i++) {
    const p = products.find((q) => q.id === items[i]);
    if (!p) continue;
    const w = Math.max(MIN_ITEM_W, Math.round(parseCm(p.width, 10) * (p.facing || 1) * PX_PER_CM));
    if (dropX <= cumX + w / 2) return i;
    cumX += w;
  }
  return items.length;
}

/**
 * Place a product at the end of a shelf
 */
function placeProduct(productId, seg, shelf) {
  if (!spec.segments) { showToast('สร้าง shelf ก่อน'); return; }
  const key = `${seg}-${shelf}`;
  if (!shelfData[key]) shelfData[key] = [];
  shelfData[key].push(productId);
  renderShelfRow($(`shelf-${seg}-${shelf}`), seg, shelf);
  updateSummary();
  saveState();
}

/**
 * Insert a product at a specific index on a shelf
 */
function insertProduct(productId, seg, shelf, idx) {
  if (!spec.segments) { showToast('สร้าง shelf ก่อน'); return; }
  const key = `${seg}-${shelf}`;
  if (!shelfData[key]) shelfData[key] = [];
  shelfData[key].splice(idx, 0, productId);
  renderShelfRow($(`shelf-${seg}-${shelf}`), seg, shelf);
  updateSummary();
  saveState();
}

/**
 * Re-render all shelves from shelfData
 */
function renderShelfFill() {
  if (!spec.segments) return;
  for (let seg = 0; seg < spec.segments; seg++) {
    for (let shelf = 0; shelf < spec.shelves; shelf++) {
      const el = $(`shelf-${seg}-${shelf}`);
      if (el) renderShelfRow(el, seg, shelf);
    }
  }
}

/**
 * Re-render a single shelf row's product items
 */
function renderShelfRow(el, seg, shelf) {
  if (!el) return;
  el.querySelectorAll('.shelf-product').forEach((n) => n.remove());

  const key = `${seg}-${shelf}`;
  const placements = shelfData[key] || [];
  const cellH = parseInt(el.style.getPropertyValue('--cell-h')) || 90;

  placements.forEach((productId, idx) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const wCm = parseCm(product.width, 10) * (product.facing || 1);
    const hCm = parseCm(product.height, 20);
    const wPx = Math.max(MIN_ITEM_W, Math.round(wCm * PX_PER_CM));
    const hPx = Math.min(Math.round(hCm * PX_PER_CM), cellH - 4);

    const item = document.createElement('div');
    item.className = 'shelf-product';
    item.style.width = `${wPx}px`;
    item.style.height = `${hPx}px`;
    item.title = `${product.name} (${product.width || '?'}cm × ${product.height || '?'}cm)`;

    const visual = product.image
      ? `<img src="${product.image}" alt="${esc(product.name)}" draggable="false">`
      : `<div class="pack-fallback" style="background:${product.color};color:${contrast(product.color)}">${esc(shortName(product.name))}</div>`;

    item.innerHTML = `
      ${visual}
      <button class="slot-remove" onclick="removeFromShelf(${seg},${shelf},${idx},event)" title="ลบ">×</button>
    `;

    el.appendChild(item);
  });
}

/**
 * Remove a product from a shelf by index
 */
function removeFromShelf(seg, shelf, idx, event) {
  if (event) event.stopPropagation();
  const key = `${seg}-${shelf}`;
  if (shelfData[key]) {
    shelfData[key].splice(idx, 1);
    if (!shelfData[key].length) delete shelfData[key];
  }
  renderShelfRow($(`shelf-${seg}-${shelf}`), seg, shelf);
  updateSummary();
  saveState();
}

/**
 * Clear all products from the shelf
 */
function clearAll() {
  if (!Object.keys(shelfData).length) return;
  if (!confirm('ล้างสินค้าที่วางบน shelf ทั้งหมด?')) return;
  shelfData = {};
  renderShelfFill();
  updateSummary();
  saveState();
}

/**
 * Update the board meta info
 */
function updateBoardMeta() {
  const s = spec.name ? spec : readSpec();
  $('boardTitle').textContent = s.name;
  $('canvasTitle').textContent = s.name;
  $('boardMeta').textContent = `${s.width}w × ${s.height}h cm · ${s.segments} segments · ${s.shelves} shelves · depth ${s.depth}cm`;

  $('statusStrip').innerHTML = `
    <span class="chip">${s.segments} seg × ${s.shelves} shelves</span>
    <span class="chip">${s.width} × ${s.height} cm</span>
    <span class="chip">${products.length} SKU</span>
  `;
}

/**
 * Update summary cards using cm-based utilization
 */
function updateSummary() {
  const totalCm = (spec.shelves || 0) * (spec.width || 0);
  let usedCm = 0;
  let skuSet = new Set();

  Object.values(shelfData).forEach((arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((pid) => {
      const p = products.find((q) => q.id === pid);
      if (!p) return;
      usedCm += parseCm(p.width, 10) * (p.facing || 1);
      skuSet.add(pid);
    });
  });

  const pct = totalCm ? Math.round((usedCm / totalCm) * 100) : 0;
  const categories = new Set(products.map((p) => p.category)).size;

  $('summaryGrid').innerHTML = `
    <div class="summary-card"><strong>${Math.round(totalCm)}</strong><span>cm ทั้งหมด</span></div>
    <div class="summary-card"><strong>${Math.round(usedCm)}</strong><span>cm ที่ใช้แล้ว</span></div>
    <div class="summary-card"><strong>${pct}%</strong><span>Utilization</span></div>
    <div class="summary-card"><strong>${products.length}</strong><span>SKU / ${categories} category</span></div>
  `;
  updateBoardMeta();
}

/**
 * Load demo data
 */
function loadDemo() {
  products = [
    { id: 'p_a', name: 'BOSS Bottled EDP', category: 'Fragrance', brand: 'BOSS', color: '#1f252b', facing: 2, width: '7', height: '18', image: null },
    { id: 'p_b', name: 'HUGO Red Edition', category: 'Fragrance', brand: 'HUGO', color: '#b52a25', facing: 2, width: '8', height: '20', image: null },
    { id: 'p_c', name: 'Travel Spray Silver', category: 'Travel', brand: 'BOSS', color: '#b8b8b8', facing: 3, width: '5', height: '16', image: null },
    { id: 'p_d', name: 'Gift Set Premium', category: 'Gift Set', brand: 'BOSS', color: '#f2f0eb', facing: 1, width: '22', height: '14', image: null },
    { id: 'p_e', name: 'Orange Vitality', category: 'Skincare', brand: 'HUGO', color: '#d86e31', facing: 2, width: '9', height: '18', image: null },
    { id: 'p_f', name: 'Pink Edition', category: 'Seasonal', brand: 'BOSS', color: '#e5a5bd', facing: 2, width: '8', height: '18', image: null },
    { id: 'p_g', name: 'Black Premium', category: 'Premium', brand: 'BOSS', color: '#1a1a1a', facing: 2, width: '9', height: '20', image: null },
    { id: 'p_h', name: 'Alive Intense', category: 'Fragrance', brand: 'BOSS', color: '#5c3d7a', facing: 2, width: '7', height: '19', image: null },
    { id: 'p_i', name: 'Summer Breeze', category: 'Seasonal', brand: 'HUGO', color: '#4aa8d8', facing: 3, width: '6', height: '17', image: null },
  ];

  renderProductList();
  updateLegend();
  buildShelf();

  placeProduct('p_a', 0, 0); placeProduct('p_b', 0, 0); placeProduct('p_e', 0, 0);
  placeProduct('p_c', 0, 1); placeProduct('p_d', 0, 1);
  placeProduct('p_h', 0, 2); placeProduct('p_g', 0, 2);
  placeProduct('p_f', 1, 0); placeProduct('p_i', 1, 0);
  placeProduct('p_a', 1, 1); placeProduct('p_b', 1, 1);
  placeProduct('p_g', 2, 0); placeProduct('p_h', 2, 0); placeProduct('p_c', 2, 0);
  placeProduct('p_e', 2, 2);

  selectProduct('p_a');
  showToast('โหลดตัวอย่างแล้ว');
}
