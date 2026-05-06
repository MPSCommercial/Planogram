/* ═══════════════════════════════════════════════════════
   app.js — Application initialization & event bindings
   ═══════════════════════════════════════════════════════ */

(function init() {
  // ─── Button bindings ───
  $('btnBuildShelf').addEventListener('click', buildShelf);
  $('btnAddProduct').addEventListener('click', addProduct);
  $('btnExportPNG').addEventListener('click', exportPNG);
  $('btnExportJSON').addEventListener('click', exportJSON);
  $('btnLoadDemo').addEventListener('click', loadDemo);
  $('btnClearAll').addEventListener('click', clearAll);
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
        // Scroll to product library section
        $('sectionLibrary').scrollIntoView({ behavior: 'smooth' });
      } else {
        // Scroll to top of canvas
        $('stage').scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  // ─── Load saved state or build default ───
  const hasState = loadState();
  if (!hasState) {
    renderProductList();
    buildShelf();
  }
})();
