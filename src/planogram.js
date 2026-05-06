/* ═══════════════════════════════════════════════════════
   planogram.js — Multi-segment planogram canvas logic
   ═══════════════════════════════════════════════════════ */

let shelfData = {};
let spec = {};

/**
 * Read the shelf specification from form inputs
 */
function readSpec() {
  return {
    name: $('planogramName').value.trim() || 'Multiple Segment Planogram',
    segments: clamp(parseInt($('numSegments').value) || 3, 1, 8),
    shelves: clamp(parseInt($('shelvesPerSegment').value) || 6, 1, 12),
    slots: clamp(parseInt($('slotsPerShelf').value) || 8, 2, 24),
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

  // Create outer gondola container
  const outer = document.createElement('div');
  outer.className = 'gondola-outer';
  if (spec.hasSidePanel) outer.classList.add('with-sides');
  if (!spec.hasBackPanel) outer.classList.add('no-back');

  // CSS custom properties
  const gapPx = Math.round(spec.gap * 0.44);
  const cellH = clamp(Math.round((spec.height / spec.shelves) * 2.2), 64, 120);
  const shelfThickPx = Math.max(5, spec.shelfThickness * 2);

  // Build each segment
  for (let seg = 0; seg < spec.segments; seg++) {
    // Divider between segments
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

    // Build shelves
    for (let shelf = 0; shelf < spec.shelves; shelf++) {
      const row = document.createElement('div');
      row.className = 'shelf-row';
      row.dataset.label = `S${spec.shelves - shelf}`;
      row.style.gridTemplateColumns = `repeat(${spec.slots}, minmax(44px, 1fr))`;
      row.style.setProperty('--gap', `${gapPx}px`);
      row.style.setProperty('--cell-h', `${cellH}px`);
      row.style.setProperty('--shelf-thick', `${shelfThickPx}px`);
      row.style.setProperty('--shelf-surface', spec.shelfColor);
      row.style.marginBottom = shelf < spec.shelves - 1 ? `${gapPx}px` : '0';

      // Build slots
      for (let slot = 0; slot < spec.slots; slot++) {
        row.appendChild(makeSlot(seg, shelf, slot));
      }

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
 * Create a single slot element with event handlers
 */
function makeSlot(seg, shelf, slot) {
  const el = document.createElement('div');
  el.className = 'slot';
  el.id = `slot-${seg}-${shelf}-${slot}`;

  el.addEventListener('click', () => onSlotClick(seg, shelf, slot));

  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.classList.add('drag-over');
  });

  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));

  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drag-over');
    const productId = e.dataTransfer.getData('text/plain');
    if (productId) placeProduct(productId, seg, shelf, slot);
  });

  return el;
}

/**
 * Handle clicking a slot
 */
function onSlotClick(seg, shelf, slot) {
  const key = `${seg}-${shelf}-${slot}`;
  if (shelfData[key]) {
    removeFromSlot(seg, shelf, slot);
    return;
  }
  if (!selectedProductId) {
    showToast('เลือกสินค้าก่อน');
    return;
  }
  placeProduct(selectedProductId, seg, shelf, slot);
}

/**
 * Place a product on the shelf (with facing support)
 */
function placeProduct(productId, seg, shelf, slot) {
  if (!spec.segments) {
    showToast('สร้าง shelf ก่อน');
    return;
  }
  const product = products.find((p) => p.id === productId);
  if (!product) return;

  for (let f = 0; f < product.facing; f++) {
    const col = slot + f;
    if (col >= spec.slots) break;
    shelfData[`${seg}-${shelf}-${col}`] = productId;
  }

  renderShelfFill();
  updateSummary();
  saveState();
}

/**
 * Re-render all slot contents based on shelfData
 */
function renderShelfFill() {
  if (!spec.segments) return;
  for (let seg = 0; seg < spec.segments; seg++) {
    for (let shelf = 0; shelf < spec.shelves; shelf++) {
      for (let slot = 0; slot < spec.slots; slot++) {
        const el = $(`slot-${seg}-${shelf}-${slot}`);
        if (!el) continue;
        const product = products.find((p) => p.id === shelfData[`${seg}-${shelf}-${slot}`]);
        if (product) fillSlot(el, product, seg, shelf, slot);
        else resetSlot(el);
      }
    }
  }
}

/**
 * Fill a slot with product visual
 */
