/* ═══════════════════════════════════════════════════════
   app.js — Application initialization & event bindings
   ═══════════════════════════════════════════════════════ */

(function init() {
  requestAnimationFrame(() => document.body.classList.add('app-ready'));
  restorePanelState();

  // ─── Button bindings ───
  $('btnBuildShelf').addEventListener('click', buildShelf);

  // ─── Auto-update shelf layout on style & toggle option changes ───
  ['hasSidePanel', 'hasBackPanel', 'hasSegmentDivider', 'backColor', 'shelfColor'].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener('change', buildShelf);
  });

  // ─── Segment Custom Width bindings ───
  if ($('btnToggleCustomSeg')) {
    $('btnToggleCustomSeg').addEventListener('click', () => {
      const panel = $('customSegmentPanel');
      const isHidden = panel.style.display === 'none';
      panel.style.display = isHidden ? 'block' : 'none';
    });
  }

  $('numSegments').addEventListener('change', () => {
    renderSegmentWidthInputs();
    buildShelf();
  });
  $('overallWidth').addEventListener('change', () => {
    renderSegmentWidthInputs();
    buildShelf();
  });

  // ─── Shelf template bindings ───
  renderTemplateOptions();
  $('btnApplyTemplate').addEventListener('click', applySelectedTemplate);
  $('btnExportTemplate').addEventListener('click', exportSelectedTemplatePNG);
  $('btnSaveTemplate').addEventListener('click', saveCurrentAsTemplate);
  $('btnDeleteTemplate').addEventListener('click', deleteSelectedTemplate);
  $('templateSelect').addEventListener('change', () => renderTemplateOptions($('templateSelect').value));

  // ─── Branch bindings ───
  renderBranchOptions();
  $('btnSwitchBranch').addEventListener('click', switchToSelectedBranch);
  $('btnSaveBranch').addEventListener('click', saveCurrentAsBranch);
  $('btnDeleteBranch').addEventListener('click', deleteSelectedBranch);
  $('branchSelect').addEventListener('change', () => renderBranchOptions($('branchSelect').value));

  $('btnAddProduct').addEventListener('click', addProduct);
  $('btnExportPNG').addEventListener('click', () => {
    if (window.TopViewLayout && TopViewLayout.isActive()) TopViewLayout.exportPNG();
    else exportPNG();
  });
  $('btnExportJSON').addEventListener('click', exportJSON);
  $('btnLoadDemo').addEventListener('click', loadDemo);
  $('btnClearAll').addEventListener('click', clearAll);
  $('btnSyncSheet').addEventListener('click', syncProductsFromSheet);

  // ─── Report Modal bindings ───
  $('btnShowReport').addEventListener('click', openReportModal);
  $('btnCloseReportModal').addEventListener('click', closeReportModal);
  $('btnCancelReport').addEventListener('click', closeReportModal);
  $('btnExportReportCSV').addEventListener('click', exportReportCSV);

  $('btnTabBOM').addEventListener('click', () => {
    activeReportTab = 'BOM';
    $('btnTabBOM').classList.add('active');
    $('btnTabPlacements').classList.remove('active');
    updateReportTable();
  });

  $('btnTabPlacements').addEventListener('click', () => {
    activeReportTab = 'Placements';
    $('btnTabBOM').classList.remove('active');
    $('btnTabPlacements').classList.add('active');
    updateReportTable();
  });
  // Undo/Redo route to topview stacks when Top View tab is active
  $('btnUndo').addEventListener('click', () => {
    if (window.TopViewLayout && TopViewLayout.isActive()) TopViewLayout.undo();
    else undo();
  });
  $('btnRedo').addEventListener('click', () => {
    if (window.TopViewLayout && TopViewLayout.isActive()) TopViewLayout.redo();
    else redo();
  });
  $('btnRemoveImage').addEventListener('click', (e) => removeUploadedImage(e));
  $('imgInput').addEventListener('change', handleImageUpload);
  
  // ─── SketchUp-style 3D view toggle binding ───
  $('btnToggle3D').addEventListener('click', () => {
    const btn = $('btnToggle3D');
    if (!window.Planogram3D) { showToast('3D engine ยังโหลดไม่เสร็จ'); return; }
    if (Planogram3D.isOpen()) {
      Planogram3D.close();
      btn.classList.remove('active');
      showToast('กลับสู่มุมมอง 2D');
    } else {
      Planogram3D.open();
      btn.classList.add('active');
      showToast('มุมมอง 3D (SketchUp)');
    }
  });

  // ─── Mini Inspector bindings ───
  $('btnInspectDec').addEventListener('click', () => adjustInspectFacing(-1));
  $('btnInspectInc').addEventListener('click', () => adjustInspectFacing(1));
  $('btnInspectRowsDec').addEventListener('click', () => adjustInspectRows(-1));
  $('btnInspectRowsInc').addEventListener('click', () => adjustInspectRows(1));
  $('btnInspectStackDec').addEventListener('click', () => adjustInspectStack(-1));
  $('btnInspectStackInc').addEventListener('click', () => adjustInspectStack(1));
  $('btnInspectDel').addEventListener('click', deleteInspectPlacement);
  $('inspectorOrientation').addEventListener('change', (e) => changeInspectOrientation(e.target.value));
  $('btnInspectRotate').addEventListener('click', rotateInspect90);

  // ─── Google Sheet Toggle Settings drawer ───
  $('btnToggleSyncSettings').addEventListener('click', () => {
    const settings = $('sheetSyncSettings');
    const isHidden = settings.style.display === 'none';
    settings.style.display = isHidden ? 'block' : 'none';
  });

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

  $('reportModal').addEventListener('click', (e) => {
    if (e.target === $('reportModal')) closeReportModal();
  });

  // Close modal on Escape; undo/redo; panel toggle shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if ($('editModal').classList.contains('open')) {
        closeEditModal();
        return;
      }
      if ($('reportModal').classList.contains('open')) {
        closeReportModal();
        return;
      }
      if ($('miniInspector').style.display !== 'none') {
        closeMiniInspector();
        return;
      }
    }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    const mod = e.ctrlKey || e.metaKey;
    const topviewActive = window.TopViewLayout && TopViewLayout.isActive();
    if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); topviewActive ? TopViewLayout.undo() : undo(); }
    if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); topviewActive ? TopViewLayout.redo() : redo(); }
    if (e.key === '[' && !mod) { e.preventDefault(); togglePanel('left'); }
    if (e.key === ']' && !mod) { e.preventDefault(); togglePanel('right'); }
    if (e.key === '\\' && !mod) { e.preventDefault(); togglePanel('left'); togglePanel('right'); }
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

  // ─── Product search & category filter ───
  $('productSearch').addEventListener('input', () => {
    renderProductList();
  });

  $('categoryFilter').addEventListener('change', (e) => {
    activeCategoryFilter = e.target.value;
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

  // ─── Click outside inspector to close ───
  document.addEventListener('click', (e) => {
    const mini = $('miniInspector');
    if (mini && mini.style.display !== 'none') {
      if (!mini.contains(e.target) && !e.target.closest('.shelf-product')) {
        closeMiniInspector();
      }
    }
  });

  // ─── Load saved state or build default ───
  const hasState = loadState();
  if (hasState) {
    refreshDimensionsFromSheet();
  } else {
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
