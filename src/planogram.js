/* ═══════════════════════════════════════════════════════
   planogram.js — Multi-segment planogram canvas logic
   Free-placement: products sized by actual cm dimensions
   ═══════════════════════════════════════════════════════ */

let shelfData = {}; // { "seg-shelf": [productId, ...] }
let spec = {};
let undoStack = [];
let redoStack = [];
let draggedSource = null; // { seg, shelf, idx, productId }
let activeInspectorTarget = null; // { seg, shelf, idx }
let pendingShelfHeights = null;   // heights to honour on the next buildShelf (from loadState)
let pendingSegmentShelfHeights = null; // heights to honour per segment on the next buildShelf

const PX_PER_CM = 3.4;   // horizontal scale: pixels per centimeter
const V_PX_PER_CM = 2.4;  // vertical scale: pixels per centimeter (shelf heights / ruler)
const MIN_ITEM_W = 34;    // minimum px width for very narrow products
const MIN_CELL_CM = 8;    // smallest allowed shelf cell height in cm
const MIN_ROW_PX = 38;    // smallest pixel height a shelf row may render at

/**
 * Even cell heights (cm) for `count` shelves filling `total` cm.
 */
function evenHeights(total, count) {
  const h = (total || 0) / (count || 1);
  return Array.from({ length: count }, () => h);
}

/**
 * Return an array of `count` cell heights summing to `total`, keeping the
 * proportions of `arr` when it is usable, otherwise an even split.
 */
function normalizeHeights(arr, total, count) {
  const a = (Array.isArray(arr) ? arr : []).map(Number).filter((n) => n > 0);
  if (a.length !== count) return evenHeights(total, count);
  const sum = a.reduce((s, x) => s + x, 0) || total;
  return a.map((x) => (x * total) / sum);
}

/**
 * Current per-shelf cell heights in cm (top shelf first) for a specific segment.
 */
function getCellHeights(seg = 0) {
  if (spec && Array.isArray(spec.segmentShelfHeights) && Array.isArray(spec.segmentShelfHeights[seg]) && spec.segmentShelfHeights[seg].length === spec.shelves) {
    return spec.segmentShelfHeights[seg];
  }
  if (spec && Array.isArray(spec.shelfHeights) && spec.shelfHeights.length === spec.shelves) {
    return spec.shelfHeights;
  }
  const totalH = (spec && spec.height) ? spec.height : 220;
  const shelvesCount = (spec && spec.shelves) ? spec.shelves : 6;
  return evenHeights(totalH, shelvesCount);
}

/**
 * Cumulative board heights from the floor (cm) for every shelf boundary,
 * bottom → top: [0, h_last, h_last+h_{last-1}, ..., total]. Length = shelves + 1.
 */
function boardBoundaries(seg = 0) {
  const heights = getCellHeights(seg);
  const bottomUp = heights.slice().reverse();
  const out = [0];
  let cum = 0;
  bottomUp.forEach((h) => { cum += h; out.push(cum); });
  return out;
}

function pushHistory() {
  undoStack.push(JSON.stringify(shelfData));
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
  updateUndoButtons();
}

function updateUndoButtons() {
  const u = $('btnUndo'), r = $('btnRedo');
  if (u) u.disabled = !undoStack.length;
  if (r) r.disabled = !redoStack.length;
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(shelfData));
  shelfData = JSON.parse(undoStack.pop());
  renderShelfFill();
  updateSummary();
  saveState();
  updateUndoButtons();
  showToast('Undo');
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(shelfData));
  shelfData = JSON.parse(redoStack.pop());
  renderShelfFill();
  updateSummary();
  saveState();
  updateUndoButtons();
}

/**
 * Read the shelf specification from form inputs
 */