function fillSlot(el, product, seg, shelf, slot) {
  el.className = 'slot filled';
  const visual = product.image
    ? `<img src="${product.image}" alt="${esc(product.name)}" draggable="false">`
    : `<div class="pack-fallback" style="background:${product.color};color:${contrast(product.color)}">${esc(product.name)}</div>`;

  el.innerHTML = `
    <div class="item-pack">${visual}<div class="slot-name">${esc(shortName(product.name))}</div></div>
    <button class="slot-remove" onclick="removeFromSlot(${seg}, ${shelf}, ${slot}, event)">×</button>
  `;
}

/**
 * Reset a slot to empty
 */
function resetSlot(el) {
  el.className = 'slot';
  el.innerHTML = '';
}

/**
 * Remove a product from a slot
 */
function removeFromSlot(seg, shelf, slot, event) {
  if (event) event.stopPropagation();
  delete shelfData[`${seg}-${shelf}-${slot}`];
  renderShelfFill();
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
  $('boardMeta').textContent = `${s.width}w × ${s.height}h cm · ${s.segments} segments · ${s.shelves} shelves · ${s.slots} slots · depth ${s.depth}cm`;

  $('statusStrip').innerHTML = `
    <span class="chip">${s.segments} seg × ${s.shelves} shelves</span>
    <span class="chip">${s.width} × ${s.height} cm</span>
    <span class="chip">${products.length} SKU</span>
  `;
}

/**
 * Update summary cards
 */
function updateSummary() {
  const total = (spec.segments || 0) * (spec.shelves || 0) * (spec.slots || 0);
  const used = Object.keys(shelfData).length;
  const pct = total ? Math.round((used / total) * 100) : 0;
  const categories = new Set(products.map((p) => p.category)).size;

  $('summaryGrid').innerHTML = `
    <div class="summary-card"><strong>${total}</strong><span>ช่องทั้งหมด</span></div>
    <div class="summary-card"><strong>${used}</strong><span>ช่องที่ใช้แล้ว</span></div>
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
    { id: 'p_a', name: 'BOSS Bottled EDP', category: 'Fragrance', brand: 'BOSS', color: '#1f252b', facing: 2, width: 7, height: 18, image: null },
    { id: 'p_b', name: 'HUGO Red Edition', category: 'Fragrance', brand: 'HUGO', color: '#b52a25', facing: 2, width: 8, height: 20, image: null },
    { id: 'p_c', name: 'Travel Spray Silver', category: 'Travel', brand: 'BOSS', color: '#b8b8b8', facing: 3, width: 5, height: 16, image: null },
    { id: 'p_d', name: 'Gift Set Premium', category: 'Gift Set', brand: 'BOSS', color: '#f2f0eb', facing: 3, width: 12, height: 14, image: null },
    { id: 'p_e', name: 'Orange Vitality', category: 'Skincare', brand: 'HUGO', color: '#d86e31', facing: 2, width: 9, height: 18, image: null },
    { id: 'p_f', name: 'Pink Edition', category: 'Seasonal', brand: 'BOSS', color: '#e5a5bd', facing: 2, width: 8, height: 18, image: null },
    { id: 'p_g', name: 'Black Premium', category: 'Premium', brand: 'BOSS', color: '#1a1a1a', facing: 2, width: 9, height: 20, image: null },
    { id: 'p_h', name: 'Alive Intense', category: 'Fragrance', brand: 'BOSS', color: '#5c3d7a', facing: 2, width: 7, height: 19, image: null },
    { id: 'p_i', name: 'Summer Breeze', category: 'Seasonal', brand: 'HUGO', color: '#4aa8d8', facing: 3, width: 6, height: 17, image: null },
  ];

  renderProductList();
  updateLegend();
  buildShelf();

  // Place products across segments
  placeProduct('p_a', 0, 0, 0);
  placeProduct('p_b', 0, 0, 3);
  placeProduct('p_c', 0, 1, 1);
  placeProduct('p_d', 0, 2, 2);
  placeProduct('p_h', 0, 3, 0);

  placeProduct('p_e', 1, 0, 2);
  placeProduct('p_f', 1, 1, 0);
  placeProduct('p_g', 1, 2, 4);
  placeProduct('p_i', 1, 3, 1);

  placeProduct('p_a', 2, 0, 1);
  placeProduct('p_b', 2, 1, 3);
  placeProduct('p_c', 2, 2, 0);
  placeProduct('p_e', 2, 3, 5);

  selectProduct('p_a');
  showToast('โหลดตัวอย่างแล้ว');
}
