/* ═══════════════════════════════════════════════════════
   topview.js — 2D Floor Plan / Space Planning Layout Editor
   Handles Room/Area layouts for placing Fixtures, Tables,
   Chairs, Beds, and other furniture in Top-down view.
   ═══════════════════════════════════════════════════════ */

// Arrange a batch in rows; fail atomically when the complete batch cannot fit.
function layoutTopviewBatch(items, room, x, y) {
  const step = Math.max(1, Number(room.gridSize) || 20);
  let cx = 0, cy = 0, rowDepth = 0, width = 0;
  const result = [];
  for (const item of items) {
    const w = Number(item.width), d = Number(item.depth);
    if (![w, d].every(n => Number.isFinite(n) && n > 0) || w > room.width || d > room.depth) return null;
    if (cx && cx + w > room.width) { cx = 0; cy += Math.ceil(rowDepth / step) * step + step; rowDepth = 0; }
    if (cy + d > room.depth) return null;
    result.push({ productId: item.id, x: cx, y: cy, rotation: 0 });
    width = Math.max(width, cx + w);
    rowDepth = Math.max(rowDepth, d);
    cx += Math.ceil(w / step) * step + step;
  }
  const height = cy + rowDepth;
  const left = Math.max(0, Math.min(Math.round((x - width / 2) / step) * step, room.width - width));
  const top = Math.max(0, Math.min(Math.round((y - height / 2) / step) * step, room.depth - height));
  return result.map(item => ({ ...item, x: item.x + left, y: item.y + top }));
}