function readSpec() {
  const segments = clamp(parseInt($('numSegments').value) || 3, 1, 8);
  const overallWidth = clamp(parseInt($('overallWidth').value) || 360, 60, 1200);
  const shelvesCount = clamp(parseInt($('shelvesPerSegment').value) || 6, 1, 12);
  const height = clamp(parseInt($('overallHeight').value) || 220, 80, 400);

  // Read customized segment widths if they exist in UI
  let segmentWidths = [];
  let hasCustomWidths = false;
  for (let i = 0; i < segments; i++) {
    const el = $(`segWidth-${i}`);
    if (el) {
      segmentWidths.push(clamp(parseInt(el.value) || 0, 10, 1000));
      hasCustomWidths = true;
    }
  }

  // Fallback to even split if customization inputs don't exist yet or values don't sum to overallWidth
  if (!hasCustomWidths || segmentWidths.length !== segments) {
    segmentWidths = Array.from({ length: segments }, () => Math.round(overallWidth / segments));
    const sum = segmentWidths.reduce((a, b) => a + b, 0);
    if (sum !== overallWidth) {
      segmentWidths[segmentWidths.length - 1] += (overallWidth - sum);
    }
  }

  // Read customized shelf heights per segment
  let segmentShelfHeights = [];
  for (let seg = 0; seg < segments; seg++) {
    let heights = [];
    let hasInputs = false;
    for (let shelf = 0; shelf < shelvesCount; shelf++) {
      const el = document.querySelector(`#shelf-${seg}-${shelf} .cell-height-input`);
      if (el) {
        heights.push(clamp(parseFloat(el.value) || 0, MIN_CELL_CM, height));
        hasInputs = true;
      }
    }
    if (!hasInputs || heights.length !== shelvesCount) {
      if (spec && Array.isArray(spec.segmentShelfHeights) && Array.isArray(spec.segmentShelfHeights[seg]) && spec.segmentShelfHeights[seg].length === shelvesCount) {
        heights = spec.segmentShelfHeights[seg].slice();
      } else if (spec && Array.isArray(spec.shelfHeights) && spec.shelfHeights.length === shelvesCount) {
        heights = spec.shelfHeights.slice();
      } else {
        heights = evenHeights(height, shelvesCount);
      }
    }
    segmentShelfHeights.push(heights);
  }

  return {
    name: $('planogramName').value.trim() || 'Multiple Segment Planogram',
    segments,
    shelves: shelvesCount,
    width: overallWidth,
    height,
    depth: clamp(parseInt($('shelfDepth').value) || 48, 10, 120),
    gap: clamp(parseInt($('gapSize').value) || 28, 8, 80),
    shelfThickness: clamp(parseInt($('shelfThickness').value) || 3, 1, 12),
    backColor: $('backColor').value,
    shelfColor: $('shelfColor').value,
    hasBackPanel: $('hasBackPanel').checked,
    hasSidePanel: $('hasSidePanel').checked,
    hasDivider: $('hasSegmentDivider').checked,
    segmentWidths,
    segmentShelfHeights
  };
}

/**
 * Build the entire multi-segment planogram canvas
 */
function buildShelf() {
  spec = readSpec();

  // If customized segment width inputs are missing or incorrect, render them
  const currentInputCount = document.querySelectorAll('#segmentWidthInputs [id^="segWidth-"]').length;
  if (currentInputCount !== spec.segments) {
    renderSegmentWidthInputs(spec.segmentWidths);
  }

  // Preserve existing placements where the segment and shelf coordinates still exist
  const oldData = shelfData || {};
  shelfData = {};
  for (let seg = 0; seg < spec.segments; seg++) {
    for (let shelf = 0; shelf < spec.shelves; shelf++) {
      const key = `${seg}-${shelf}`;
      if (oldData[key]) {
        shelfData[key] = oldData[key];
      }
    }
  }

  undoStack = [];
  redoStack = [];
  updateUndoButtons();

  // ─── Resolve per-shelf cell heights (custom board positions per segment) ───
  if (pendingSegmentShelfHeights && pendingSegmentShelfHeights.length === spec.segments) {
    spec.segmentShelfHeights = pendingSegmentShelfHeights.map(h => normalizeHeights(h, spec.height, spec.shelves));
  } else {
    const oldSegmentShelfHeights = spec.segmentShelfHeights;
    spec.segmentShelfHeights = [];
    for (let seg = 0; seg < spec.segments; seg++) {
      let heights = null;
      if (oldSegmentShelfHeights && Array.isArray(oldSegmentShelfHeights[seg]) && oldSegmentShelfHeights[seg].length === spec.shelves) {
        heights = oldSegmentShelfHeights[seg].slice();
      } else if (spec.shelfHeights && spec.shelfHeights.length === spec.shelves) {
        heights = spec.shelfHeights.slice();
      } else {
        heights = evenHeights(spec.height, spec.shelves);
      }
      spec.segmentShelfHeights.push(normalizeHeights(heights, spec.height, spec.shelves));
    }
  }
  pendingSegmentShelfHeights = null;
  spec.shelfHeights = spec.segmentShelfHeights[0].slice(); // keep backward compatibility

  const wrap = $('gondolaWrap');
  wrap.innerHTML = '';
  wrap.classList.add('has-ruler');

  const outer = document.createElement('div');
  outer.className = 'gondola-outer';
  if (spec.hasSidePanel) outer.classList.add('with-sides');
  if (!spec.hasBackPanel) outer.classList.add('no-back');

  const shelfThickPx = Math.max(5, spec.shelfThickness * 2);

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

    const segW = spec.segmentWidths[seg] || (spec.width / spec.segments);
    const segWidthPx = Math.round(segW * PX_PER_CM);

    const segHeights = getCellHeights(seg);

    for (let shelf = 0; shelf < spec.shelves; shelf++) {
      const cellPx = Math.max(MIN_ROW_PX, Math.round(segHeights[shelf] * V_PX_PER_CM));
      const row = makeShelfRow(seg, shelf, segWidthPx, shelfThickPx, cellPx);
      inner.appendChild(row);
    }

    segment.appendChild(inner);
    outer.appendChild(segment);
  }

  wrap.appendChild(buildRuler());
  wrap.appendChild(outer);
  updateBoardMeta();
  updateSummary();
  saveState();

  // Render existing products on the new shelf layout
  renderShelfFill();
  if (window.Planogram3D && Planogram3D.isOpen()) {
    Planogram3D.refresh();
  }

  showToast(`สร้าง ${spec.segments} segment planogram แล้ว`);
}

