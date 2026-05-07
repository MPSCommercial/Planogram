/* ═══════════════════════════════════════════════════════
   app.js — Application initialization & event bindings
   ═══════════════════════════════════════════════════════ */

(function init() {
  restorePanelState();

  // ─── Button bindings ───
  $('btnBuildShelf').addEventListener('click', buildShelf);
  $('btnAddProduct').addEventListener('click', addProduct);
  $('btnExportPNG').addEventListener('click', exportPNG);
  $('btnExportJSON').addEventListener('click', exportJSON);
  $('btnLoadDemo').addEventListener('click', loadDemo);
  $('btnClearAll').addEventListener('click', clearAll);
  $('btnSyncSheet').addEventListener('click', syncProductsFromSheet);
  $('btnRemoveImage').addEventListener('click', (e) => removeUploadedImage(e));
  $('imgInput').addEventListener('change', handleImageUpload);

  // ─── Edit modal bindings ───
  $('btnSaveEdit').addEventListener('click', saveEditProduct);
  $('btnCancelEdit').addEventListener('click', closeEditModal);
  $('btnCloseModal').addEventListener('click', closeEditModal);
  $('editImgInput').addEventListener('change', handleEditImageUpload);
  $('btnEditRemoveImage').addEventListener('click', (e) => removeEditImage(e));

  // Close modal on overlay click
  $('editModal').addEventListener('click', (e) => {
    if (e.target === $('editModal')) closeEditModal();
  });

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('editModal').classList.contains('open')) {
      closeEditModal();
    }
  });

  // ─── Import JSON ───
  $('btnImportJSON').addEventListener('click', () => {
    $('jsonImportInput').click();
  });

  $('jsonImportInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importJSON(file);
    e.target.value = '';
  });

  // ─── Product search ───
  $('productSearch').addEventListener('input', () => {
    renderProductList();
  });

  // ─── Section collapse toggles ───
  document.querySelectorAll('.section-header[data-collapse]').forEach((header) => {
    header.addEventListener('click', () => {
      header.classList.toggle('collapsed');
    });
  });

  // ─── Tab navigation ───
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach((t) => t.setAttribute('aria-selected', 'false'));
      tab.setAttribute('aria-selected', 'true');

      const target = tab.dataset.tab;
      if (target === 'library') {
        setPanelCollapsed('right', false);
        $('rightPanel').scrollTo({ top: $('sectionLibrary').offsetTop, behavior: 'smooth' });
      } else {
        $('stage').scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  // ─── Load saved state or build default ───
  const hasState = loadState();
  if (!hasState) {
    renderProductList();
    buildShelf();
    syncProductsFromSheet();
  }
})();

function restorePanelState() {
  try {
    const raw = localStorage.getItem('planogram_panel_state');
    if (!raw) return;
    const state = JSON.parse(raw);
    setPanelCollapsed('left', !!state.leftCollapsed, false);
    setPanelCollapsed('right', !!state.rightCollapsed, false);
  } catch (e) {
    // Ignore corrupted panel preferences.
  }
}

function togglePanel(side) {
  const className = `${side}-panel-collapsed`;
  setPanelCollapsed(side, !document.body.classList.contains(className));
}

function setPanelCollapsed(side, collapsed, persist = true) {
  const className = `${side}-panel-collapsed`;
  const button = side === 'left' ? $('btnToggleLeftPanel') : $('btnToggleRightPanel');

  document.body.classList.toggle(className, collapsed);
  if (button) button.setAttribute('aria-expanded', String(!collapsed));

  if (!persist) return;
  try {
    localStorage.setItem('planogram_panel_state', JSON.stringify({
      leftCollapsed: document.body.classList.contains('left-panel-collapsed'),
      rightCollapsed: document.body.classList.contains('right-panel-collapsed'),
    }));
  } catch (e) {
    // localStorage might be unavailable.
  }
}
