/* ═══════════════════════════════════════════════════════
   topview.js — 2D Floor Plan / Space Planning Layout Editor
   Handles Room/Area layouts for placing Fixtures, Tables,
   Chairs, Beds, and other furniture in Top-down view.
   ═══════════════════════════════════════════════════════ */

(function () {
  let areaSpec = { width: 600, depth: 400, gridSize: 20 };
  let placedItems = []; // Array of { id, productId, x, y, rotation }
  let pxPerCm = 0.8;    // Scale: pixels per cm, calculated on draw
  let zoomScale = 1.0;  // Zoom multiplier for 2D room board
  let isDragging = false;
  let dragTarget = null;
  let dragOffset = { x: 0, y: 0 };
  let activeTab = 'planogram'; // 'planogram' | 'topview' | 'library'
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

  // Pre-configured furniture/fixture items
  const FURNITURE_PRESETS = [
    { name: 'Fixture Shelf (ชั้นวาง)', cat: 'Fixtures', brand: 'Generic', color: '#b9bec5', w: 100, h: 180, d: 45 },
    { name: 'Office Table (โต๊ะทำงาน)', cat: 'Furniture', brand: 'Generic', color: '#a05a2c', w: 120, h: 75, d: 60 },
    { name: 'Office Chair (เก้าอี้)', cat: 'Furniture', brand: 'Generic', color: '#1a1a1a', w: 60, h: 90, d: 60 },
    { name: 'Comfort Bed (เตียงนอน)', cat: 'Furniture', brand: 'Generic', color: '#3182ce', w: 150, h: 45, d: 200 }
  ];

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

    // Room Layout Template apply binding
    const btnApplyRoomTemplate = $('btnApplyRoomTemplate');
    if (btnApplyRoomTemplate) btnApplyRoomTemplate.addEventListener('click', applyRoomTemplate);

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
    const isRotated = (item.rotation === 90 || item.rotation === 270);
    return { w: isRotated ? origD : origW, d: isRotated ? origW : origD };
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
    if (rotSelect) rotSelect.value = String(item.rotation);
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

    const rot = parseInt($('tvItemRot').value) || 0;
    if (rot === item.rotation) return;

    pushHistory();
    item.rotation = rot;
    const { w, d } = itemFootprint(item, p);
    item.x = clamp(item.x, 0, areaSpec.width - w);
    item.y = clamp(item.y, 0, areaSpec.depth - d);
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

    if (!selectedItemId) return;

    const mod = e.ctrlKey || e.metaKey;
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
          image: null
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

    wrap.innerHTML = '';
    updateRoomStats();

    const topviewMeta = $('topviewMeta');
    if (topviewMeta) {
      topviewMeta.textContent = `${areaSpec.width}w × ${areaSpec.depth}d cm · Grid: ${areaSpec.gridSize} cm · วางแล้ว ${placedItems.length} ชิ้น`;
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

    // Create Floor Board
    const board = document.createElement('div');
    board.className = 'room-board';
    board.style.width = `${canvasW}px`;
    board.style.height = `${canvasH}px`;
    board.style.margin = 'auto';
    board.style.flexShrink = '0';
    board.style.position = 'relative';
    board.style.background = '#fcfcf9';
    board.style.border = '2px solid #20242a';
    board.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)';
    
    // Draw Grid Lines (using CSS background)
    const gridSizePx = areaSpec.gridSize * pxPerCm;
    board.style.backgroundImage = `
      linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)
    `;
    board.style.backgroundSize = `${gridSizePx}px ${gridSizePx}px`;

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

      if (typeof selectedProductId !== 'undefined' && selectedProductId) {
        const p = products.find((q) => q.id === selectedProductId);
        if (!p) return;

        const rect = board.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        let xCm = clickX / pxPerCm;
        let yCm = clickY / pxPerCm;

        // Snap to grid
        const snap = areaSpec.gridSize;
        xCm = Math.round(xCm / snap) * snap;
        yCm = Math.round(yCm / snap) * snap;

        const origW = parseCm(p.width, 10);
        const origD = parseCm(p.depth, 10);

        // Center on clicked coordinate, offset by half width/depth rounded to grid
        xCm = clamp(xCm - Math.round((origW / 2) / snap) * snap, 0, areaSpec.width - origW);
        yCm = clamp(yCm - Math.round((origD / 2) / snap) * snap, 0, areaSpec.depth - origD);

        pushHistory();
        placedItems.push({
          id: 'placed_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
          productId: p.id,
          x: xCm,
          y: yCm,
          rotation: 0
        });

        saveState();
        drawRoom();
        showToast(`วาง ${p.name} บนแปลนแล้ว (คลิกเพื่อวาง)`);

        if (window.Planogram3D && Planogram3D.isOpen()) {
          Planogram3D.refresh();
        }
      } else {
        showToast('กรุณาเลือกสินค้าจากคลังทางขวา เพื่อคลิกวางในแปลน');
      }
    });

    // Render placed furniture/fixtures
    placedItems.forEach((item) => {
      const p = products.find((q) => q.id === item.productId);
      if (!p) return;

      // Original dimensions
      const origW = parseCm(p.width, 10);
      const origD = parseCm(p.depth, 10);

      // Account for rotation (swap width and depth if rotated 90 or 270 degrees)
      const isRotated = (item.rotation === 90 || item.rotation === 270);
      const w = isRotated ? origD : origW;
      const d = isRotated ? origW : origD;

      const wPx = Math.round(w * pxPerCm);
      const dPx = Math.round(d * pxPerCm);
      const xPx = Math.round(item.x * pxPerCm);
      const yPx = Math.round(item.y * pxPerCm);

      // Furniture element
      const el = document.createElement('div');
      el.className = 'placed-furniture';
      el.dataset.itemId = item.id;
      if (item.id === selectedItemId) el.classList.add('tv-selected');
      el.style.width = `${wPx}px`;
      el.style.height = `${dPx}px`;
      el.style.left = `${xPx}px`;
      el.style.top = `${yPx}px`;
      el.style.position = 'absolute';
      el.style.background = p.color || '#cccccc';
      el.style.border = '1.5px solid #20242a';
      el.style.borderRadius = '3px';
      el.style.boxSizing = 'border-box';
      el.style.cursor = 'move';
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.padding = '4px';
      el.style.userSelect = 'none';

      // Render actual image if uploaded
      if (p.image) {
        el.style.backgroundImage = `url(${p.image})`;
        el.style.backgroundSize = 'contain';
        el.style.backgroundPosition = 'center';
        el.style.backgroundRepeat = 'no-repeat';
      }

      // Outline edge effect
      el.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,0.15), 0 3px 6px rgba(0,0,0,0.08)';

      // Label
      const title = document.createElement('div');
      title.textContent = shortName(p.name);
      title.style.fontSize = '9px';
      title.style.fontWeight = 'bold';
      title.style.color = p.image ? '#ffffff' : contrast(p.color || '#cccccc');
      if (p.image) title.style.textShadow = '0 1px 3px rgba(0,0,0,0.8), 0 1px 1px rgba(0,0,0,0.8)';
      title.style.textAlign = 'center';
      title.style.pointerEvents = 'none';
      el.appendChild(title);

      const sizeInfo = document.createElement('div');
      sizeInfo.textContent = `${origW}x${origD} cm (${item.rotation}°)`;
      sizeInfo.style.fontSize = '8px';
      sizeInfo.style.color = p.image ? '#ffffff' : contrast(p.color || '#cccccc');
      if (p.image) sizeInfo.style.textShadow = '0 1px 3px rgba(0,0,0,0.8), 0 1px 1px rgba(0,0,0,0.8)';
      sizeInfo.style.opacity = '0.78';
      sizeInfo.style.marginTop = '2px';
      sizeInfo.style.pointerEvents = 'none';
      el.appendChild(sizeInfo);

      // Delete Button (x) - Large round overlay button with hover effect
      const btnDel = document.createElement('button');
      btnDel.textContent = '×';
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

      // Rotate Button (↺) - Large round overlay button with hover effect
      const btnRot = document.createElement('button');
      btnRot.textContent = '↺';
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
      btnRot.addEventListener('click', (e) => {
        e.stopPropagation();
        rotateFurniture(item.id);
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

    wrap.appendChild(board);
    updateInspector();
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

  /** Handle pan and item-drag mouse movement */
  function handleDrag(e) {
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
    }
    updateGuides(board, sn);
  }

  /** End dragging item / panning */
  function endDrag() {
    if (isPanning) {
      isPanning = false;
      const wrap = $('topviewWrap');
      if (wrap) wrap.style.cursor = spaceHeld ? 'grab' : '';
    }

    if (isDragging) {
      isDragging = false;
      if (dragMoved && dragSnapshot) pushHistory(dragSnapshot);
      dragSnapshot = null;
      dragMoved = false;
      dragTarget = null;
      dragEl = null;
      saveState();

      // Hide guide lines and refresh inspector X/Y readout
      const wrap = $('topviewWrap');
      const board = wrap ? wrap.querySelector('.room-board') : null;
      if (board) updateGuides(board, null);
      updateInspector();

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

  /** Rotate item by 90 degrees */
  function rotateFurniture(id) {
    const item = placedItems.find((x) => x.id === id);
    if (item) {
      pushHistory();
      item.rotation = (item.rotation + 90) % 360;

      // Adjust boundaries after rotation to prevent sticking outside
      const p = products.find((q) => q.id === item.productId);
      if (p) {
        const origW = parseCm(p.width, 10);
        const origD = parseCm(p.depth, 10);
        const isRotated = (item.rotation === 90 || item.rotation === 270);
        const w = isRotated ? origD : origW;
        const d = isRotated ? origW : origD;

        item.x = clamp(item.x, 0, areaSpec.width - w);
        item.y = clamp(item.y, 0, areaSpec.depth - d);
      }

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

    if (!fShelf || !fTable || !fChair || !fBed) {
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
        { id: 't_o_1', productId: fTable.id, x: 240, y: 160, rotation: 0 },
        { id: 't_o_2', productId: fChair.id, x: 270, y: 80, rotation: 0 },
        { id: 't_o_3', productId: fTable.id, x: 240, y: 240, rotation: 180 },
        { id: 't_o_4', productId: fChair.id, x: 270, y: 320, rotation: 180 },
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

    const p = products.find((q) => q.id === productId);
    if (!p) return;

    const wrap = $('topviewWrap');
    const board = wrap.querySelector('.room-board');
    if (!board) return;

    const rect = board.getBoundingClientRect();
    const dropX = e.clientX - rect.left;
    const dropY = e.clientY - rect.top;

    let xCm = dropX / pxPerCm;
    let yCm = dropY / pxPerCm;

    // Snap to grid
    const snap = areaSpec.gridSize;
    xCm = Math.round(xCm / snap) * snap;
    yCm = Math.round(yCm / snap) * snap;

    // Get product dimensions
    const origW = parseCm(p.width, 10);
    const origD = parseCm(p.depth, 10);

    // Clamp position inside room
    xCm = clamp(xCm, 0, areaSpec.width - origW);
    yCm = clamp(yCm, 0, areaSpec.depth - origD);

    // Create placed item
    pushHistory();
    placedItems.push({
      id: 'placed_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      productId: p.id,
      x: xCm,
      y: yCm,
      rotation: 0
    });

    saveState();
    drawRoom();
    showToast(`วาง ${p.name} บนพื้นที่ห้องแล้ว`);

    if (window.Planogram3D && Planogram3D.isOpen()) {
      Planogram3D.refresh();
    }
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
    getSpec: () => areaSpec,
    getPlacedItems: () => placedItems,
    isActive: () => activeTab === 'topview',
    drawRoom: drawRoom,
    undo: undoTopview,
    redo: redoTopview
  };
})();