/**
 * Render dynamic inputs for individual segment widths
 */
function renderSegmentWidthInputs(prevWidths = null) {
  const container = $('segmentWidthInputs');
  if (!container) return;

  const segments = clamp(parseInt($('numSegments').value) || 3, 1, 8);
  const overallWidth = clamp(parseInt($('overallWidth').value) || 360, 60, 1200);

  // Initialize widths
  let widths = [];
  if (Array.isArray(prevWidths) && prevWidths.length === segments) {
    widths = prevWidths.slice();
  } else {
    // split evenly
    widths = Array.from({ length: segments }, () => Math.round(overallWidth / segments));
    const sum = widths.reduce((a, b) => a + b, 0);
    if (sum !== overallWidth) {
      widths[widths.length - 1] += (overallWidth - sum);
    }
  }

  container.innerHTML = '';
  for (let i = 0; i < segments; i++) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.gap = '8px';

    row.innerHTML = `
      <span style="font-size: 0.8rem; font-weight: 500; color: var(--ink);">ตู้ที่ ${i + 1} (Bay ${i + 1})</span>
      <div style="display: flex; align-items: center; gap: 4px; width: 100px;">
        <input id="segWidth-${i}" type="number" value="${widths[i]}" min="10" max="600" style="padding: 4px 8px; font-size: 0.8rem; text-align: right; width: 100%;">
        <span style="font-size: 0.72rem; color: var(--muted); font-weight: 500;">cm</span>
      </div>
    `;

    // Listen to input changes
    const input = row.querySelector('input');
    input.addEventListener('change', () => {
      // Calculate new overallWidth from the sum of all segments
      let sum = 0;
      for (let j = 0; j < segments; j++) {
        const el = $(`segWidth-${j}`);
        sum += clamp(parseInt(el ? el.value : 0) || 0, 10, 1000);
      }
      $('overallWidth').value = sum;
      buildShelf();
    });

    container.appendChild(row);
  }
}

/**
 * Build the vertical cm height ruler shown on the left of the gondola.
 * Ticks are placed at every shelf board boundary (cumulative cm from floor).
 */
function buildRuler() {
  const ruler = document.createElement('div');
  ruler.className = 'shelf-ruler';

  const track = document.createElement('div');
  track.className = 'ruler-track';

  const total = spec.height || 1;
  boardBoundaries().forEach((cm, i, arr) => {
    const tick = document.createElement('div');
    const isEdge = i === 0 || i === arr.length - 1;
    tick.className = `ruler-tick${isEdge ? ' edge' : ''}`;
    tick.style.bottom = `${(cm / total) * 100}%`;
    tick.innerHTML = `<span class="ruler-num">${Math.round(cm)}</span>`;
    track.appendChild(tick);
  });

  ruler.appendChild(track);
  return ruler;
}

/**
 * Create a shelf row element (free-placement flex container)
 */
