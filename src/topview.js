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

    // Zoom buttons binding
    const btnZoomIn = $('btnZoomIn');
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => adjustZoom(0.1));
    const btnZoomOut = $('btnZoomOut');
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => adjustZoom(-0.1));
    const btnZoomReset = $('btnZoomReset');
    if (btnZoomReset) btnZoomReset.addEventListener('click', () => resetZoom());

    // Set up drag & drop events on topview wrapper
    const wrap = $('topviewWrap');
    if (wrap) {
      wrap.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      wrap.addEventListener('drop', handleDrop);

      // Zoom using mouse wheel + Ctrl/Cmd key
      wrap.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.1 : -0.1;
          adjustZoom(delta);
        }
      }, { passive: false });
    }

    // Hook tab switches from main app.js (we hook topbar navigation)
    hookTabs();

    // Redraw 2D room layout on window resize
    window.addEventListener('resize', () => {
      if (activeTab === 'topview' && (!window.Planogram3D || !Planogram3D.isOpen())) {
        drawRoom();
      }
    });
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

    // 5. Render room
    drawRoom();

    // 6. Refresh 3D if open
    if (window.Planogram3D && Planogram3D.isOpen()) {
      Planogram3D.refresh();
    }
  }

  /** Deactivate topview and restore planogram workspace */
  function deactivateTopview() {
    const pSettings = $('sectionSettings');
    const pTemplates = document.querySelector('.template-block')?.closest('.side-section') || $('sectionTemplates');
    const tSettings = $('sectionTopviewSettings');

    if (pSettings) pSettings.style.display = 'block';
    if (pTemplates) pTemplates.style.display = 'block';
    if (tSettings) tSettings.style.display = 'none';

    const pArea = $('exportArea');
    const tArea = $('topviewArea');

    if (pArea && (!window.Planogram3D || !Planogram3D.isOpen())) pArea.style.display = 'block';
    if (tArea) tArea.style.display = 'none';

    const btnReport = $('btnShowReport');
    const btnClearAll = $('btnClearAll');

    if (btnReport) btnReport.style.display = 'block';
    if (btnClearAll) btnClearAll.style.display = 'block';

    if (window.Planogram3D && Planogram3D.isOpen()) {
      Planogram3D.refresh();
    }
  }

  /** Update Room specifications from inputs */
  function updateRoom() {
    const wInput = $('roomWidth');
    const dInput = $('roomDepth');
    const gInput = $('roomGridSize');

    if (wInput && dInput) {
      areaSpec.width = clamp(parseInt(wInput.value) || 600, 100, 2000);
      areaSpec.depth = clamp(parseInt(dInput.value) || 400, 100, 2000);
      areaSpec.gridSize = clamp(parseInt(gInput.value) || 20, 5, 100);

      wInput.value = areaSpec.width;
      dInput.value = areaSpec.depth;
      gInput.value = areaSpec.gridSize;

      saveState();
      drawRoom();
      showToast('อัปเดตขนาดห้องแล้ว');

      if (window.Planogram3D && Planogram3D.isOpen()) {
        Planogram3D.refresh();
      }
    }
  }

  /** Clear all placed items inside the room */
  function clearRoom() {
    if (confirm('คุณต้องการลบสิ่งของทั้งหมดออกจากพื้นที่ห้องใช่หรือไม่?')) {
      placedItems = [];
      saveState();
      drawRoom();
      showToast('ล้างห้องเรียบร้อย');

      if (window.Planogram3D && Planogram3D.isOpen()) {
        Planogram3D.refresh();
      }
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

    // Create Floor Board
    const board = document.createElement('div');
    board.className = 'room-board';
    board.style.width = `${canvasW}px`;
    board.style.height = `${canvasH}px`;
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

      // Outline edge effect
      el.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,0.15), 0 3px 6px rgba(0,0,0,0.08)';

      // Label
      const title = document.createElement('div');
      title.textContent = shortName(p.name);
      title.style.fontSize = '9px';
      title.style.fontWeight = 'bold';
      title.style.color = contrast(p.color || '#cccccc');
      title.style.textAlign = 'center';
      title.style.pointerEvents = 'none';
      el.appendChild(title);

      const sizeInfo = document.createElement('div');
      sizeInfo.textContent = `${origW}x${origD} cm (${item.rotation}°)`;
      sizeInfo.style.fontSize = '8px';
      sizeInfo.style.color = contrast(p.color || '#cccccc');
      sizeInfo.style.opacity = '0.78';
      sizeInfo.style.marginTop = '2px';
      sizeInfo.style.pointerEvents = 'none';
      el.appendChild(sizeInfo);

      // Delete Button (x)
      const btnDel = document.createElement('button');
      btnDel.textContent = '×';
      btnDel.style.position = 'absolute';
      btnDel.style.top = '1px';
      btnDel.style.right = '3px';
      btnDel.style.background = 'none';
      btnDel.style.border = 'none';
      btnDel.style.color = contrast(p.color || '#cccccc');
      btnDel.style.fontWeight = 'bold';
      btnDel.style.fontSize = '12px';
      btnDel.style.cursor = 'pointer';
      btnDel.style.padding = '0';
      btnDel.style.lineHeight = '1';
      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFurniture(item.id);
      });
      el.appendChild(btnDel);

      // Rotate Button (↺)
      const btnRot = document.createElement('button');
      btnRot.textContent = '↺';
      btnRot.style.position = 'absolute';
      btnRot.style.bottom = '1px';
      btnRot.style.right = '3px';
      btnRot.style.background = 'none';
      btnRot.style.border = 'none';
      btnRot.style.color = contrast(p.color || '#cccccc');
      btnRot.style.fontSize = '10px';
      btnRot.style.cursor = 'pointer';
      btnRot.style.padding = '0';
      btnRot.style.lineHeight = '1';
      btnRot.addEventListener('click', (e) => {
        e.stopPropagation();
        rotateFurniture(item.id);
      });
      el.appendChild(btnRot);

      // Drag to reposition logic
      el.addEventListener('mousedown', (e) => {
        if (e.target === btnDel || e.target === btnRot) return;
        e.preventDefault();
        isDragging = true;
        dragTarget = item;
        const rect = board.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left - xPx;
        dragOffset.y = e.clientY - rect.top - yPx;
      });

      board.appendChild(el);
    });

    // Handle global mouse events for dragging inside canvas
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', endDrag);

    wrap.appendChild(board);
  }

  /** Reposition furniture item on drag */
  function handleDrag(e) {
    if (!isDragging || !dragTarget) return;

    const wrap = $('topviewWrap');
    const board = wrap.querySelector('.room-board');
    if (!board) return;

    const rect = board.getBoundingClientRect();
    
    // Relative coordinates in pixels
    let xPx = e.clientX - rect.left - dragOffset.x;
    let yPx = e.clientY - rect.top - dragOffset.y;

    // Convert to cm
    let xCm = xPx / pxPerCm;
    let yCm = yPx / pxPerCm;

    // Snap to Grid
    const snap = areaSpec.gridSize;
    xCm = Math.round(xCm / snap) * snap;
    yCm = Math.round(yCm / snap) * snap;

    // Get item dimensions
    const p = products.find((q) => q.id === dragTarget.productId);
    if (!p) return;

    const origW = parseCm(p.width, 10);
    const origD = parseCm(p.depth, 10);
    const isRotated = (dragTarget.rotation === 90 || dragTarget.rotation === 270);
    const w = isRotated ? origD : origW;
    const d = isRotated ? origW : origD;

    // Clamp inside room
    xCm = clamp(xCm, 0, areaSpec.width - w);
    yCm = clamp(yCm, 0, areaSpec.depth - d);

    // Update positioned data
    if (dragTarget.x !== xCm || dragTarget.y !== yCm) {
      dragTarget.x = xCm;
      dragTarget.y = yCm;
      drawRoom();
    }
  }

  /** End dragging item */
  function endDrag() {
    if (isDragging) {
      isDragging = false;
      dragTarget = null;
      saveState();

      if (window.Planogram3D && Planogram3D.isOpen()) {
        Planogram3D.refresh();
      }
    }
  }

  /** Delete a placed item */
  function removeFurniture(id) {
    placedItems = placedItems.filter((x) => x.id !== id);
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

      if (window.Planogram3D && Planogram3D.isOpen()) {
        Planogram3D.refresh();
      }
    }
  }

  /** Zoom control functions */
  function adjustZoom(delta) {
    zoomScale = clamp(zoomScale + delta, 0.4, 3.0);
    const zoomText = $('zoomPercent');
    if (zoomText) zoomText.textContent = Math.round(zoomScale * 100) + '%';
    drawRoom();
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
    drawRoom: drawRoom
  };
})();
