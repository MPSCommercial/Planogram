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

  // Inline remote product images as data URLs first — html2canvas drops
  // cross-origin images whose host doesn't send CORS headers.
  const urls = [...new Set(
    Array.from(area.querySelectorAll('img'))
      .map((img) => img.getAttribute('src'))
      .filter((src) => src && !src.startsWith('data:'))
  )];

  Promise.all(urls.map((src) => imageToDataURL(src).then((data) => [src, data])))
    .then((pairs) => {
      const inlined = new Map(pairs.filter(([, data]) => data));
      return html2canvas(area, {
        scale: 2,
        backgroundColor: '#f5f4f1',
        useCORS: true,
        allowTaint: true,
        onclone: (doc) => {
          doc.querySelectorAll('#exportArea img').forEach((img) => {
            const data = inlined.get(img.getAttribute('src'));
            if (data) img.src = data;
          });
        },
      });
    })
    .then((canvas) => {
      const link = document.createElement('a');
      const name = (spec.name || 'planogram').replace(/\s+/g, '_');
      link.download = `${name}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Export PNG สำเร็จ');
    })
    .catch(() => {
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
        pendingSegmentShelfHeights = Array.isArray(s.segmentShelfHeights) ? s.segmentShelfHeights : null;

        if (typeof renderSegmentWidthInputs === 'function') {
          renderSegmentWidthInputs(s.segmentWidths);
        }
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
      pendingSegmentShelfHeights = Array.isArray(s.segmentShelfHeights) ? s.segmentShelfHeights : null;

      if (typeof renderSegmentWidthInputs === 'function') {
        renderSegmentWidthInputs(s.segmentWidths);
      }

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

/* ═══════════════════ PLANOGRAM REPORT LOGIC ═══════════════════ */
let activeReportTab = 'BOM';

function openReportModal() {
  const modal = $('reportModal');
  if (modal) {
    modal.classList.add('open');
    activeReportTab = 'BOM';
    const tabBOM = $('btnTabBOM');
    const tabPlac = $('btnTabPlacements');
    if (tabBOM) tabBOM.classList.add('active');
    if (tabPlac) tabPlac.classList.remove('active');
    updateReportTable();
  }
}

function closeReportModal() {
  const modal = $('reportModal');
  if (modal) modal.classList.remove('open');
}

function updateReportTable() {
  const tableHeader = $('reportTableHeader');
  const tableBody = $('reportTableBody');
  if (!tableHeader || !tableBody) return;

  // 1. Gather all unique products placed on shelves
  let placedProductsList = []; // Array of { product, segment, shelf, totalQty }
  let totalSKUsMap = new Map(); // productId -> { product, placementsCount, totalFacing, totalQty }
  let totalQty = 0;
  let totalSpaceUsedCm = 0;

  Object.entries(shelfData || {}).forEach(([key, productIds]) => {
    const [segIdx, shelfIdx] = key.split('-').map(Number);
    if (!Array.isArray(productIds)) return;

    productIds.forEach((pid) => {
      const product = products.find(p => p.id === pid);
      if (!product) return;

      const pFacing = Math.max(1, parseInt(product.facing) || 1);
      const pStack = Math.max(1, parseInt(product.stack) || 1);
      const dims = getProductDimensions(product, spec.depth || 48);
      const itemWidth = dims.width;
      const itemQty = pFacing * pStack;
      
      totalQty += itemQty;
      totalSpaceUsedCm += (itemWidth * pFacing);

      placedProductsList.push({
        product,
        segment: segIdx + 1,
        shelf: shelfIdx + 1,
        facing: pFacing,
        stack: pStack,
        qty: itemQty
      });

      if (!totalSKUsMap.has(pid)) {
        totalSKUsMap.set(pid, {
          product,
          placementsCount: 0,
          totalFacing: 0,
          totalQty: 0
        });
      }
      const agg = totalSKUsMap.get(pid);
      agg.placementsCount += 1;
      agg.totalFacing += pFacing;
      agg.totalQty += itemQty;
    });
  });

  // Update Stats UI
  $('reportTotalSKUs').textContent = totalSKUsMap.size;
  $('reportTotalQty').textContent = totalQty;
  $('reportSpaceUtil').textContent = `${Math.round(totalSpaceUsedCm)} cm`;

  // Render Table depending on active tab
  tableHeader.innerHTML = '';
  tableBody.innerHTML = '';

  if (activeReportTab === 'BOM') {
    // BOM Summary Headers
    tableHeader.innerHTML = `
      <th style="padding: 12px; text-align: center; width: 60px;">No.</th>
      <th style="padding: 12px; width: 80px; text-align: center;">รูปภาพ</th>
      <th style="padding: 12px; width: 120px;">แบรนด์</th>
      <th style="padding: 12px;">ชื่อสินค้า / SKU ID</th>
      <th style="padding: 12px; width: 180px;">Category</th>
      <th style="padding: 12px; text-align: center; width: 100px;">จำนวนจุดวาง</th>
      <th style="padding: 12px; text-align: center; width: 100px;">Facing รวม</th>
      <th style="padding: 12px; text-align: center; width: 100px;">จำนวนรวม (ชิ้น)</th>
    `;

    if (totalSKUsMap.size === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: var(--muted);">ไม่มีสินค้าจัดวางอยู่บนชั้นวางในขณะนี้</td></tr>`;
      return;
    }

    let no = 1;
    totalSKUsMap.forEach((agg) => {
      const p = agg.product;
      const imgHtml = p.image 
        ? `<img src="${p.image}" class="report-img" alt="${p.name}">` 
        : `<div class="report-img" style="background:${p.color || '#ccc'}; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; color: #fff; font-weight: 700;">No Pic</div>`;
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="text-align: center; font-weight: 600;">${no++}</td>
        <td style="text-align: center;">${imgHtml}</td>
        <td style="font-weight: 500; color: var(--ink);">${escapeHtml(p.brand || '-')}</td>
        <td>
          <div style="font-weight: 600; color: var(--ink);">${escapeHtml(p.name)}</div>
          <div style="font-size: 0.72rem; color: var(--muted); font-family: var(--font-mono); margin-top: 2px;">ID: ${p.id}</div>
        </td>
        <td><span class="badge" style="background: var(--surface-2); color: var(--ink); font-weight: 500;">${escapeHtml(p.category)}</span></td>
        <td style="text-align: center; font-weight: 600; color: var(--ink);">${agg.placementsCount}</td>
        <td style="text-align: center; font-weight: 600; color: var(--ink);">${agg.totalFacing}</td>
        <td style="text-align: center; font-weight: 700; color: var(--accent); font-size: 0.9rem;">${agg.totalQty}</td>
      `;
      tableBody.appendChild(row);
    });
  } else {
    // Placement Details Headers
    tableHeader.innerHTML = `
      <th style="padding: 12px; text-align: center; width: 60px;">No.</th>
      <th style="padding: 12px; width: 80px; text-align: center;">รูปภาพ</th>
      <th style="padding: 12px; width: 140px;">ตำแหน่ง</th>
      <th style="padding: 12px;">ชื่อสินค้า / SKU ID</th>
      <th style="padding: 12px; width: 160px;">Category</th>
      <th style="padding: 12px; text-align: center; width: 90px;">Facing</th>
      <th style="padding: 12px; text-align: center; width: 90px;">Stack</th>
      <th style="padding: 12px; text-align: center; width: 100px;">จำนวนรวม (ชิ้น)</th>
    `;

    if (placedProductsList.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: var(--muted);">ไม่มีสินค้าจัดวางอยู่บนชั้นวางในขณะนี้</td></tr>`;
      return;
    }

    // Sort by Segment, then by Shelf (top down)
    placedProductsList.sort((a, b) => {
      if (a.segment !== b.segment) return a.segment - b.segment;
      return b.shelf - a.shelf;
    });

    placedProductsList.forEach((item, idx) => {
      const p = item.product;
      const imgHtml = p.image 
        ? `<img src="${p.image}" class="report-img" alt="${p.name}">` 
        : `<div class="report-img" style="background:${p.color || '#ccc'}; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; color: #fff; font-weight: 700;">No Pic</div>`;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="text-align: center; font-weight: 600;">${idx + 1}</td>
        <td style="text-align: center;">${imgHtml}</td>
        <td style="font-weight: 600; color: var(--ink);">
          <div style="font-size: 0.8rem;">ตู้ (Bay) ${item.segment}</div>
          <div style="font-size: 0.72rem; color: var(--muted); margin-top: 2px;">ชั้นวาง ${item.shelf}</div>
        </td>
        <td>
          <div style="font-weight: 600; color: var(--ink);">${escapeHtml(p.name)}</div>
          <div style="font-size: 0.72rem; color: var(--muted); font-family: var(--font-mono); margin-top: 2px;">ID: ${p.id}</div>
        </td>
        <td><span class="badge" style="background: var(--surface-2); color: var(--ink); font-weight: 500;">${escapeHtml(p.category)}</span></td>
        <td style="text-align: center; font-weight: 600; color: var(--ink);">${item.facing}</td>
        <td style="text-align: center; font-weight: 600; color: var(--ink);">${item.stack}</td>
        <td style="text-align: center; font-weight: 700; color: var(--accent); font-size: 0.9rem;">${item.qty}</td>
      `;
      tableBody.appendChild(row);
    });
  }
}

function exportReportCSV() {
  let csvContent = "";
  const name = (spec.name || 'planogram').replace(/\s+/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  let fileName = "";

  if (activeReportTab === 'BOM') {
    fileName = `${name}_BOM_Report_${dateStr}.csv`;
    csvContent += "No.,Brand,Product Name/SKU,Category,Placements Count,Total Facing,Total Quantity\n";

    let no = 1;
    let totalSKUsMap = new Map();
    Object.entries(shelfData || {}).forEach(([key, productIds]) => {
      if (!Array.isArray(productIds)) return;
      productIds.forEach((pid) => {
        const product = products.find(p => p.id === pid);
        if (!product) return;
        const pFacing = Math.max(1, parseInt(product.facing) || 1);
        const pStack = Math.max(1, parseInt(product.stack) || 1);
        const itemQty = pFacing * pStack;

        if (!totalSKUsMap.has(pid)) {
          totalSKUsMap.set(pid, { product, placementsCount: 0, totalFacing: 0, totalQty: 0 });
        }
        const agg = totalSKUsMap.get(pid);
        agg.placementsCount += 1;
        agg.totalFacing += pFacing;
        agg.totalQty += itemQty;
      });
    });

    totalSKUsMap.forEach((agg) => {
      const p = agg.product;
      const brand = csvEscape(p.brand || '');
      const nameStr = csvEscape(p.name || '');
      const cat = csvEscape(p.category || '');
      csvContent += `${no++},${brand},${nameStr},${cat},${agg.placementsCount},${agg.totalFacing},${agg.totalQty}\n`;
    });
  } else {
    fileName = `${name}_Placements_Report_${dateStr}.csv`;
    csvContent += "No.,Location,Product Name/SKU,Category,Facing,Stack,Total Quantity\n";

    let placedProductsList = [];
    Object.entries(shelfData || {}).forEach(([key, productIds]) => {
      const [segIdx, shelfIdx] = key.split('-').map(Number);
      if (!Array.isArray(productIds)) return;

      productIds.forEach((pid) => {
        const product = products.find(p => p.id === pid);
        if (!product) return;

        const pFacing = Math.max(1, parseInt(product.facing) || 1);
        const pStack = Math.max(1, parseInt(product.stack) || 1);
        const itemQty = pFacing * pStack;

        placedProductsList.push({
          product,
          location: `Bay ${segIdx + 1} - Shelf ${shelfIdx + 1}`,
          segment: segIdx + 1,
          shelf: shelfIdx + 1,
          facing: pFacing,
          stack: pStack,
          qty: itemQty
        });
      });
    });

    placedProductsList.sort((a, b) => {
      if (a.segment !== b.segment) return a.segment - b.segment;
      return b.shelf - a.shelf;
    });

    placedProductsList.forEach((item, idx) => {
      const p = item.product;
      const loc = csvEscape(item.location);
      const nameStr = csvEscape(p.name || '');
      const cat = csvEscape(p.category || '');
      csvContent += `${idx + 1},${loc},${nameStr},${cat},${item.facing},${item.stack},${item.qty}\n`;
    });
  }

  // Use UTF-8 BOM (\uFEFF) to make Thai characters display correctly in MS Excel
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.download = fileName;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Export CSV สำเร็จ');
}

function csvEscape(text) {
  if (!text) return '';
  const str = String(text);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