function makeShelfRow(seg, shelf, segWidthPx, shelfThickPx, cellH) {
  const el = document.createElement('div');
  el.className = 'shelf-row';
  el.id = `shelf-${seg}-${shelf}`;
  el.dataset.label = `S${spec.shelves - shelf}`;
  el.style.width = `${segWidthPx}px`;
  el.style.setProperty('--shelf-thick', `${shelfThickPx}px`);
  el.style.setProperty('--cell-h', `${cellH}px`);
  el.style.setProperty('--shelf-surface', spec.shelfColor);
  el.style.marginBottom = '0';

  // Per-shelf editable cell-height pill (text input with numeric mode to avoid browser spin-button crop)
  const pill = document.createElement('div');
  pill.className = 'cell-height-pill';
  pill.innerHTML = `<input type="text" inputmode="numeric" pattern="[0-9]*" class="cell-height-input" value="${Math.round(getCellHeights(seg)[shelf])}"><span>cm</span>`;
  const input = pill.querySelector('input');
  ['mousedown', 'click'].forEach((evt) => input.addEventListener(evt, (e) => e.stopPropagation()));
  input.addEventListener('change', () => {
    let val = parseInt(input.value);
    if (isNaN(val)) val = Math.round(getCellHeights(seg)[shelf]);
    setCellHeight(seg, shelf, val);
  });
  el.appendChild(pill);

  // Draggable board grip (resize boundary with the shelf below). Not on the bottom shelf.
  if (shelf < spec.shelves - 1) {
    const grip = document.createElement('div');
    grip.className = 'board-grip';
    grip.title = 'ลากเพื่อปรับตำแหน่งแผ่นชั้น';
    grip.addEventListener('mousedown', (e) => startBoardDrag(e, seg, shelf));
    el.appendChild(grip);
  }

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
    const insertIdx = dropInsertIndex(el, seg, shelf, e.clientX);

    if (draggedSource) {
      moveProductOnBoard(draggedSource.seg, draggedSource.shelf, draggedSource.idx, seg, shelf, insertIdx);
    } else {
      const productId = e.dataTransfer.getData('text/plain');
      if (!productId) return;
      insertProduct(productId, seg, shelf, insertIdx);
    }
  });

  el.addEventListener('click', (e) => {
    if (e.target.closest('.shelf-product') || e.target.closest('.board-grip') || e.target.closest('.cell-height-pill')) return;
    if (!selectedProductId) { showToast('เลือกสินค้าก่อน'); return; }
    placeProduct(selectedProductId, seg, shelf);
  });

  return el;
}

/**
 * Set the cell height (cm) of one shelf, compensating from the shelf below
 * (or above for the bottom shelf) so the gondola total stays constant.
 */
function setCellHeight(seg, shelf, cm) {
  if (!spec.segmentShelfHeights) spec.segmentShelfHeights = [];
  if (!spec.segmentShelfHeights[seg]) spec.segmentShelfHeights[seg] = getCellHeights(seg).slice();

  const heights = spec.segmentShelfHeights[seg].slice();
  if (!isFinite(cm)) { relayoutShelves(false); return; }

  const partner = shelf < heights.length - 1 ? shelf + 1 : shelf - 1;
  if (partner < 0) return; // single shelf — nothing to balance against

  const pair = heights[shelf] + heights[partner];
  const next = clamp(cm, MIN_CELL_CM, pair - MIN_CELL_CM);
  heights[shelf] = next;
  heights[partner] = pair - next;

  spec.segmentShelfHeights[seg] = heights;
  spec.shelfHeights = spec.segmentShelfHeights[0].slice(); // keep sync with base property for backward compatibility
  relayoutShelves(true);
}

/**
 * Drag a shelf board up/down to move the boundary between this shelf and the
 * one below it, transferring cm between the two cells.
 */
function startBoardDrag(e, seg, shelf) {
  e.preventDefault();
  e.stopPropagation();
  closeMiniInspector();

  if (!spec.segmentShelfHeights) spec.segmentShelfHeights = [];
  if (!spec.segmentShelfHeights[seg]) spec.segmentShelfHeights[seg] = getCellHeights(seg).slice();

  const start = spec.segmentShelfHeights[seg].slice();
  const startY = e.clientY;
  const above = shelf;        // dragging down grows the shelf above the board
  const below = shelf + 1;
  const pair = start[above] + start[below];
  let changed = false;
  let queued = false;
  document.body.classList.add('resizing-shelf');

  function onMove(ev) {
    const dCm = (ev.clientY - startY) / V_PX_PER_CM;
    const heights = start.slice();
    const next = clamp(start[above] + dCm, MIN_CELL_CM, pair - MIN_CELL_CM);
    heights[above] = next;
    heights[below] = pair - next;
    spec.segmentShelfHeights[seg] = heights;
    spec.shelfHeights = spec.segmentShelfHeights[0].slice(); // sync seg 0
    changed = true;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; relayoutShelves(false); });
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.classList.remove('resizing-shelf');
    if (changed) saveState();
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/**
 * Re-apply current shelf heights to the live DOM (rows, ruler, pills) and
 * re-render products + 3D without clearing any placements.
 */
