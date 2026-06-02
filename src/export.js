/* ═══════════════════════════════════════════════════════
   export.js — PNG export & JSON import/export
   ═══════════════════════════════════════════════════════ */

/**
 * Export the planogram board as a PNG image
 */
function exportPNG() {
  showToast('กำลัง export...');
  if (window.html2canvas) {
    doExport();
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  script.onload = doExport;
  script.onerror = () => showToast('โหลดตัว export ไม่สำเร็จ');
  document.head.appendChild(script);
}

function doExport() {
  const area = $('exportArea');
  html2canvas(area, {
    scale: 2,
    backgroundColor: '#f5f4f1',
    useCORS: true,
    allowTaint: true,
  }).then((canvas) => {
    const link = document.createElement('a');
    const name = (spec.name || 'planogram').replace(/\s+/g, '_');
    link.download = `${name}_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Export PNG สำเร็จ');
  }).catch(() => {
    showToast('Export ไม่สำเร็จ');
  });
}

/**
 * Export planogram state as JSON
 */
function exportJSON() {
  const data = {
    planogram: spec,
    products: products,
    placements: shelfData,
    exportedAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  const name = (spec.name || 'planogram').replace(/\s+/g, '_');
  link.download = `${name}_data.json`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Export JSON สำเร็จ');
}

/**
 * Import planogram state from JSON file
 */
function importJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      if (data.planogram) {
        const s = data.planogram;
        $('planogramName').value = s.name || '';
        $('numSegments').value = s.segments || 3;
        $('shelvesPerSegment').value = s.shelves || 6;
        $('overallWidth').value = s.width || 360;
        $('overallHeight').value = s.height || 220;
        $('shelfDepth').value = s.depth || 48;
        $('gapSize').value = s.gap || 28;
        $('shelfThickness').value = s.shelfThickness || 3;
        $('backColor').value = s.backColor || '#3a3a3a';
        $('shelfColor').value = s.shelfColor || '#f4f4f0';
        $('hasBackPanel').checked = s.hasBackPanel !== false;
        $('hasSidePanel').checked = s.hasSidePanel !== false;
        $('hasSegmentDivider').checked = s.hasDivider !== false;

        // Carry custom shelf board positions into the rebuild
        pendingShelfHeights = Array.isArray(s.shelfHeights) ? s.shelfHeights : null;
      }

      if (data.products) {
        products = data.products;
        applyProductLibraryFilter();
      }

      // Build shelf first
      buildShelf();

      // Restore placements
      if (data.placements) {
        shelfData = normalizePlacements(data.placements);
        renderShelfFill();
        updateSummary();
      }

      renderProductList();
      updateLegend();
      showToast('Import สำเร็จ');
    } catch (err) {
      showToast('ไฟล์ JSON ไม่ถูกต้อง');
      console.error('Import error:', err);
    }
  };
  reader.readAsText(file);
}

/**
 * Save state to localStorage
 */
function saveState() {
  try {
    const data = {
      planogram: spec,
      products: products,
      placements: shelfData,
    };
    localStorage.setItem('planogram_studio_state', JSON.stringify(data));
  } catch (e) {
    // localStorage might be full — silently fail
  }
}

/**
 * Load state from localStorage
 */
function loadState() {
  try {
    const raw = localStorage.getItem('planogram_studio_state');
    if (!raw) return false;
    const data = JSON.parse(raw);

    if (data.planogram && data.planogram.segments) {
      const s = data.planogram;
      $('planogramName').value = s.name || '';
      $('numSegments').value = s.segments || 3;
      $('shelvesPerSegment').value = s.shelves || 6;
      $('overallWidth').value = s.width || 360;
      $('overallHeight').value = s.height || 220;
      $('shelfDepth').value = s.depth || 48;
      $('gapSize').value = s.gap || 28;
      $('shelfThickness').value = s.shelfThickness || 3;
      $('backColor').value = s.backColor || '#3a3a3a';
      $('shelfColor').value = s.shelfColor || '#f4f4f0';
      $('hasBackPanel').checked = s.hasBackPanel !== false;
      $('hasSidePanel').checked = s.hasSidePanel !== false;
      $('hasSegmentDivider').checked = s.hasDivider !== false;

      // Restore custom shelf board positions for the next buildShelf
      pendingShelfHeights = Array.isArray(s.shelfHeights) ? s.shelfHeights : null;

      if (data.products) {
        products = data.products;
        applyProductLibraryFilter();
      }

      buildShelf();

      if (data.placements) {
        shelfData = normalizePlacements(data.placements);
        renderShelfFill();
      }

      renderProductList();
      updateLegend();
      updateSummary();
      return true;
    }
  } catch (e) {
    // Corrupted state — ignore
  }
  return false;
}

/**
 * Convert legacy slot-based placements into the current shelf-array format.
 */
function normalizePlacements(placements) {
  const normalized = {};
  Object.entries(placements || {}).forEach(([key, value]) => {
    const parts = key.split('-');
    const shelfKey = parts.length >= 3 ? `${parts[0]}-${parts[1]}` : key;
    const values = Array.isArray(value) ? value : [value];
    if (!normalized[shelfKey]) normalized[shelfKey] = [];
    normalized[shelfKey].push(...values.filter(Boolean));
  });
  return normalized;
}