(function () {
  let areaSpec = { width: 600, depth: 400, gridSize: 20 };
  let placedItems = []; // Array of { id, productId, x, y, rotation }
  let pxPerCm = 0.8;    // Scale: pixels per cm, calculated on draw
  let zoomScale = 1.0;  // Zoom multiplier for 2D room board
  let isDragging = false;
  let dragTarget = null;
  let dragOffset = { x: 0, y: 0 };
  let isRotating = false;
  let rotateTarget = null;
  let rotateSnapshot = null;
  let rotateMoved = false;
  let rotateStart = null;
  let activeTab = 'planogram'; // 'planogram' | 'topview' | 'library'
  const selectedProducts = new Set();
  let selectedItemId = null;   // Currently selected placed item
  let undoStack = [];          // Snapshots of { areaSpec, placedItems }
  let redoStack = [];
  let dragSnapshot = null;     // History snapshot captured at drag start
  let dragMoved = false;
  let dragEl = null;           // DOM element being dragged (moved incrementally)
  let isPanning = false;       // Space+drag or middle-mouse pan
  let spaceHeld = false;
  let justPanned = false;      // Suppress the click that ends a pan
  let panStart = { x: 0, y: 0, sl: 0, st: 0 };
  let measureMode = false;     // Tape measure tool active
  let measureStart = null;     // First measure point { x, y } in cm
  let copiedItem = null;

  // Pre-configured furniture/fixture items
  const FURNITURE_PRESETS = [
    { name: 'Fixture Shelf (ชั้นวาง)', cat: 'Fixtures', brand: 'Generic', color: '#b9bec5', w: 100, h: 180, d: 45 },
    { name: 'Office Table (โต๊ะทำงาน)', cat: 'Furniture', brand: 'Generic', color: '#a05a2c', w: 120, h: 75, d: 60 },
    { name: 'Office Chair (เก้าอี้)', cat: 'Furniture', brand: 'Generic', color: '#1a1a1a', w: 60, h: 90, d: 60 },
    { name: 'Comfort Bed (เตียงนอน)', cat: 'Furniture', brand: 'Generic', color: '#3182ce', w: 150, h: 45, d: 200 },
    { name: 'Herman Miller Nevi Desk 1200', cat: 'Furniture', brand: 'Herman Miller', color: '#f8f8f4', w: 120, h: 75, d: 80, topviewAsset: 'nevi-desk' },
    { name: 'Herman Miller Nevi Desk 1400', cat: 'Furniture', brand: 'Herman Miller', color: '#f8f8f4', w: 140, h: 75, d: 80, topviewAsset: 'nevi-desk' },
    { name: 'Herman Miller Nevi Desk 1500', cat: 'Furniture', brand: 'Herman Miller', color: '#f8f8f4', w: 150, h: 75, d: 80, topviewAsset: 'nevi-desk' },
    { name: 'Herman Miller Nevi Desk 1600', cat: 'Furniture', brand: 'Herman Miller', color: '#f8f8f4', w: 160, h: 75, d: 80, topviewAsset: 'nevi-desk' },
    { name: 'Herman Miller Nevi Desk 1800', cat: 'Furniture', brand: 'Herman Miller', color: '#f8f8f4', w: 180, h: 75, d: 80, topviewAsset: 'nevi-desk' },
    { name: 'Herman Miller Sayl Chair', cat: 'Furniture', brand: 'Herman Miller', color: '#e8e3de', w: 60, h: 90, d: 60, topviewAsset: 'sayl-chair' }
  ];

  function toggleProduct(id) {
    if (selectedProducts.has(id)) selectedProducts.delete(id);
    else selectedProducts.add(id);
    selectedProductId = null;
    deselectItem();
    renderProductList();
  }

  function clearProductSelection() {
    selectedProducts.clear();
    selectedProductId = null;
    renderProductList();
  }

  function placeProducts(ids, x, y) {
    const batch = ids.map(id => products.find(p => p.id === id)).filter(Boolean);
    if (!batch.length || batch.length !== ids.length) return;
    const layout = layoutTopviewBatch(batch.map(p => ({id:p.id, width:parseCm(p.width,10), depth:parseCm(p.depth,10)})), areaSpec, x, y);
    if (!layout) { showToast('พื้นที่ห้องไม่พอสำหรับสินค้าทั้งชุด กรุณาลดจำนวนหรือขยายห้อง'); return; }
    pushHistory();
    placedItems.push(...layout.map(item => ({ ...item, id: 'placed_' + crypto.randomUUID() })));
    saveState();
    drawRoom();
    refresh3D();
    showToast(`วางสินค้า ${layout.length} ชิ้นแล้ว · Undo ย้อนกลับได้ทั้งชุด`);
  }

  /** Initialize Top View Layout module */
  function init() {
    loadState();
    
    // Bind UI actions
    const btnUpdate = $('btnUpdateRoom');
    if (btnUpdate) btnUpdate.addEventListener('click', updateRoom);
    
    const btnClear = $('btnClearRoom');
    if (btnClear) {
      // Create clear button dynamically if it doesn't exist yet
      btnClear.addEventListener('click', clearRoom);
    } else {
      // Find or bind dynamically
      const sidebarBody = $('bodyTopviewSettings');
      if (sidebarBody) {
        const btn = document.createElement('button');
        btn.id = 'btnClearRoom';
        btn.type = 'button';
        btn.className = 'btn btn-mini btn-ghost';
        btn.style.width = '100%';
        btn.style.marginTop = '8px';
        btn.textContent = 'ล้างพื้นที่ห้อง';
        btn.addEventListener('click', clearRoom);
        sidebarBody.appendChild(btn);
      }
    }

    // Zoom buttons binding (anchored to viewport center)
    const wrapCenter = () => {
      const w = $('topviewWrap');
      if (!w) return null;
      const r = w.getBoundingClientRect();
      return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    };
    const btnZoomIn = $('btnZoomIn');
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => adjustZoom(0.1, wrapCenter()));
    const btnZoomOut = $('btnZoomOut');
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => adjustZoom(-0.1, wrapCenter()));
    const btnZoomReset = $('btnZoomReset');
    if (btnZoomReset) btnZoomReset.addEventListener('click', () => resetZoom());
    const btnExportTopview = $('btnExportTopview');
    if (btnExportTopview) btnExportTopview.addEventListener('click', exportTopviewPNG);

    // Room Layout Template apply binding
    const btnApplyRoomTemplate = $('btnApplyRoomTemplate');
    if (btnApplyRoomTemplate) btnApplyRoomTemplate.addEventListener('click', applyRoomTemplate);

    // Capacity suggestion binding
    const btnSuggestCapacity = $('btnSuggestCapacity');
    if (btnSuggestCapacity) btnSuggestCapacity.addEventListener('click', suggestCapacity);

    // Tape measure toggle binding
    const btnMeasure = $('btnMeasure');
    if (btnMeasure) btnMeasure.addEventListener('click', () => setMeasureMode(!measureMode));

    // Set up drag & drop events on topview wrapper
    const wrap = $('topviewWrap');
    if (wrap) {
      wrap.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      wrap.addEventListener('drop', handleDrop);

      // Zoom using mouse wheel + Ctrl/Cmd key, anchored to cursor position
      wrap.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.1 : -0.1;
          adjustZoom(delta, { clientX: e.clientX, clientY: e.clientY });
        }
      }, { passive: false });

      // Pan: middle-mouse drag, or Space + left drag
      wrap.addEventListener('mousedown', (e) => {
        const middlePan = e.button === 1;
        const spacePan = spaceHeld && e.button === 0;
        if (!middlePan && !spacePan) return;
        e.preventDefault();
        isPanning = true;
        justPanned = false;
        panStart = { x: e.clientX, y: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop };
        wrap.style.cursor = 'grabbing';
      });
    }

    // Global drag listeners (bound once — drawRoom only rebuilds the board)
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', endDrag);

    // Keyboard shortcuts for topview workspace
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && spaceHeld) {
        spaceHeld = false;
        const w = $('topviewWrap');
        if (w && !isPanning) w.style.cursor = '';
      }
    });

    // Item Inspector bindings
    const xInput = $('tvItemX');
    if (xInput) xInput.addEventListener('change', applyInspectorPosition);
    const yInput = $('tvItemY');
    if (yInput) yInput.addEventListener('change', applyInspectorPosition);
    const rotSelect = $('tvItemRot');
    if (rotSelect) rotSelect.addEventListener('change', applyInspectorRotation);
    const btnDup = $('btnTvDuplicate');
    if (btnDup) btnDup.addEventListener('click', duplicateSelected);
    const btnRotSel = $('btnTvRotate');
    if (btnRotSel) btnRotSel.addEventListener('click', () => { if (selectedItemId) rotateFurniture(selectedItemId); });
    const btnDelSel = $('btnTvDelete');
    if (btnDelSel) btnDelSel.addEventListener('click', () => { if (selectedItemId) removeFurniture(selectedItemId); });

    // Hook tab switches from main app.js (we hook topbar navigation)
    hookTabs();

    // Redraw 2D room layout on window resize
    window.addEventListener('resize', () => {
      if (activeTab === 'topview' && (!window.Planogram3D || !Planogram3D.isOpen())) {
        drawRoom();
      }
    });
  }

  /* ─── Undo / Redo history ─── */

  /** Serialize current room state */
  function snapshot() {
    return JSON.stringify({ areaSpec, placedItems });
  }

  /** Push a snapshot onto the undo stack (call BEFORE mutating state) */
  function pushHistory(snap) {
    undoStack.push(snap || snapshot());
    if (undoStack.length > 50) undoStack.shift();
    redoStack = [];
    updateTopviewUndoButtons();
  }

  /** Restore room state from a serialized snapshot */
  function restoreSnapshot(snap) {
    const data = JSON.parse(snap);
    areaSpec = data.areaSpec;
    placedItems = data.placedItems;
    if (selectedItemId && !placedItems.some((x) => x.id === selectedItemId)) selectedItemId = null;

    const wInput = $('roomWidth');
    const dInput = $('roomDepth');
    const gInput = $('roomGridSize');
    if (wInput) wInput.value = areaSpec.width;
    if (dInput) dInput.value = areaSpec.depth;
    if (gInput) gInput.value = areaSpec.gridSize;

    saveState();
    drawRoom();
    refresh3D();
  }

  function undoTopview() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restoreSnapshot(undoStack.pop());
    updateTopviewUndoButtons();
  }

  function redoTopview() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restoreSnapshot(redoStack.pop());
    updateTopviewUndoButtons();
  }

  /** Sync the shared topbar undo/redo buttons with topview stacks */
  function updateTopviewUndoButtons() {
    if (activeTab !== 'topview') return;
    const u = $('btnUndo'), r = $('btnRedo');
    if (u) u.disabled = !undoStack.length;
    if (r) r.disabled = !redoStack.length;
  }

  /** Refresh 3D view if currently open */
  function refresh3D() {
    if (window.Planogram3D && Planogram3D.isOpen()) {
      Planogram3D.refresh();
    }
  }

  /* ─── Selection & Item Inspector ─── */

  /** Footprint (w × d in cm) of a placed item accounting for rotation */
  function itemFootprint(item, p) {
    const origW = parseCm(p.width, 10);
    const origD = parseCm(p.depth, 10);
    const rad = (rotationDegrees(item.rotation) * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    return {
      w: Math.round((origW * cos + origD * sin) * 10) / 10,
      d: Math.round((origW * sin + origD * cos) * 10) / 10
    };
  }

  function normalizeRotation(value) {
    return ((Math.round((parseFloat(value) || 0) / 45) * 45) % 360 + 360) % 360;
  }

  function rotationDegrees(value) {
    return (((parseFloat(value) || 0) % 360) + 360) % 360;
  }

  /** Rotate around center so the item does not jump */
  function setItemRotation(item, p, rotation, snap = true) {
    const before = itemFootprint(item, p);
    const cx = item.x + before.w / 2;
    const cy = item.y + before.d / 2;

    item.rotation = snap ? normalizeRotation(rotation) : Math.round(rotationDegrees(rotation) * 10) / 10;
    const after = itemFootprint(item, p);
    item.x = clamp(Math.round((cx - after.w / 2) * 10) / 10, 0, Math.max(0, areaSpec.width - after.w));
    item.y = clamp(Math.round((cy - after.d / 2) * 10) / 10, 0, Math.max(0, areaSpec.depth - after.d));
  }

  function topviewKind(p) {
    if (p.topviewAsset === 'nevi-desk') return 'nevi-desk';
    if (p.topviewAsset === 'sayl-chair') return 'sayl-chair';

    const text = `${p.name || ''} ${p.category || ''}`.toLowerCase();
    if (text.includes('nevi')) return 'nevi-desk';
    if (text.includes('sayl')) return 'sayl-chair';
    if (text.includes('bed') || text.includes('เตียง')) return 'bed';
    if (text.includes('chair') || text.includes('เก้าอี้') || text.includes('seat')) return 'chair';
    if (text.includes('table') || text.includes('desk') || text.includes('โต๊ะ')) return 'table';
    if (text.includes('shelf') || text.includes('fixture') || text.includes('ชั้น')) return 'shelf';
    if (text.includes('cabinet') || text.includes('ตู้')) return 'shelf';
    return 'product';
  }

  /** "เก้าอี้เพื่อสุขภาพ รุ่น Bergen All Black" → "Bergen All Black" */
  function chairModelLabel(name) {
    const marker = 'รุ่น ';
    const idx = name.indexOf(marker);
    return idx === -1 ? name : name.slice(idx + marker.length);
  }

  function appendTopviewSymbol(visual, p, kind) {
    visual.classList.add('tv-symbol', `tv-symbol-${kind}`);
    visual.innerHTML = '';

    const add = (cls) => {
      const node = document.createElement('span');
      node.className = cls;
      visual.appendChild(node);
      return node;
    };

    // เพิ่มป้ายระบุประเภทเด่นชัดที่มุมขวาบนเพื่อการจำแนกที่ง่ายขึ้น (ทั้งบนจอและรูปที่ Export)
    const tag = document.createElement('span');
    tag.className = `tv-category-tag tag-${kind}`;
    let tagText = 'สินค้า';
    if (kind === 'bed') tagText = 'เตียง';
    else if (kind === 'chair' || kind === 'sayl-chair') tagText = 'เก้าอี้';
    else if (kind === 'table' || kind === 'nevi-desk') tagText = 'โต๊ะ';
    else if (kind === 'shelf') tagText = 'เชลฟ์';
    tag.textContent = tagText;
    visual.appendChild(tag);

    if (kind === 'bed') {
      add('tv-bed-pillow pillow-a');
      add('tv-bed-pillow pillow-b');
      add('tv-bed-divider');
    } else if (kind === 'chair') {
      add('tv-ergo-headrest');
      add('tv-ergo-side-pill side-l');
      add('tv-ergo-side-pill side-r');
    } else if (kind === 'sayl-chair') {
      add('tv-sayl-back');
      add('tv-sayl-seat');
      add('tv-sayl-arm arm-l');
      add('tv-sayl-arm arm-r');
      add('tv-sayl-spine');
      add('tv-sayl-star spoke-a');
      add('tv-sayl-star spoke-b');
      add('tv-sayl-star spoke-c');
      add('tv-sayl-star spoke-d');
      add('tv-sayl-star spoke-e');
      add('tv-sayl-caster caster-a');
      add('tv-sayl-caster caster-b');
      add('tv-sayl-caster caster-c');
      add('tv-sayl-caster caster-d');
      add('tv-sayl-caster caster-e');
    } else if (kind === 'nevi-desk') {
      add('tv-nevi-top');
      add('tv-nevi-screen');
      add('tv-nevi-beam');
      add('tv-nevi-leg leg-a');
      add('tv-nevi-leg leg-b');
      add('tv-nevi-foot foot-a');
      add('tv-nevi-foot foot-b');
      add('tv-nevi-control');
    } else if (kind === 'table') {
      add('tv-table-top');
      add('tv-table-edge edge-a');
      add('tv-table-edge edge-b');
    } else if (kind === 'shelf') {
      add('tv-shelf-body');
      add('tv-shelf-line line-a');
      add('tv-shelf-line line-b');
      add('tv-shelf-line line-c');
    } else {
      add('tv-product-face');
    }

    // Chair icons show just the model name (the part after "รุ่น"), centered
    // on the seat; everything else keeps the compact corner label.
    const isChairKind = kind === 'chair' || kind === 'sayl-chair';
    const label = document.createElement('span');
    label.className = 'tv-symbol-label';
    label.textContent = isChairKind ? chairModelLabel(p.name) : shortName(p.name);
    visual.appendChild(label);

    const size = document.createElement('span');
    size.className = 'tv-symbol-size';
    size.textContent = `${parseCm(p.width, 10)}x${parseCm(p.depth, 10)} · ${p.category || 'SKU'}`;
    visual.appendChild(size);
  }

  /* ─── Collision detection ─── */

  /** Footprint rects { id, x, y, w, d } of all placed items */
  function getFootprints() {
    return placedItems.map((it) => {
      const p = products.find((q) => q.id === it.productId);
      if (!p) return null;
      const f = itemFootprint(it, p);
      return { id: it.id, x: it.x, y: it.y, w: f.w, d: f.d };
    }).filter(Boolean);
  }

  /** Strict AABB overlap — edge-touching (guide-snapped) items do NOT collide */
  function rectsOverlap(a, b) {
    return a.x + a.w > b.x && b.x + b.w > a.x && a.y + a.d > b.y && b.y + b.d > a.y;
  }

  /** Set of item ids that overlap at least one other item */
  function findCollidingIds() {
    const fps = getFootprints();
    const ids = new Set();
    for (let i = 0; i < fps.length; i++) {
      for (let j = i + 1; j < fps.length; j++) {
        if (rectsOverlap(fps[i], fps[j])) {
          ids.add(fps[i].id);
          ids.add(fps[j].id);
        }
      }
    }
    return ids;
  }

  /* ─── Tape measure tool ─── */

  /** Toggle tape measure mode */
  function setMeasureMode(on) {
    measureMode = on;
    measureStart = null;
    const btn = $('btnMeasure');
    if (btn) btn.classList.toggle('active', on);
    drawRoom(); // Creates/removes the measure overlay
    showToast(on ? 'โหมดวัดระยะ: คลิกจุดที่ 1 และจุดที่ 2 เพื่อวัด (Esc = ออก)' : 'ออกจากโหมดวัดระยะ');
  }

  /** Snap a measure point to nearby item corners, else to whole cm */
  function snapMeasurePoint(x, y) {
    const tol = 8 / pxPerCm;
    let best = null;
    let bestDist = tol;
    getFootprints().forEach((f) => {
      [[f.x, f.y], [f.x + f.w, f.y], [f.x, f.y + f.d], [f.x + f.w, f.y + f.d]].forEach(([cx, cy]) => {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist < bestDist) { bestDist = dist; best = { x: cx, y: cy }; }
      });
    });
    if (best) return best;
    return { x: clamp(Math.round(x), 0, areaSpec.width), y: clamp(Math.round(y), 0, areaSpec.depth) };
  }

  /** Draw the measurement line, endpoint dots and distance label */
  function renderMeasure(layer, a, b) {
    layer.innerHTML = '';
    const ax = a.x * pxPerCm, ay = a.y * pxPerCm;
    const bx = b.x * pxPerCm, by = b.y * pxPerCm;

    const line = document.createElement('div');
    line.className = 'tv-measure-line';
    line.style.left = `${ax}px`;
    line.style.top = `${ay}px`;
    line.style.width = `${Math.hypot(bx - ax, by - ay)}px`;
    line.style.transform = `rotate(${Math.atan2(by - ay, bx - ax)}rad)`;
    layer.appendChild(line);

    [[ax, ay], [bx, by]].forEach(([px, py]) => {
      const dot = document.createElement('div');
      dot.className = 'tv-measure-dot';
      dot.style.left = `${px}px`;
      dot.style.top = `${py}px`;
      layer.appendChild(dot);
    });

    const dist = Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 10) / 10;
    const label = document.createElement('div');
    label.className = 'tv-measure-label';
    label.style.left = `${(ax + bx) / 2}px`;
    label.style.top = `${(ay + by) / 2}px`;
    label.textContent = `${dist} cm`;
    layer.appendChild(label);
  }

  /** Add the click-capturing measure overlay on top of the board */
  function attachMeasureLayer() {
    const wrap = $('topviewWrap');
    const board = wrap ? wrap.querySelector('.room-board') : null;
    if (!board || board.querySelector('.tv-measure-layer')) return;

    const layer = document.createElement('div');
    layer.className = 'tv-measure-layer';

    layer.addEventListener('click', (e) => {
      e.stopPropagation(); // Keep the board's place/deselect handler out of measure clicks
      if (justPanned) {
        justPanned = false;
        return;
      }
      const rect = board.getBoundingClientRect();
      const pt = snapMeasurePoint((e.clientX - rect.left) / pxPerCm, (e.clientY - rect.top) / pxPerCm);
      if (!measureStart) {
        measureStart = pt;
        renderMeasure(layer, pt, pt);
      } else {
        renderMeasure(layer, measureStart, pt);
        measureStart = null; // Done — next click starts a new measurement
      }
    });

    layer.addEventListener('mousemove', (e) => {
      if (!measureStart) return;
      const rect = board.getBoundingClientRect();
      const pt = snapMeasurePoint((e.clientX - rect.left) / pxPerCm, (e.clientY - rect.top) / pxPerCm);
      renderMeasure(layer, measureStart, pt);
    });

    board.appendChild(layer);
  }

  function selectItem(id) {
    if (selectedItemId === id) return;
    selectedItemId = id;
    updateSelectionUI();
  }

  function deselectItem() {
    if (!selectedItemId) return;
    selectedItemId = null;
    updateSelectionUI();
  }

  /** Apply selection highlight to rendered items + refresh inspector */
  function updateSelectionUI() {
    const wrap = $('topviewWrap');
    if (wrap) {
      wrap.querySelectorAll('.placed-furniture').forEach((el) => {
        el.classList.toggle('tv-selected', el.dataset.itemId === selectedItemId);
      });
    }
    updateInspector();
  }

  /** Populate the Item Inspector panel from the selected item */
  function updateInspector() {
    const empty = $('tvInspectorEmpty');
    const fields = $('tvInspectorFields');
    if (!empty || !fields) return;

    const item = placedItems.find((x) => x.id === selectedItemId);
    const p = item ? products.find((q) => q.id === item.productId) : null;

    if (!item || !p) {
      empty.style.display = 'block';
      fields.style.display = 'none';
      return;
    }

    empty.style.display = 'none';
    fields.style.display = 'block';

    const name = $('tvItemName');
    if (name) name.textContent = p.name;
    const xInput = $('tvItemX');
    if (xInput) xInput.value = item.x;
    const yInput = $('tvItemY');
    if (yInput) yInput.value = item.y;
    const rotSelect = $('tvItemRot');
    if (rotSelect) rotSelect.value = String(normalizeRotation(item.rotation));
    const sizeInput = $('tvItemSize');
    if (sizeInput) sizeInput.value = `${parseCm(p.width, 10)} × ${parseCm(p.depth, 10)} cm`;
  }

  /** Apply X/Y typed into the inspector */
  function applyInspectorPosition() {
    const item = placedItems.find((x) => x.id === selectedItemId);
    if (!item) return;
    const p = products.find((q) => q.id === item.productId);
    if (!p) return;

    const { w, d } = itemFootprint(item, p);
    const xCm = clamp(parseInt($('tvItemX').value) || 0, 0, areaSpec.width - w);
    const yCm = clamp(parseInt($('tvItemY').value) || 0, 0, areaSpec.depth - d);

    if (xCm === item.x && yCm === item.y) {
      updateInspector(); // Re-sync displayed (clamped) values
      return;
    }

    pushHistory();
    item.x = xCm;
    item.y = yCm;
    saveState();
    drawRoom();
    refresh3D();
  }

  /** Apply rotation chosen in the inspector */
  function applyInspectorRotation() {
    const item = placedItems.find((x) => x.id === selectedItemId);
    if (!item) return;
    const p = products.find((q) => q.id === item.productId);
    if (!p) return;

    const rot = normalizeRotation($('tvItemRot').value);
    if (rot === item.rotation) return;

    pushHistory();
    setItemRotation(item, p, rot);
    saveState();
    drawRoom();
    refresh3D();
  }

  /** Duplicate the selected item, placed adjacent to the original */
  function duplicateSelected() {
    const item = placedItems.find((x) => x.id === selectedItemId);
    if (!item) {
      showToast('คลิกเลือกสิ่งของในแปลนก่อนทำซ้ำ');
      return;
    }
    const p = products.find((q) => q.id === item.productId);
    if (!p) return;

    pushHistory();
    const { w, d } = itemFootprint(item, p);
    const copy = {
      id: 'placed_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      productId: item.productId,
      x: clamp(item.x + w, 0, areaSpec.width - w),
      y: clamp(item.y, 0, areaSpec.depth - d),
      rotation: item.rotation
    };
    placedItems.push(copy);
    selectedItemId = copy.id;
    saveState();
    drawRoom();
    refresh3D();
    showToast(`ทำซ้ำ ${p.name} แล้ว`);
  }

  function copySelected() {
    const item = placedItems.find((x) => x.id === selectedItemId);
    if (!item) {
      showToast('คลิกเลือกสิ่งของในแปลนก่อน copy');
      return;
    }
    copiedItem = { productId: item.productId, x: item.x, y: item.y, rotation: item.rotation };
    showToast('Copy แล้ว');
  }

  function pasteCopied() {
    if (!copiedItem) {
      showToast('ยังไม่มีสิ่งของที่ copy');
      return;
    }
    const p = products.find((q) => q.id === copiedItem.productId);
    if (!p) return;

    const { w, d } = itemFootprint(copiedItem, p);
    const step = areaSpec.gridSize || 10;
    const copy = {
      id: 'placed_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      productId: copiedItem.productId,
      x: clamp(copiedItem.x + step, 0, areaSpec.width - w),
      y: clamp(copiedItem.y + step, 0, areaSpec.depth - d),
      rotation: copiedItem.rotation
    };

    pushHistory();
    placedItems.push(copy);
    selectedItemId = copy.id;
    copiedItem = { productId: copy.productId, x: copy.x, y: copy.y, rotation: copy.rotation };
    saveState();
    drawRoom();
    refresh3D();
    showToast(`Paste ${p.name} แล้ว`);
  }

  /** Nudge selected item by grid step (or 1 cm when fine = true) */
  function nudgeSelected(dx, dy, fine, isRepeat) {
    const item = placedItems.find((x) => x.id === selectedItemId);
    if (!item) return;
    const p = products.find((q) => q.id === item.productId);
    if (!p) return;

    const step = fine ? 1 : areaSpec.gridSize;
    const { w, d } = itemFootprint(item, p);
    if (!isRepeat) pushHistory(); // Held key = one history entry
    item.x = clamp(item.x + dx * step, 0, areaSpec.width - w);
    item.y = clamp(item.y + dy * step, 0, areaSpec.depth - d);
    saveState();
    drawRoom();
    refresh3D();
  }

  /** Keyboard shortcuts (active only on Top View tab, outside form fields) */
  function handleKeydown(e) {
    if (activeTab !== 'topview') return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // Hold Space = pan mode (grab cursor, drag scrolls the canvas)
    if (e.code === 'Space') {
      e.preventDefault();
      if (!spaceHeld) {
        spaceHeld = true;
        const w = $('topviewWrap');
        if (w && !isPanning) w.style.cursor = 'grab';
      }
      return;
    }

    // M = toggle tape measure · Esc exits measure mode first
    if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setMeasureMode(!measureMode);
      return;
    }
    if (e.key === 'Escape' && measureMode) {
      setMeasureMode(false);
      return;
    }

    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      copySelected();
      return;
    }
    if (mod && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      pasteCopied();
      return;
    }

    if (e.key === 'Escape') { clearProductSelection(); deselectItem(); return; }
    if (!selectedItemId) return;

    if (mod && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      duplicateSelected();
      return;
    }
    if (mod) return; // Cmd+Z / Cmd+Shift+Z handled by app.js routing

    switch (e.key) {
      case 'ArrowLeft': e.preventDefault(); nudgeSelected(-1, 0, e.shiftKey, e.repeat); break;
      case 'ArrowRight': e.preventDefault(); nudgeSelected(1, 0, e.shiftKey, e.repeat); break;
      case 'ArrowUp': e.preventDefault(); nudgeSelected(0, -1, e.shiftKey, e.repeat); break;
      case 'ArrowDown': e.preventDefault(); nudgeSelected(0, 1, e.shiftKey, e.repeat); break;
      case 'r': case 'R': e.preventDefault(); rotateFurniture(selectedItemId); break;
      case 'Delete': case 'Backspace': e.preventDefault(); removeFurniture(selectedItemId); break;
      case 'Escape': deselectItem(); break;
    }
  }

  /** Inject default furniture products if they don't exist */
  function injectPresets() {
    let changed = false;
    FURNITURE_PRESETS.forEach((preset) => {
      const exists = products.some((p) => p.name === preset.name);
      if (!exists) {
        products.push({
          id: 'p_furn_' + preset.name.replace(/[^a-zA-Z]/g, '').toLowerCase() + '_' + Math.random().toString(36).slice(2, 5),
          name: preset.name,
          category: preset.cat,
          brand: preset.brand,
          color: preset.color,
          facing: 1,
          width: String(preset.w),
          height: String(preset.h),
          depth: String(preset.d),
          image: null,
          topviewAsset: preset.topviewAsset || null
        });
        changed = true;
      }
    });
    if (changed) {
      if (typeof renderProductList === 'function') renderProductList();
      if (typeof saveState === 'function') saveState();
    }
  }

  /** Hook main app navigation tabs */
  function hookTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        activeTab = target;

        // Re-scope the Product Library to the new tab (Top View = Master Fur only)
        if (typeof renderProductList === 'function') renderProductList();

        // Auto-close 3D view when switching tabs to ensure 2D workspace is visible
        if (window.Planogram3D && Planogram3D.isOpen()) {
          Planogram3D.close();
          const btn = $('btnToggle3D');
          if (btn) btn.classList.remove('active');
        }

        if (target === 'topview') {
          activateTopview();
        } else {
          deactivateTopview();
        }
      });
    });
  }

  /** Activate topview layout workspace */
  function activateTopview() {
    // 1. Swapping Left panel setting sections
    const pSettings = $('sectionSettings');
    const pTemplates = document.querySelector('.template-block')?.closest('.side-section') || $('sectionTemplates');
    const tSettings = $('sectionTopviewSettings');

    if (pSettings) pSettings.style.display = 'none';
    if (pTemplates) pTemplates.style.display = 'none';
    if (tSettings) tSettings.style.display = 'block';

    // 2. Swapping Stage main canvases
    const pArea = $('exportArea');
    const tArea = $('topviewArea');

    if (pArea) pArea.style.display = 'none';
    if (tArea) tArea.style.display = 'block';

    // 3. Update top toolbar buttons
    const btnReport = $('btnShowReport');
    const btnClearAll = $('btnClearAll');
    
    if (btnReport) btnReport.style.display = 'none';
    if (btnClearAll) btnClearAll.style.display = 'none';

    // 4. Inject furniture library presets
    injectPresets();

    // 5. Show Item Inspector panel + sync undo/redo buttons to topview stacks
    const tInspector = $('sectionTopviewInspector');
    if (tInspector) tInspector.style.display = 'block';
    updateTopviewUndoButtons();
    updateInspector();

    // 6. Render room
    drawRoom();

    // 7. Refresh 3D if open
    refresh3D();
  }

  /** Deactivate topview and restore planogram workspace */
  function deactivateTopview() {
    // Quietly exit measure mode (no toast/redraw — workspace is being hidden)
    if (measureMode) {
      measureMode = false;
      measureStart = null;
      const btnMeasure = $('btnMeasure');
      if (btnMeasure) btnMeasure.classList.remove('active');
    }

    const pSettings = $('sectionSettings');
    const pTemplates = document.querySelector('.template-block')?.closest('.side-section') || $('sectionTemplates');
    const tSettings = $('sectionTopviewSettings');
    const tInspector = $('sectionTopviewInspector');

    if (pSettings) pSettings.style.display = 'block';
    if (pTemplates) pTemplates.style.display = 'block';
    if (tSettings) tSettings.style.display = 'none';
    if (tInspector) tInspector.style.display = 'none';

    const pArea = $('exportArea');
    const tArea = $('topviewArea');

    if (pArea && (!window.Planogram3D || !Planogram3D.isOpen())) pArea.style.display = 'block';
    if (tArea) tArea.style.display = 'none';

    const btnReport = $('btnShowReport');
    const btnClearAll = $('btnClearAll');

    if (btnReport) btnReport.style.display = 'block';
    if (btnClearAll) btnClearAll.style.display = 'block';

    // Hand undo/redo buttons back to the planogram stacks
    if (typeof updateUndoButtons === 'function') updateUndoButtons();
    // Restore the planogram summary cards (topview left its own stats behind)
    if (typeof updateSummary === 'function') updateSummary();

    refresh3D();
  }

  /** Update Room specifications from inputs */
  function updateRoom() {
    const wInput = $('roomWidth');
    const dInput = $('roomDepth');
    const gInput = $('roomGridSize');

    if (wInput && dInput) {
      const before = snapshot();
      areaSpec.width = clamp(parseInt(wInput.value) || 600, 100, 2000);
      areaSpec.depth = clamp(parseInt(dInput.value) || 400, 100, 2000);
      areaSpec.gridSize = clamp(parseInt(gInput.value) || 20, 5, 100);
      if (snapshot() !== before) pushHistory(before);

      wInput.value = areaSpec.width;
      dInput.value = areaSpec.depth;
      gInput.value = areaSpec.gridSize;

      saveState();
      drawRoom();
      showToast('อัปเดตขนาดห้องแล้ว');

      refresh3D();
    }
  }

  /** Clear all placed items inside the room */
  function clearRoom() {
    if (confirm('คุณต้องการลบสิ่งของทั้งหมดออกจากพื้นที่ห้องใช่หรือไม่?')) {
      if (placedItems.length) pushHistory();
      placedItems = [];
      selectedItemId = null;
      saveState();
      drawRoom();
      showToast('ล้างห้องเรียบร้อย');

      refresh3D();
    }
  }

  // Back wall = y near 0 (display fixtures against it); front = y near areaSpec.depth
  // (kept clear as the booth entrance/walkway). See wall labels drawn in drawRoom().
  const BOOTH_ZONE_ORDER = ['shelf', 'bed', 'chair', 'table'];

  function capWalkwayValue() {
    const input = document.querySelector('#capacitySuggestResult #capWalkway');
    return Math.max(0, parseInt(input && input.value, 10) || 50);
  }

  /** All room cells (in booth-band order) where a w×d item would fit without
   *  overlapping anything already placed in the real room, starting from startY. */
  function tileBandCells(w, d, startY, minX, maxX, maxY, gap) {
    const cells = [];
    let x = minX, y = startY;
    while (true) {
      if (x + w > maxX) { x = minX; y += d + gap; }
      if (y + d > maxY) break;
      const rect = { x, y, w, d };
      if (!getFootprints().some((f) => rectsOverlap(rect, f))) cells.push({ x, y });
      x += w + gap;
    }
    return cells;
  }

  /** Run the booth-band plan across all category rows in zone order, each row
   *  consuming real floor space before the next is evaluated — so a category's
   *  "max that fits" reflects what's actually left after earlier categories' chosen
   *  quantities (and anything already in the room), not the whole room in isolation. */
  function computeBoothPlan(entries) {
    const WALKWAY = capWalkwayValue();
    const ITEM_GAP = 10; // cm breathing room between items within a band
    const minX = WALKWAY, maxX = areaSpec.width - WALKWAY, maxY = areaSpec.depth - WALKWAY;
    const roomOk = maxX > minX && maxY > WALKWAY;

    let cursorY = WALKWAY;
    const results = entries.map((entry) => {
      if (!roomOk || cursorY >= maxY) return { ...entry, maxFit: 0, placed: 0, cells: [] };
      const cells = tileBandCells(entry.w, entry.d, cursorY, minX, maxX, maxY, ITEM_GAP);
      const placed = Math.min(entry.qty, cells.length);
      const used = cells.slice(0, placed);
      if (used.length) cursorY = Math.max(...used.map((c) => c.y + entry.d)) + WALKWAY;
      return { ...entry, maxFit: cells.length, placed, cells: used };
    });

    return { results, WALKWAY, roomOk };
  }

  function readCapRows() {
    return Array.from(document.querySelectorAll('#capacitySuggestResult .cap-row'))
      .sort((a, b) => BOOTH_ZONE_ORDER.indexOf(a.dataset.kind) - BOOTH_ZONE_ORDER.indexOf(b.dataset.kind))
      .map((row) => ({
        row,
        productId: row.querySelector('.cap-product').value,
        w: parseFloat(row.querySelector('.cap-w').value) || 1,
        d: parseFloat(row.querySelector('.cap-d').value) || 1,
        qty: parseInt(row.querySelector('.cap-qty').value, 10) || 0
      }));
  }

  /** Estimate how many chairs/tables/shelves/beds fit in a W×D room. Each row lets the
   *  user pick the exact SKU (or type a custom W×D) and a quantity to place; "สูงสุด"
   *  recalculates live across all rows via computeBoothPlan, so setting e.g. 10 chairs
   *  visibly eats into the remaining quota shown for tables/shelves/beds that come
   *  after chairs in the booth band order — the number always reflects real remaining
   *  floor space, not each category estimated in isolation. */
  function suggestCapacity() {
    const kindLabels = { chair: 'เก้าอี้', table: 'โต๊ะ', shelf: 'เชลฟ์', bed: 'เตียง' };
    const kindAlias = { 'sayl-chair': 'chair', 'nevi-desk': 'table' };
    const byKind = {}; // kind -> products[]
    productLibrarySource().forEach((p) => {
      const key = kindAlias[topviewKind(p)] || topviewKind(p);
      if (!kindLabels[key]) return;
      (byKind[key] = byKind[key] || []).push(p);
    });

    const result = $('capacitySuggestResult');
    if (!result) return;

    const kinds = Object.keys(kindLabels).filter((k) => byKind[k] && byKind[k].length);
    if (!kinds.length) {
      result.innerHTML = `<div style="color: var(--muted);">ไม่พบสินค้าเฟอร์นิเจอร์ในคลังเพื่อประมาณการ</div>`;
      return;
    }

    result.innerHTML = kinds.map((k) => {
      const opts = byKind[k].map((p) =>
        `<option value="${esc(p.id)}">${esc(p.name)} (${parseCm(p.width, 10)}×${parseCm(p.depth, 10)})</option>`
      ).join('');
      const first = byKind[k][0];
      return `
        <div class="cap-row" data-kind="${k}" style="margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed var(--line);">
          <div style="font-weight: 600; margin-bottom: 4px;">${kindLabels[k]}</div>
          <select class="cap-product" style="width: 100%; margin-bottom: 4px; font-size: 0.75rem;">${opts}</select>
          <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
            <input type="number" class="cap-w" min="1" style="width: 56px;" value="${parseCm(first.width, 10)}"> ×
            <input type="number" class="cap-d" min="1" style="width: 56px;" value="${parseCm(first.depth, 10)}"> cm
            → เหลือที่วางได้ <strong class="cap-count">-</strong> ตัว
          </div>
          <div style="display: flex; gap: 4px; align-items: center; margin-top: 4px;">
            <label style="font-size: 0.72rem; color: var(--muted);">จำนวนที่จะวาง:</label>
            <input type="number" class="cap-qty" min="0" step="1" value="0" style="width: 56px;">
          </div>
        </div>`;
    }).join('')
      + `<div style="color: var(--muted); margin: 4px 0;">*"เหลือที่วางได้" คำนวณจากพื้นที่จริงที่เหลือ หลังหักของที่วางอยู่แล้วและจำนวนที่ตั้งไว้ในหมวดอื่นๆ ด้านบน</div>`
      + `<div style="display: flex; gap: 4px; align-items: center; margin-bottom: 6px;">
           <label style="font-size: 0.72rem; color: var(--muted);">ระยะเว้นทางเดิน (cm):</label>
           <input type="number" id="capWalkway" min="0" step="5" value="50" style="width: 56px;">
         </div>`
      + `<button type="button" id="btnPlaceSuggested" class="btn btn-mini btn-build" style="width: 100%; margin-top: 4px;">📥 จัดวางลงแปลนตามจำนวน</button>`;

    const recalcAll = () => {
      const entries = readCapRows();
      const { results, roomOk } = computeBoothPlan(entries);
      results.forEach((r) => {
        r.row.querySelector('.cap-count').textContent = roomOk ? r.maxFit : 0;
      });
    };

    kinds.forEach((k) => {
      const row = result.querySelector(`.cap-row[data-kind="${k}"]`);
      const sel = row.querySelector('.cap-product');
      sel.addEventListener('change', () => {
        const p = byKind[k].find((q) => q.id === sel.value);
        row.querySelector('.cap-w').value = parseCm(p.width, 10);
        row.querySelector('.cap-d').value = parseCm(p.depth, 10);
        recalcAll();
      });
      row.querySelector('.cap-w').addEventListener('input', recalcAll);
      row.querySelector('.cap-d').addEventListener('input', recalcAll);
      row.querySelector('.cap-qty').addEventListener('input', recalcAll);
    });

    const walkwayInput = result.querySelector('#capWalkway');
    if (walkwayInput) walkwayInput.addEventListener('input', recalcAll);

    recalcAll();

    const btnPlace = $('btnPlaceSuggested');
    if (btnPlace) btnPlace.addEventListener('click', placeSuggestedItems);
  }

  /** Auto-place the quantities chosen in the capacity-suggestion rows into the room as a
   *  booth-style layout: a walkway clearance runs around the room's perimeter and as an
   *  aisle between category bands (default 50cm, matches standard booth circulation).
   *  Shelves/beds band against the back wall first, chairs/tables fill the open center
   *  toward the front entrance, each band wrapping left-to-right within itself. Uses the
   *  same computeBoothPlan as the live "เหลือที่วางได้" preview, so what gets placed here
   *  matches what the panel showed. */
  function placeSuggestedItems() {
    const entries = readCapRows();
    if (!entries.length) return;

    const totalRequested = entries.reduce((sum, e) => sum + e.qty, 0);
    if (!totalRequested) {
      showToast('กรุณาระบุจำนวนที่ต้องการวางก่อน');
      return;
    }

    const { results, WALKWAY, roomOk } = computeBoothPlan(entries);
    if (!roomOk) {
      showToast('ระยะเว้นทางเดินกว้างเกินขนาดห้อง ลองลดค่าลง');
      return;
    }

    pushHistory();
    let totalPlaced = 0;
    results.forEach((r) => {
      r.cells.forEach(({ x, y }) => {
        placedItems.push({
          id: 'placed_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
          productId: r.productId,
          x, y,
          rotation: 0
        });
      });
      totalPlaced += r.cells.length;
    });

    saveState();
    drawRoom();
    refresh3D();
    const shortfall = totalRequested - totalPlaced;
    showToast(shortfall > 0
      ? `วางแล้ว ${totalPlaced} ชิ้น (พื้นที่ไม่พอสำหรับอีก ${shortfall} ชิ้น หลังเว้นทางเดิน ${WALKWAY}cm)`
      : `วางแล้ว ${totalPlaced} ชิ้น เว้นทางเดินรอบบูธ ${WALKWAY}cm`);
  }

  /** Calculate Room area usage statistics */
  function updateRoomStats() {
    const totalArea = areaSpec.width * areaSpec.depth; // cm^2
    let occupiedArea = 0;

    placedItems.forEach((item) => {
      const p = products.find((q) => q.id === item.productId);
      if (!p) return;
      
      const w = parseCm(p.width, 10);
      const d = parseCm(p.depth, 10);
      occupiedArea += w * d; // Product area topview
    });

    const percent = Math.min(100, Math.round((occupiedArea / totalArea) * 100));

    // Update Overall Summary Cards
    const summary = $('summaryGrid');
    if (summary && activeTab === 'topview') {
      summary.innerHTML = `
        <div class="summary-card">
          <div class="card-val">${areaSpec.width}x${areaSpec.depth}</div>
          <div class="card-lbl">ขนาดห้อง (W x D cm)</div>
        </div>
        <div class="summary-card">
          <div class="card-val">${placedItems.length}</div>
          <div class="card-lbl">สิ่งของที่วางอยู่ (ชิ้น)</div>
        </div>
        <div class="summary-card">
          <div class="card-val">${percent}%</div>
          <div class="card-lbl">อัตราการใช้พื้นที่ (Occupancy)</div>
        </div>
      `;
    }
  }

  /** Render the 2D Top View Grid Canvas */
  function drawRoom() {
    const wrap = $('topviewWrap');
    if (!wrap) return;

    // Preserve scroll so redraws (rotate, undo, drag end) don't jump the view
    const prevScrollLeft = wrap.scrollLeft;
    const prevScrollTop = wrap.scrollTop;

    wrap.innerHTML = '';
    updateRoomStats();

    const collidingIds = findCollidingIds();

    const topviewMeta = $('topviewMeta');
    if (topviewMeta) {
      const warn = collidingIds.size ? ` · ⚠️ ซ้อนทับ ${collidingIds.size} ชิ้น` : '';
      topviewMeta.textContent = `${areaSpec.width}w × ${areaSpec.depth}d cm · Grid: ${areaSpec.gridSize} cm · วางแล้ว ${placedItems.length} ชิ้น${warn}`;
    }

    // Determine scale to fit wrapper client width/height
    let hostWidth = wrap.clientWidth - 40;
    let hostHeight = wrap.clientHeight - 40;

    if (hostWidth <= 0) hostWidth = 800; // Fallback default width
    if (hostHeight <= 0) hostHeight = 500; // Fallback default height
    hostHeight = Math.max(400, hostHeight);

    const scaleX = hostWidth / areaSpec.width;
    const scaleY = hostHeight / areaSpec.depth;
    pxPerCm = Math.min(scaleX, scaleY, 1.2) * zoomScale; // Cap at 1.2px/cm, multiply by zoomScale

    const canvasW = Math.round(areaSpec.width * pxPerCm);
    const canvasH = Math.round(areaSpec.depth * pxPerCm);

    // Center via auto margins instead of flex alignment — a flex-centered child
    // larger than its container clips the top/left edge beyond scroll reach
    wrap.style.alignItems = 'flex-start';
    wrap.style.justifyContent = 'flex-start';

    // Gutter reserved for the CAD-style dimension lines: width total above the
    // room, depth total to its right (matches an architectural floor plan).
    const DIM_TOP = 34;
    const DIM_RIGHT = 70;

    // Extra gutters, outside the room's border, for the BACK/FRONT/LEFT/RIGHT wall
    // labels — kept off the floor plan itself so grid lines, dimension ticks, and
    // placed furniture never sit behind (or get sat on by) the label text.
    const LABEL_TOP = 22;
    const LABEL_BOTTOM = 22;
    const LABEL_LEFT = 92;
    const LABEL_RIGHT = 92;

    const boardLeft = LABEL_LEFT;
    const boardTop = DIM_TOP + LABEL_TOP;

    const scaleShell = document.createElement('div');
    scaleShell.className = 'room-scale-shell';
    scaleShell.style.width = `${boardLeft + canvasW + LABEL_RIGHT + DIM_RIGHT + 16}px`;
    scaleShell.style.height = `${boardTop + canvasH + LABEL_BOTTOM + 16}px`;
    scaleShell.style.flexShrink = '0';
    scaleShell.style.position = 'relative';

    // Create Floor Board
    const board = document.createElement('div');
    board.className = 'room-board';
    board.style.width = `${canvasW}px`;
    board.style.height = `${canvasH}px`;
    board.style.position = 'absolute';
    board.style.left = `${boardLeft}px`;
    board.style.top = `${boardTop}px`;
    board.style.background = '#f5f2ec';
    board.style.border = '2px solid #6f6a61';
    board.style.boxShadow = '0 0 0 5px #e2ddd4, 0 18px 40px -12px rgba(48,40,28,0.22)';
    
    // Draw Grid Lines (using CSS background)
    const gridSizePx = areaSpec.gridSize * pxPerCm;
    board.style.backgroundImage = `
      linear-gradient(to right, rgba(84,76,62,0.055) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(84,76,62,0.055) 1px, transparent 1px)
    `;
    board.style.backgroundSize = `${gridSizePx}px ${gridSizePx}px`;

    // Wall/side labels — placed outside the room's border (in their own gutters, not
    // on the floor plan itself) so grid lines, dimension ticks, or placed furniture
    // never sit behind (or get sat on by) the label text. Orientation: back wall
    // (fixtures band against it) at the top, front/entrance (kept clear as the booth
    // walkway) at the bottom.
    const wallLabel = (text, style) => {
      const el = document.createElement('div');
      el.className = 'tv-wall-label';
      el.textContent = text;
      el.style.position = 'absolute';
      el.style.fontSize = '10px';
      el.style.fontWeight = '700';
      el.style.letterSpacing = '0.02em';
      el.style.color = '#3a3f47';
      el.style.background = 'rgba(255,255,255,0.92)';
      el.style.border = '1px solid rgba(32,36,42,0.15)';
      el.style.borderRadius = '10px';
      el.style.padding = '2px 8px';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '5';
      Object.assign(el.style, style);
      scaleShell.appendChild(el);
    };
    wallLabel('ผนังหลัง / BACK', {
      top: `${DIM_TOP + 2}px`, left: `${boardLeft + canvasW / 2}px`,
      transform: 'translateX(-50%)', whiteSpace: 'nowrap', maxWidth: `${canvasW - 8}px`, overflow: 'hidden', textOverflow: 'ellipsis'
    });
    wallLabel('ทางเข้า / WALKWAY', {
      top: `${boardTop + canvasH + 2}px`, left: `${boardLeft + canvasW / 2}px`,
      transform: 'translateX(-50%)', whiteSpace: 'nowrap', maxWidth: `${canvasW - 8}px`, overflow: 'hidden', textOverflow: 'ellipsis'
    });
    wallLabel('ผนังซ้าย (LEFT)', {
      left: '2px', top: `${boardTop + canvasH / 2}px`, transform: 'translateY(-50%)',
      width: `${LABEL_LEFT - 8}px`, textAlign: 'center'
    });
    wallLabel('ผนังขวา (RIGHT)', {
      left: `${boardLeft + canvasW + 4}px`, top: `${boardTop + canvasH / 2}px`, transform: 'translateY(-50%)',
      width: `${LABEL_RIGHT - 8}px`, textAlign: 'center'
    });

    // Click to place product on board
    board.addEventListener('click', (e) => {
      // Ignore the click that ends a Space+drag pan
      if (justPanned) {
        justPanned = false;
        return;
      }
      // Ignore click on placed items or buttons
      if (e.target.closest('.placed-furniture') || e.target.tagName === 'BUTTON') return;

      // Click on empty floor with an item selected = deselect (design-tool behavior)
      if (selectedItemId) {
        deselectItem();
        return;
      }

      const ids = [...selectedProducts];
      if (!ids.length && selectedProductId) ids.push(selectedProductId);
      if (ids.length) {
        const rect = board.getBoundingClientRect();
        placeProducts(ids, (e.clientX - rect.left) / pxPerCm, (e.clientY - rect.top) / pxPerCm);
      } else showToast('เลือกสินค้าจากคลังได้หลายตัว แล้วคลิกบนแปลนเพื่อวางพร้อมกัน');
    });

    // Render placed furniture/fixtures
    placedItems.forEach((item) => {
      const p = products.find((q) => q.id === item.productId);
      if (!p) return;

      const origW = parseCm(p.width, 10);
      const origD = parseCm(p.depth, 10);
      const { w, d } = itemFootprint(item, p);

      const wPx = Math.round(w * pxPerCm);
      const dPx = Math.round(d * pxPerCm);
      const visualWPx = Math.round(origW * pxPerCm);
      const visualDPx = Math.round(origD * pxPerCm);
      const xPx = Math.round(item.x * pxPerCm);
      const yPx = Math.round(item.y * pxPerCm);

      const el = document.createElement('div');
      el.className = 'placed-furniture';
      el.dataset.itemId = item.id;
      if (item.id === selectedItemId) el.classList.add('tv-selected');
      if (collidingIds.has(item.id)) el.classList.add('tv-colliding');
      el.style.width = `${wPx}px`;
      el.style.height = `${dPx}px`;
      el.style.left = `${xPx}px`;
      el.style.top = `${yPx}px`;
      el.style.position = 'absolute';
      el.style.boxSizing = 'border-box';
      el.style.cursor = 'move';
      el.style.userSelect = 'none';

      const visual = document.createElement('div');
      visual.className = 'placed-furniture-visual';
      visual.style.width = `${visualWPx}px`;
      visual.style.height = `${visualDPx}px`;
      visual.style.left = '50%';
      visual.style.top = '50%';
      visual.style.position = 'absolute';
      visual.style.transform = `translate(-50%, -50%) rotate(${rotationDegrees(item.rotation)}deg)`;
      visual.style.transformOrigin = 'center';
      visual.style.boxSizing = 'border-box';
      visual.style.pointerEvents = 'none';

      // ponytail: always draw the CAD line-art symbol here (not the product
      // photo) so the floor plan reads as one consistent architectural sketch.
      appendTopviewSymbol(visual, p, topviewKind(p));

      el.appendChild(visual);

      // Delete Button (x) - Large round overlay button with hover effect
      const btnDel = document.createElement('button');
      btnDel.textContent = '×';
      btnDel.setAttribute('data-html2canvas-ignore', 'true');
      btnDel.style.position = 'absolute';
      btnDel.style.top = '-8px';
      btnDel.style.right = '-8px';
      btnDel.style.width = '20px';
      btnDel.style.height = '20px';
      btnDel.style.borderRadius = '50%';
      btnDel.style.background = '#e53e3e';
      btnDel.style.color = '#ffffff';
      btnDel.style.border = '1.5px solid #ffffff';
      btnDel.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      btnDel.style.display = 'flex';
      btnDel.style.alignItems = 'center';
      btnDel.style.justifyContent = 'center';
      btnDel.style.fontSize = '14px';
      btnDel.style.fontWeight = 'bold';
      btnDel.style.cursor = 'pointer';
      btnDel.style.padding = '0 0 2px 0'; // Align vertical center for cross character
      btnDel.style.lineHeight = '1';
      btnDel.style.transition = 'transform 0.1s ease, background-color 0.1s ease';
      btnDel.addEventListener('mouseenter', () => {
        btnDel.style.transform = 'scale(1.15)';
        btnDel.style.backgroundColor = '#c53030';
      });
      btnDel.addEventListener('mouseleave', () => {
        btnDel.style.transform = 'scale(1.0)';
        btnDel.style.backgroundColor = '#e53e3e';
      });
      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFurniture(item.id);
      });
      el.appendChild(btnDel);

      // Rotate handle: click = 45°, drag around center = snap to 8 directions
      const btnRot = document.createElement('button');
      btnRot.textContent = '↺';
      btnRot.setAttribute('data-html2canvas-ignore', 'true');
      btnRot.style.position = 'absolute';
      btnRot.style.bottom = '-8px';
      btnRot.style.right = '-8px';
      btnRot.style.width = '20px';
      btnRot.style.height = '20px';
      btnRot.style.borderRadius = '50%';
      btnRot.style.background = '#2b6cb0';
      btnRot.style.color = '#ffffff';
      btnRot.style.border = '1.5px solid #ffffff';
      btnRot.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      btnRot.style.display = 'flex';
      btnRot.style.alignItems = 'center';
      btnRot.style.justifyContent = 'center';
      btnRot.style.fontSize = '12px';
      btnRot.style.fontWeight = 'bold';
      btnRot.style.cursor = 'pointer';
      btnRot.style.padding = '0';
      btnRot.style.lineHeight = '1';
      btnRot.style.transition = 'transform 0.1s ease, background-color 0.1s ease';
      btnRot.addEventListener('mouseenter', () => {
        btnRot.style.transform = 'scale(1.15)';
        btnRot.style.backgroundColor = '#2b528a';
      });
      btnRot.addEventListener('mouseleave', () => {
        btnRot.style.transform = 'scale(1.0)';
        btnRot.style.backgroundColor = '#2b6cb0';
      });
      btnRot.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        startRotate(item, e);
      });
      el.appendChild(btnRot);

      // Select + drag to reposition logic
      el.addEventListener('mousedown', (e) => {
        if (e.target === btnDel || e.target === btnRot) return;
        if (spaceHeld || e.button === 1) return; // Let the pan handler take over
        e.preventDefault();
        selectItem(item.id);
        isDragging = true;
        dragMoved = false;
        dragSnapshot = snapshot();
        dragTarget = item;
        dragEl = el;
        const rect = board.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left - xPx;
        dragOffset.y = e.clientY - rect.top - yPx;
      });

      board.appendChild(el);
    });

    scaleShell.appendChild(board);
    renderDimensionLine(scaleShell, 'x', areaSpec.width, boardLeft, 0, canvasW, DIM_TOP);
    renderDimensionLine(scaleShell, 'y', areaSpec.depth, boardLeft + canvasW + LABEL_RIGHT, boardTop, DIM_RIGHT, canvasH);
    wrap.appendChild(scaleShell);
    wrap.scrollLeft = prevScrollLeft;
    wrap.scrollTop = prevScrollTop;

    if (measureMode) attachMeasureLayer();
    updateInspector();
  }

  /** Render one CAD-style dimension line (extension lines + tick ends + centered length) */
  function renderDimensionLine(shell, axis, lengthCm, boxLeft, boxTop, boxWidth, boxHeight) {
    const dim = document.createElement('div');
    dim.className = `tv-dim tv-dim-${axis}`;
    dim.style.left = `${boxLeft}px`;
    dim.style.top = `${boxTop}px`;
    dim.style.width = `${boxWidth}px`;
    dim.style.height = `${boxHeight}px`;

    const extA = document.createElement('div');
    extA.className = 'tv-dim-ext ext-a';
    dim.appendChild(extA);

    const extB = document.createElement('div');
    extB.className = 'tv-dim-ext ext-b';
    dim.appendChild(extB);

    const line = document.createElement('div');
    line.className = 'tv-dim-line';
    dim.appendChild(line);

    const tickA = document.createElement('div');
    tickA.className = 'tv-dim-tick tick-a';
    dim.appendChild(tickA);

    const tickB = document.createElement('div');
    tickB.className = 'tv-dim-tick tick-b';
    dim.appendChild(tickB);

    const label = document.createElement('div');
    label.className = 'tv-dim-label';
    label.textContent = `${Math.round(lengthCm)}`;
    dim.appendChild(label);

    shell.appendChild(dim);
  }

  /** Find guide-snap targets (edges/centers of other items + room) near the dragged footprint */
  function computeGuideSnap(xCm, yCm, w, d, tol) {
    const vLines = [0, areaSpec.width / 2, areaSpec.width];
    const hLines = [0, areaSpec.depth / 2, areaSpec.depth];
    placedItems.forEach((it) => {
      if (it === dragTarget) return;
      const p = products.find((q) => q.id === it.productId);
      if (!p) return;
      const f = itemFootprint(it, p);
      vLines.push(it.x, it.x + f.w / 2, it.x + f.w);
      hLines.push(it.y, it.y + f.d / 2, it.y + f.d);
    });

    const best = { x: null, y: null, vLine: null, hLine: null, vDist: tol, hDist: tol };
    // Dragged item's own anchors: leading edge, center, trailing edge
    [[0, xCm], [w / 2, xCm + w / 2], [w, xCm + w]].forEach(([off, edge]) => {
      vLines.forEach((line) => {
        const dist = Math.abs(edge - line);
        if (dist < best.vDist) { best.vDist = dist; best.x = line - off; best.vLine = line; }
      });
    });
    [[0, yCm], [d / 2, yCm + d / 2], [d, yCm + d]].forEach(([off, edge]) => {
      hLines.forEach((line) => {
        const dist = Math.abs(edge - line);
        if (dist < best.hDist) { best.hDist = dist; best.y = line - off; best.hLine = line; }
      });
    });
    return best;
  }

  /** Show/hide inference guide lines on the board */
  function updateGuides(board, sn) {
    let v = board.querySelector('.tv-guide-v');
    if (!v) {
      v = document.createElement('div');
      v.className = 'tv-guide-v';
      board.appendChild(v);
    }
    let h = board.querySelector('.tv-guide-h');
    if (!h) {
      h = document.createElement('div');
      h.className = 'tv-guide-h';
      board.appendChild(h);
    }

    if (sn && sn.vLine !== null) {
      v.style.left = `${Math.round(sn.vLine * pxPerCm)}px`;
      v.style.display = 'block';
    } else {
      v.style.display = 'none';
    }
    if (sn && sn.hLine !== null) {
      h.style.top = `${Math.round(sn.hLine * pxPerCm)}px`;
      h.style.display = 'block';
    } else {
      h.style.display = 'none';
    }
  }

  function startRotate(item, e) {
    selectItem(item.id);
    const p = products.find((q) => q.id === item.productId);
    const wrap = $('topviewWrap');
    const board = wrap ? wrap.querySelector('.room-board') : null;
    if (!p || !board) return;

    const f = itemFootprint(item, p);
    const rect = board.getBoundingClientRect();
    const cx = (item.x + f.w / 2) * pxPerCm;
    const cy = (item.y + f.d / 2) * pxPerCm;
    isRotating = true;
    rotateTarget = item;
    rotateSnapshot = snapshot();
    rotateMoved = false;
    rotateStart = {
      angle: Math.atan2(e.clientY - rect.top - cy, e.clientX - rect.left - cx) * 180 / Math.PI,
      rotation: rotationDegrees(item.rotation)
    };
  }

  function updateRotationFromPointer(e) {
    if (!rotateTarget || !rotateStart) return;
    const p = products.find((q) => q.id === rotateTarget.productId);
    const wrap = $('topviewWrap');
    const board = wrap ? wrap.querySelector('.room-board') : null;
    if (!p || !board) return;

    const f = itemFootprint(rotateTarget, p);
    const rect = board.getBoundingClientRect();
    const cx = (rotateTarget.x + f.w / 2) * pxPerCm;
    const cy = (rotateTarget.y + f.d / 2) * pxPerCm;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const next = rotateStart.rotation + (Math.atan2(py - cy, px - cx) * 180 / Math.PI) - rotateStart.angle;

    if (Math.abs(rotationDegrees(next) - rotationDegrees(rotateTarget.rotation)) > 0.2) {
      setItemRotation(rotateTarget, p, next, false);
      rotateMoved = true;
      drawRoom();
    }
  }

  /** Handle pan and item-drag mouse movement */
  function handleDrag(e) {
    if (isRotating) {
      updateRotationFromPointer(e);
      return;
    }

    if (isPanning) {
      const wrap = $('topviewWrap');
      if (wrap) {
        wrap.scrollLeft = panStart.sl - (e.clientX - panStart.x);
        wrap.scrollTop = panStart.st - (e.clientY - panStart.y);
        if (Math.abs(e.clientX - panStart.x) + Math.abs(e.clientY - panStart.y) > 4) justPanned = true;
      }
      return;
    }

    if (!isDragging || !dragTarget) return;

    const wrap = $('topviewWrap');
    const board = wrap.querySelector('.room-board');
    if (!board) return;

    const rect = board.getBoundingClientRect();

    // Pointer position in cm
    let xCm = (e.clientX - rect.left - dragOffset.x) / pxPerCm;
    let yCm = (e.clientY - rect.top - dragOffset.y) / pxPerCm;

    // Get item dimensions
    const p = products.find((q) => q.id === dragTarget.productId);
    if (!p) return;
    const { w, d } = itemFootprint(dragTarget, p);

    // Inference snap to other items' edges/centers wins; otherwise grid snap
    const tol = 8 / pxPerCm; // ~8 screen px in cm
    const sn = computeGuideSnap(xCm, yCm, w, d, tol);
    const snap = areaSpec.gridSize;
    xCm = (sn.x !== null) ? sn.x : Math.round(xCm / snap) * snap;
    yCm = (sn.y !== null) ? sn.y : Math.round(yCm / snap) * snap;

    // Clamp inside room
    xCm = clamp(xCm, 0, areaSpec.width - w);
    yCm = clamp(yCm, 0, areaSpec.depth - d);

    // Update data + move only the dragged element (no full board rebuild)
    if (dragTarget.x !== xCm || dragTarget.y !== yCm) {
      dragTarget.x = xCm;
      dragTarget.y = yCm;
      dragMoved = true;
      if (dragEl) {
        dragEl.style.left = `${Math.round(xCm * pxPerCm)}px`;
        dragEl.style.top = `${Math.round(yCm * pxPerCm)}px`;
      }

      // Live collision feedback while dragging
      const collidingIds = findCollidingIds();
      board.querySelectorAll('.placed-furniture').forEach((n) => {
        n.classList.toggle('tv-colliding', collidingIds.has(n.dataset.itemId));
      });
    }
    updateGuides(board, sn);
  }

  /** End dragging item / panning */
  function endDrag(e) {
    if (isPanning) {
      isPanning = false;
      const wrap = $('topviewWrap');
      if (wrap) wrap.style.cursor = spaceHeld ? 'grab' : '';
    }

    if (isRotating) {
      const target = rotateTarget;
      isRotating = false;
      rotateTarget = null;
      if (target && !rotateMoved) {
        rotateFurniture(target.id, rotateSnapshot);
      } else if (target && rotateMoved) {
        pushHistory(rotateSnapshot);
        saveState();
        refresh3D();
      }
      rotateSnapshot = null;
      rotateMoved = false;
      rotateStart = null;
      drawRoom();
      return;
    }

    if (isDragging) {
      isDragging = false;
      if (dragMoved && dragSnapshot) pushHistory(dragSnapshot);
      dragSnapshot = null;
      dragMoved = false;
      dragTarget = null;
      dragEl = null;
      saveState();

      // Full redraw resyncs guides, collision marks and the meta warning
      drawRoom();
      refresh3D();
    }
  }

  /** Delete a placed item */
  function removeFurniture(id) {
    pushHistory();
    placedItems = placedItems.filter((x) => x.id !== id);
    if (selectedItemId === id) selectedItemId = null;
    saveState();
    drawRoom();
    showToast('ลบสิ่งของแล้ว');

    if (window.Planogram3D && Planogram3D.isOpen()) {
      Planogram3D.refresh();
    }
  }

  /** Rotate item by one 45-degree step */
  function rotateFurniture(id, historySnap) {
    const item = placedItems.find((x) => x.id === id);
    if (item) {
      const p = products.find((q) => q.id === item.productId);
      if (!p) return;

      pushHistory(historySnap);
      setItemRotation(item, p, item.rotation + 45);
      saveState();
      drawRoom();
      refresh3D();
    }
  }

  /** Apply pre-defined room template with layout furniture items */
  function applyRoomTemplate() {
    const select = $('roomTemplateSelect');
    if (!select) return;

    const val = select.value;
    injectPresets(); // Make sure presets exist

    const fShelf = products.find(p => p.name.includes('Fixture Shelf'));
    const fTable = products.find(p => p.name.includes('Office Table'));
    const fChair = products.find(p => p.name.includes('Office Chair'));
    const fBed = products.find(p => p.name.includes('Comfort Bed'));
    const fNeviDesk = products.find(p => p.topviewAsset === 'nevi-desk' && p.name.includes('1200'))
      || products.find(p => p.name.includes('Herman Miller Nevi Desk 1200'))
      || products.find(p => p.name.includes('Herman Miller Nevi Desk'));
    const fSaylChair = products.find(p => p.topviewAsset === 'sayl-chair')
      || products.find(p => p.name.includes('Herman Miller Sayl Chair'));
    const officeTable = fNeviDesk || fTable;
    const officeChair = fSaylChair || fChair;

    if (!fShelf || !officeTable || !officeChair || !fBed) {
      showToast('ไม่พบข้อมูลสินค้าเฟอร์นิเจอร์หลักสำหรับเทมเพลต');
      return;
    }

    pushHistory();
    selectedItemId = null;

    if (val === 'showroom') {
      areaSpec = { width: 1000, depth: 600, gridSize: 20 };
      placedItems = [
        { id: 't_t_1', productId: fShelf.id, x: 200, y: 0, rotation: 0 },
        { id: 't_t_2', productId: fShelf.id, x: 300, y: 0, rotation: 0 },
        { id: 't_t_3', productId: fShelf.id, x: 400, y: 0, rotation: 0 },
        { id: 't_t_4', productId: fShelf.id, x: 500, y: 0, rotation: 0 },
        { id: 't_t_5', productId: fShelf.id, x: 600, y: 0, rotation: 0 },
        { id: 't_t_6', productId: fShelf.id, x: 300, y: 300, rotation: 0 },
        { id: 't_t_7', productId: fShelf.id, x: 400, y: 300, rotation: 0 },
        { id: 't_t_8', productId: fShelf.id, x: 500, y: 300, rotation: 0 }
      ];
    } else if (val === 'bedroom') {
      areaSpec = { width: 600, depth: 400, gridSize: 20 };
      placedItems = [
        { id: 't_b_1', productId: fBed.id, x: 40, y: 40, rotation: 0 },
        { id: 't_b_2', productId: fTable.id, x: 440, y: 40, rotation: 0 },
        { id: 't_b_3', productId: fChair.id, x: 470, y: 120, rotation: 180 },
        { id: 't_b_4', productId: fShelf.id, x: 440, y: 340, rotation: 0 }
      ];
    } else if (val === 'office') {
      areaSpec = { width: 600, depth: 500, gridSize: 20 };
      placedItems = [
        { id: 't_o_1', productId: officeTable.id, x: 240, y: 160, rotation: 0 },
        { id: 't_o_2', productId: officeChair.id, x: 270, y: 80, rotation: 0 },
        { id: 't_o_3', productId: officeTable.id, x: 240, y: 260, rotation: 180 },
        { id: 't_o_4', productId: officeChair.id, x: 270, y: 360, rotation: 180 },
        { id: 't_o_5', productId: fShelf.id, x: 0, y: 40, rotation: 90 },
        { id: 't_o_6', productId: fShelf.id, x: 0, y: 140, rotation: 90 },
        { id: 't_o_7', productId: fShelf.id, x: 500, y: 40, rotation: 270 },
        { id: 't_o_8', productId: fShelf.id, x: 500, y: 140, rotation: 270 }
      ];
    }

    const wInput = $('roomWidth');
    const dInput = $('roomDepth');
    const gInput = $('roomGridSize');

    if (wInput) wInput.value = areaSpec.width;
    if (dInput) dInput.value = areaSpec.depth;
    if (gInput) gInput.value = areaSpec.gridSize;

    saveState();
    drawRoom();
    showToast(`ใช้เทมเพลตห้อง ${select.options[select.selectedIndex].text} แล้ว`);

    if (window.Planogram3D && Planogram3D.isOpen()) {
      Planogram3D.refresh();
    }
  }

  /** Zoom control functions. cursor = {clientX, clientY} keeps that point stationary. */
  function adjustZoom(delta, cursor) {
    const oldScale = zoomScale;
    zoomScale = clamp(zoomScale + delta, 0.4, 3.0);
    if (zoomScale === oldScale) return;

    // Record the cm-coordinate under the cursor before rescaling
    const wrap = $('topviewWrap');
    const board = wrap ? wrap.querySelector('.room-board') : null;
    let anchor = null;
    if (cursor && board) {
      const rect = board.getBoundingClientRect();
      anchor = {
        cmX: (cursor.clientX - rect.left) / pxPerCm,
        cmY: (cursor.clientY - rect.top) / pxPerCm,
        clientX: cursor.clientX,
        clientY: cursor.clientY
      };
    }

    const zoomText = $('zoomPercent');
    if (zoomText) zoomText.textContent = Math.round(zoomScale * 100) + '%';
    drawRoom();

    // Scroll so the anchored cm-point stays under the cursor
    if (anchor && wrap) {
      const newBoard = wrap.querySelector('.room-board');
      if (newBoard) {
        const nRect = newBoard.getBoundingClientRect();
        wrap.scrollLeft += (nRect.left + anchor.cmX * pxPerCm) - anchor.clientX;
        wrap.scrollTop += (nRect.top + anchor.cmY * pxPerCm) - anchor.clientY;
      }
    }
  }

  function resetZoom() {
    zoomScale = 1.0;
    const zoomText = $('zoomPercent');
    if (zoomText) zoomText.textContent = '100%';
    drawRoom();
  }

  /** Handle item dropped onto topview canvas */
  function handleDrop(e) {
    e.preventDefault();
    const productId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
    if (!productId) return;

    const board = $('topviewWrap').querySelector('.room-board');
    if (!board) return;
    const rect = board.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
    const ids = selectedProducts.has(productId) ? [...selectedProducts] : [productId];
    placeProducts(ids, (e.clientX - rect.left) / pxPerCm, (e.clientY - rect.top) / pxPerCm);
  }

  function exportTopviewPNG() {
    const wrap = $('topviewWrap');
    const target = wrap ? wrap.querySelector('.room-scale-shell') : null;
    if (!target) {
      showToast('ยังไม่มีแปลนสำหรับ Export');
      return;
    }

    showToast('กำลัง export Top View...');
    if (window.html2canvas) {
      doExportTopview(target);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => doExportTopview(target);
    script.onerror = () => showToast('โหลดตัว export ไม่สำเร็จ');
    document.head.appendChild(script);
  }

  function doExportTopview(target) {
    const name = `topview_${areaSpec.width}x${areaSpec.depth}`;
    const width = target.scrollWidth || target.offsetWidth;
    const height = target.scrollHeight || target.offsetHeight;

    html2canvas(target, {
      scale: 2,
      backgroundColor: '#f5f4f1',
      useCORS: true,
      allowTaint: false,
      width,
      height,
      windowWidth: Math.max(document.documentElement.clientWidth, width + 40),
      windowHeight: Math.max(document.documentElement.clientHeight, height + 40),
      scrollX: 0,
      scrollY: 0,
    })
      .then((canvas) => {
        const link = document.createElement('a');
        link.download = `${name}_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('Export Top View สำเร็จ');
      })
      .catch(() => {
        showToast('Export Top View ไม่สำเร็จ');
      });
  }

  /** Save state to localStorage */
  function saveState() {
    try {
      localStorage.setItem('topview_area_spec', JSON.stringify(areaSpec));
      localStorage.setItem('topview_placed_items', JSON.stringify(placedItems));
    } catch (e) {
      // Ignore quota error
    }
  }

  /** Load state from localStorage */
  function loadState() {
    try {
      const rawSpec = localStorage.getItem('topview_area_spec');
      if (rawSpec) areaSpec = JSON.parse(rawSpec);

      const rawPlaced = localStorage.getItem('topview_placed_items');
      if (rawPlaced) placedItems = JSON.parse(rawPlaced);
    } catch (e) {
      // Ignore error
    }
  }

  // Bind init on document load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose to window for 3D engine / export script access
  window.TopViewLayout = {
    toggleProduct,
    clearProductSelection,
    selectedProducts,
    getSpec: () => areaSpec,
    getPlacedItems: () => placedItems,
    isActive: () => activeTab === 'topview',
    drawRoom: drawRoom,
    exportPNG: exportTopviewPNG,
    undo: undoTopview,
    redo: redoTopview
  };
})();