function relayoutShelves(persist) {
  for (let seg = 0; seg < spec.segments; seg++) {
    const heights = getCellHeights(seg);
    for (let shelf = 0; shelf < spec.shelves; shelf++) {
      const el = $(`shelf-${seg}-${shelf}`);
      if (!el) continue;
      const cellPx = Math.max(MIN_ROW_PX, Math.round(heights[shelf] * V_PX_PER_CM));
      el.style.height = `${cellPx}px`;
      el.style.setProperty('--cell-h', `${cellPx}px`);
      const input = el.querySelector('.cell-height-input');
      if (input && document.activeElement !== input) input.value = Math.round(heights[shelf]);
    }
  }

  // Rebuild the ruler in place
  const wrap = $('gondolaWrap');
  const oldRuler = wrap && wrap.querySelector('.shelf-ruler');
  if (wrap && oldRuler) wrap.replaceChild(buildRuler(), oldRuler);

  renderShelfFill();
  if (window.Planogram3D && Planogram3D.isOpen()) Planogram3D.refresh();
  updateSummary();
  if (persist) saveState();
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
    const dims = getProductDimensions(p, spec.depth);
    const w = Math.max(MIN_ITEM_W, Math.round(dims.width * (p.facing || 1) * PX_PER_CM));
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
  pushHistory();
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
  pushHistory();
  const key = `${seg}-${shelf}`;
  if (!shelfData[key]) shelfData[key] = [];
  shelfData[key].splice(idx, 0, productId);
  renderShelfRow($(`shelf-${seg}-${shelf}`), seg, shelf);
  updateSummary();
  saveState();
}

/**
 * Move/rearrange a product from one shelf location to another on the board
 */
function moveProductOnBoard(sourceSeg, sourceShelf, sourceIdx, targetSeg, targetShelf, targetIdx) {
  if (!spec.segments) return;

  const sourceKey = `${sourceSeg}-${sourceShelf}`;
  const targetKey = `${targetSeg}-${targetShelf}`;

  const sourceItems = shelfData[sourceKey];
  if (!sourceItems || sourceItems[sourceIdx] === undefined) return;

  pushHistory();

  const [movedProductId] = sourceItems.splice(sourceIdx, 1);
  if (!sourceItems.length) {
    delete shelfData[sourceKey];
  }

  if (!shelfData[targetKey]) {
    shelfData[targetKey] = [];
  }

  let finalTargetIdx = targetIdx;
  if (sourceKey === targetKey && targetIdx > sourceIdx) {
    finalTargetIdx = targetIdx - 1;
  }

  shelfData[targetKey].splice(finalTargetIdx, 0, movedProductId);

  renderShelfRow($(`shelf-${sourceSeg}-${sourceShelf}`), sourceSeg, sourceShelf);
  if (sourceKey !== targetKey) {
    renderShelfRow($(`shelf-${targetSeg}-${targetShelf}`), targetSeg, targetShelf);
  }

  closeMiniInspector();
  updateSummary();
  saveState();
  showToast('ย้ายตำแหน่งสินค้าแล้ว');
}

/**
 * Re-render all shelves from shelfData
 */
/**
 * Calculate the total capacity and Days of Supply (DOS) for a product
 */
function calculateProductDOS(product) {
  if (!product) return { dos: null, capacity: 0 };
  
  let totalCapacity = 0;
  Object.entries(shelfData || {}).forEach(([key, productIds]) => {
    if (!Array.isArray(productIds)) return;
    const [segIdx, shelfIdx] = key.split('-').map(Number);
    // Find the shelf board element to read its height/depth if possible, or fallback to spec.depth
    const shelfDepth = spec.depth || 48;
    
    productIds.forEach((pid) => {
      if (pid === product.id) {
        const dims = getProductDimensions(product, shelfDepth);
        const rows = Math.max(1, Math.floor(shelfDepth / dims.depth));
        const stack = Math.max(1, product.stack || 1);
        const facing = product.facing || 1;
        totalCapacity += facing * stack * rows;
      }
    });
  });

  const salesRate = parseFloat(product.salesRate) || 0;
  const dos = (salesRate > 0 && totalCapacity > 0) ? totalCapacity / salesRate : null;
  return { dos, capacity: totalCapacity };
}

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
  el.querySelectorAll('.shelf-product, .shelf-capacity-badge').forEach((n) => n.remove());

  const key = `${seg}-${shelf}`;
  const placements = shelfData[key] || [];
  const cellH = parseInt(el.style.getPropertyValue('--cell-h')) || 90;

  placements.forEach((productId, idx) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const dims = getProductDimensions(product, spec.depth);
    const stack = Math.max(1, product.stack || 1);
    const wCm = dims.width * (product.facing || 1);
    const hCm = dims.height;
    const wPx = Math.max(MIN_ITEM_W, Math.round(wCm * PX_PER_CM));
    const unitPx = Math.round(hCm * PX_PER_CM);
    const hPx = Math.min(unitPx * stack, cellH - 4);

    const item = document.createElement('div');
    item.className = stack > 1 ? 'shelf-product stacked' : 'shelf-product';
    item.style.width = `${wPx}px`;
    item.style.height = `${hPx}px`;
    const stackLabel = stack > 1 ? ` · ซ้อน ${stack}` : '';
    item.title = `${product.name} (${Math.round(dims.width)}cm × ${Math.round(dims.height)}cm${stackLabel})`;
    item.draggable = true;

    // Event listeners สำหรับการลากย้ายสินค้าที่อยู่บน Shelf
    item.addEventListener('dragstart', (e) => {
      draggedSource = { seg, shelf, idx, productId };
      item.classList.add('dragging');
      setTimeout(() => item.style.visibility = 'hidden', 0);
      closeMiniInspector();
    });

    item.addEventListener('dragend', () => {
      draggedSource = null;
      item.classList.remove('dragging');
      item.style.visibility = 'visible';
    });

    // Event listener สำหรับการคลิกเพื่อแก้ไข Facing / ลบสินค้า
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      openMiniInspector(seg, shelf, idx, e, item);
    });

    const visual = product.image
      ? `<img src="${esc(product.image)}" alt="${esc(product.name)}" draggable="false">`
      : `<div class="pack-fallback" style="background:${product.color};color:${contrast(product.color)}">${esc(shortName(product.name))}</div>`;

    const units = Array.from({ length: stack }, () => `<div class="stack-unit">${visual}</div>`).join('');

    // Calculate DOS & Capacity Badges
    const dosInfo = calculateProductDOS(product);
    let badgeHTML = '';
    const shelfDepth = spec.depth || 48;
    const singleRows = Math.max(1, Math.floor(shelfDepth / dims.depth));
    const localCap = (product.facing || 1) * stack * singleRows;

    if (dosInfo.dos !== null) {
      let badgeClass = 'dos-badge-ok';
      if (dosInfo.dos < 3) badgeClass = 'dos-badge-danger';
      else if (dosInfo.dos < 7) badgeClass = 'dos-badge-warning';
      badgeHTML = `<span class="product-dos-badge ${badgeClass}" title="Days of Supply: ${dosInfo.dos.toFixed(1)} วัน (ความจุรวมแผง ${dosInfo.capacity} ชิ้น)">${dosInfo.dos.toFixed(1)}d</span>`;
    } else {
      badgeHTML = `<span class="product-cap-badge" title="ความจุจุดนี้: ${localCap} ชิ้น (ลึก ${singleRows} แถว)">cap:${localCap}</span>`;
    }

    item.innerHTML = `
      ${badgeHTML}
      ${units}
      <button class="slot-remove" onclick="removeFromShelf(${seg},${shelf},${idx},event)" title="ลบ">×</button>
    `;

    el.appendChild(item);
  });

  // ─── Render capacity & utilization warning badge ───
  if (spec.width && spec.segments) {
    const segWidthCm = (spec.segmentWidths && spec.segmentWidths[seg]) || (spec.width / spec.segments);
    let usedCm = 0;
    placements.forEach((productId) => {
      const product = products.find((p) => p.id === productId);
      if (product) {
        const dims = getProductDimensions(product, spec.depth);
        usedCm += dims.width * (product.facing || 1);
      }
    });

    if (usedCm > 0) {
      const badge = document.createElement('div');
      const isOver = usedCm > segWidthCm;
      badge.className = `shelf-capacity-badge ${isOver ? 'over' : 'ok'}`;
      if (isOver) {
        const diff = (usedCm - segWidthCm).toFixed(1);
        badge.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>ล้น +${diff} cm`;
      } else {
        const diff = (segWidthCm - usedCm).toFixed(1);
        badge.innerHTML = `เหลือ ${diff} cm`;
      }
      el.appendChild(badge);
    }
  }
}

/**
 * Remove a product from a shelf by index
 */
function removeFromShelf(seg, shelf, idx, event) {
  if (event) event.stopPropagation();
  pushHistory();
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
  pushHistory();
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
      const dims = getProductDimensions(p, spec.depth);
      usedCm += dims.width * (p.facing || 1);
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
    { id: 'p_a', name: 'Laptop Riser Pro', category: 'Office', brand: 'ErgoLife', color: '#4a5568', facing: 2, width: '28', height: '22', depth: '24', price: 1290, salesRate: 1.2, image: null },
    { id: 'p_b', name: 'Memory Foam Cushion', category: 'Ergonomics', brand: 'ComfortCo', color: '#2b6cb0', facing: 1, width: '45', height: '40', depth: '12', price: 890, salesRate: 2.5, image: null },
    { id: 'p_c', name: 'Orthopedic Pillow', category: 'Bedding', brand: 'DeepSleep', color: '#4cbdc9', facing: 1, width: '60', height: '35', depth: '15', price: 1590, salesRate: 1.8, image: null },
    { id: 'p_d', name: 'Wooden Monitor Stand', category: 'Office', brand: 'ErgoLife', color: '#d69e2e', facing: 1, width: '50', height: '10', depth: '22', price: 790, salesRate: 0.8, image: null },
    { id: 'p_e', name: 'Therapeutic Backrest', category: 'Ergonomics', brand: 'ComfortCo', color: '#718096', facing: 1, width: '38', height: '43', depth: '15', price: 990, salesRate: 1.5, image: null }
  ];

  renderProductList();
  updateLegend();
  
  // Set larger depth for large products by default
  spec.depth = 50;
  if ($('shelfDepth')) $('shelfDepth').value = 50;
  
  buildShelf();

  placeProduct('p_a', 0, 0); placeProduct('p_b', 0, 0);
  placeProduct('p_c', 0, 1); placeProduct('p_d', 0, 1);
  placeProduct('p_e', 0, 2); placeProduct('p_a', 0, 2);
  placeProduct('p_b', 1, 0); placeProduct('p_c', 1, 0);
  placeProduct('p_d', 1, 1); placeProduct('p_e', 1, 1);
  placeProduct('p_a', 2, 0); placeProduct('p_b', 2, 0);
  placeProduct('p_c', 2, 1); placeProduct('p_d', 2, 2);

  selectProduct('p_a');
  showToast('โหลดตัวอย่างสินค้าขนาดใหญ่แล้ว');
}

/**
 * Open the mini-inspector popup above the clicked product on shelf
 */
function openMiniInspector(seg, shelf, idx, event, el) {
  activeInspectorTarget = { seg, shelf, idx };

  const key = `${seg}-${shelf}`;
  const productId = shelfData[key] ? shelfData[key][idx] : null;
  if (!productId) return;

  const product = products.find((p) => p.id === productId);
  if (!product) return;

  const popup = $('miniInspector');
  $('inspectorSku').textContent = `${product.name}`;
  $('inspectorFacingVal').textContent = product.facing || 1;
  $('inspectorStackVal').textContent = product.stack || 1;

  // Space & Capacity Analytics
  const dims = getProductDimensions(product, spec.depth || 48);
  const rows = Math.max(1, Math.floor((spec.depth || 48) / dims.depth));
  const stack = Math.max(1, product.stack || 1);
  const facing = product.facing || 1;
  const localCap = facing * stack * rows;
  const dosInfo = calculateProductDOS(product);

  if ($('inspectorRowsVal')) $('inspectorRowsVal').textContent = `${rows} แถว (ลึก ${Math.round(dims.depth)}cm)`;
  if ($('inspectorCapacityVal')) $('inspectorCapacityVal').textContent = `${localCap} ชิ้น`;
  if ($('inspectorSalesRateVal')) $('inspectorSalesRateVal').textContent = product.salesRate ? `${product.salesRate} /วัน` : '- /วัน';

  const dosValSpan = $('inspectorDosVal');
  if (dosValSpan) {
    if (dosInfo.dos !== null) {
      dosValSpan.textContent = `${dosInfo.dos.toFixed(1)} วัน`;
      if (dosInfo.dos < 3) dosValSpan.style.color = '#ef4444';
      else if (dosInfo.dos < 7) dosValSpan.style.color = '#f59e0b';
      else dosValSpan.style.color = '#10b981';
    } else {
      dosValSpan.textContent = '- วัน';
      dosValSpan.style.color = '#ccc';
    }
  }

  // Set orientation and rotation in UI
  const orientationSelect = $('inspectorOrientation');
  if (orientationSelect) orientationSelect.value = product.orientation || 'front';
  const rotateValSpan = $('inspectorRotateVal');
  if (rotateValSpan) rotateValSpan.textContent = `${product.rotation || 0}°`;

  const rect = el.getBoundingClientRect();
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  popup.style.display = 'flex';
  
  const left = rect.left + rect.width / 2 + scrollLeft;
  const top = rect.top + scrollTop;

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}

/**
 * Close the mini-inspector popup
 */
function closeMiniInspector() {
  activeInspectorTarget = null;
  const popup = $('miniInspector');
  if (popup) popup.style.display = 'none';
}

/**
 * Adjust the facing value of the currently inspected product
 */
function adjustInspectFacing(diff) {
  if (!activeInspectorTarget) return;
  const { seg, shelf, idx } = activeInspectorTarget;
  const key = `${seg}-${shelf}`;
  const productId = shelfData[key] ? shelfData[key][idx] : null;
  if (!productId) return;

  const product = products.find((p) => p.id === productId);
  if (!product) return;

  pushHistory();
  product.facing = Math.max(1, (product.facing || 1) + diff);
  
  $('inspectorFacingVal').textContent = product.facing;

  renderShelfFill();
  renderProductList();
  updateSummary();
  saveState();

  setTimeout(() => {
    const rowEl = $(`shelf-${seg}-${shelf}`);
    if (rowEl) {
      const prodEls = rowEl.querySelectorAll('.shelf-product');
      if (prodEls[idx]) {
        const rect = prodEls[idx].getBoundingClientRect();
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const popup = $('miniInspector');
        popup.style.left = `${rect.left + rect.width / 2 + scrollLeft}px`;
        popup.style.top = `${rect.top + scrollTop}px`;
      }
    }
  }, 50);
}

/**
 * Adjust how many units are stacked on top of each other for the inspected product
 */
function adjustInspectStack(diff) {
  if (!activeInspectorTarget) return;
  const { seg, shelf, idx } = activeInspectorTarget;
  const key = `${seg}-${shelf}`;
  const productId = shelfData[key] ? shelfData[key][idx] : null;
  if (!productId) return;

  const product = products.find((p) => p.id === productId);
  if (!product) return;

  pushHistory();
  product.stack = Math.max(1, (product.stack || 1) + diff);

  $('inspectorStackVal').textContent = product.stack;

  renderShelfFill();
  renderProductList();
  updateSummary();
  saveState();

  setTimeout(() => {
    const rowEl = $(`shelf-${seg}-${shelf}`);
    if (rowEl) {
      const prodEls = rowEl.querySelectorAll('.shelf-product');
      if (prodEls[idx]) {
        const rect = prodEls[idx].getBoundingClientRect();
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const popup = $('miniInspector');
        popup.style.left = `${rect.left + rect.width / 2 + scrollLeft}px`;
        popup.style.top = `${rect.top + scrollTop}px`;
      }
    }
  }, 50);
}

function deleteInspectPlacement() {
  if (!activeInspectorTarget) return;
  const { seg, shelf, idx } = activeInspectorTarget;

  removeFromShelf(seg, shelf, idx);
  closeMiniInspector();
  showToast('ลบสินค้าออกจากชั้นวางแล้ว');
}

/**
 * Change the orientation value of the inspected product
 */
function changeInspectOrientation(newVal) {
  if (!activeInspectorTarget) return;
  const { seg, shelf, idx } = activeInspectorTarget;
  const key = `${seg}-${shelf}`;
  const productId = shelfData[key] ? shelfData[key][idx] : null;
  if (!productId) return;

  const product = products.find((p) => p.id === productId);
  if (!product) return;

  pushHistory();
  product.orientation = newVal;

  renderShelfFill();
  renderProductList();
  updateSummary();
  saveState();

  if (window.Planogram3D && Planogram3D.isOpen()) {
    Planogram3D.refresh();
  }

  // Adjust mini inspector popup position to new center
  repositionMiniInspector(seg, shelf, idx);
}

/**
 * Rotate the inspected product by toggling between 0 and 90 degrees
 */
function rotateInspect90() {
  if (!activeInspectorTarget) return;
  const { seg, shelf, idx } = activeInspectorTarget;
  const key = `${seg}-${shelf}`;
  const productId = shelfData[key] ? shelfData[key][idx] : null;
  if (!productId) return;

  const product = products.find((p) => p.id === productId);
  if (!product) return;

  pushHistory();
  product.rotation = (product.rotation === 90) ? 0 : 90;

  $('inspectorRotateVal').textContent = `${product.rotation}°`;

  renderShelfFill();
  renderProductList();
  updateSummary();
  saveState();

  if (window.Planogram3D && Planogram3D.isOpen()) {
    Planogram3D.refresh();
  }

  // Adjust mini inspector popup position to new center
  repositionMiniInspector(seg, shelf, idx);
}

/**
 * Reposition mini inspector based on the product element's updated geometry
 */
function repositionMiniInspector(seg, shelf, idx) {
  setTimeout(() => {
    const rowEl = $(`shelf-${seg}-${shelf}`);
    if (rowEl) {
      const prodEls = rowEl.querySelectorAll('.shelf-product');
      if (prodEls[idx]) {
        const rect = prodEls[idx].getBoundingClientRect();
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const popup = $('miniInspector');
        popup.style.left = `${rect.left + rect.width / 2 + scrollLeft}px`;
        popup.style.top = `${rect.top + scrollTop}px`;
      }
    }
  }, 50);
}
