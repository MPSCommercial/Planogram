/* ═══════════════════════════════════════════════════════
   sheets.js — Google Sheet product database sync
   ═══════════════════════════════════════════════════════ */

let currentSheetId = '1l8pkJUaXIhwTsKJzHP9AW5MLMYKjXNo7ApcIcOyNUqE';
let currentCategoryFilter = 'Accessories';

function getSheetCsvUrl() {
  const sheetId = $('syncSheetId') ? $('syncSheetId').value.trim() : currentSheetId;
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
}

function getSheetJsonpUrl() {
  const sheetId = $('syncSheetId') ? $('syncSheetId').value.trim() : currentSheetId;
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?gid=0&headers=1&tqx=out:json`;
}

function getCategoryFilter() {
  return $('syncCategory') ? $('syncCategory').value.trim() : currentCategoryFilter;
}

const CATEGORY_COLORS = {
  Accessories: '#0f6b5f',
  'Chair & Sofa': '#6f5b3e',
  'Adjustable Desk': '#2f5f8f',
  Bedding: '#9a5b74',
  Kids: '#c9822b',
};

function syncProductsFromSheet() {
  setSheetSyncState('loading', 'กำลัง sync จาก Google Sheet...');

  loadSheetRows()
    .then((rows) => {
      const sheetProducts = rows.map(mapSheetRowToProduct).filter(Boolean);
      rememberSheetDimensions(sheetProducts);
      const importedProducts = sheetProducts.filter(isAllowedProductCategory);

      if (!importedProducts.length) {
        throw new Error('No products found in sheet');
      }

      products = importedProducts;
      selectedProductId = products[0].id;
      pruneMissingPlacements();
      attachLocalPackShots(products);
      renderProductList();
      renderShelfFill();
      updateLegend();
      updateSummary();
      saveState();

      const missingImages = products.filter((product) => !product.image).length;
      const catFilter = getCategoryFilter();
      setSheetSyncState('ok', `Synced ${products.length} ${catFilter || 'All'} SKU · missing image ${missingImages}`);
      showToast(`Sync สินค้า ${products.length} SKU สำเร็จ`);
    })
    .catch((error) => {
      console.error('Sheet sync error:', error);
      setSheetSyncState('error', 'Sync ไม่สำเร็จ ตรวจสิทธิ์หรือการแชร์ Sheet');
      showToast('Sync Google Sheet ไม่สำเร็จ');
    });
}

function loadSheetRows() {
  if (window.fetch) {
    return fetch(getSheetCsvUrl(), { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`CSV export failed: ${response.status}`);
        return response.text();
      })
      .then(parseCsv)
      .catch((error) => {
        console.warn('CSV sheet sync fallback:', error);
        return loadSheetRowsViaJsonp();
      });
  }

  return loadSheetRowsViaJsonp();
}

function loadSheetRowsViaJsonp() {
  return new Promise((resolve, reject) => {
    const callbackName = `__planogramSheet_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');

    window[callbackName] = (response) => {
      cleanupSheetCallback(callbackName, script);

      if (!response || response.status !== 'ok' || !response.table) {
        reject(new Error(response && response.errors ? response.errors[0].detailed_message : 'Invalid sheet response'));
        return;
      }

      resolve(convertGoogleTable(response.table));
    };

    script.src = `${getSheetJsonpUrl()};responseHandler:${callbackName}`;
    script.async = true;
    script.onerror = () => {
      cleanupSheetCallback(callbackName, script);
      reject(new Error('Google Sheet script failed to load'));
    };
    document.head.appendChild(script);
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = (rows.shift() || []).map(cleanCell);
  return rows
    .filter((values) => values.some((value) => cleanCell(value)))
    .map((values) => {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = cleanCell(values[index]);
      });
      return item;
    });
}

function cleanupSheetCallback(callbackName, script) {
  delete window[callbackName];
  if (script.parentNode) script.parentNode.removeChild(script);
}

function convertGoogleTable(table) {
  const labels = table.cols.map((col, index) => (col.label || `Column ${index + 1}`).trim());
  return table.rows.map((row) => {
    const item = {};
    labels.forEach((label, index) => {
      const cell = row.c[index];
      item[label] = cell ? cleanCell(cell.f || cell.v) : '';
    });
    return item;
  });
}

function mapSheetRowToProduct(row) {
  const odoo = cleanCell(row.ODOO);
  const name = cleanCell(row['Product Name']);
  if (!odoo || !name) return null;

  const category = cleanCell(row.Category) || 'ไม่ระบุ';
  const subCategory = cleanCell(row['Sub Category']);
  const imageUrl = cleanCell(row['Image URL']);
  const facing = clamp(parseInt(cleanCell(row['Facing Default']), 10) || 1, 1, 12);

  return {
    id: odoo,
    odoo,
    name,
    category,
    brand: subCategory,
    subCategory,
    color: CATEGORY_COLORS[category] || colorFromText(category),
    facing,
    width: cleanDimension(row.Width_cm),
    height: cleanDimension(row.Height_cm),
    depth: cleanDimension(row.Depth_cm),
    image: imageUrl || null,
    shelfZone: cleanCell(row['Shelf Zone']),
    status: cleanCell(row.Status),
    source: 'google-sheet',
  };
}

/* ═══ Latest sizes from the sheet, applied over saved boards ═══ */

let sheetDimsById = {};

function rememberSheetDimensions(sheetProducts) {
  sheetDimsById = {};
  sheetProducts.forEach((product) => {
    sheetDimsById[product.id] = { width: product.width, height: product.height, depth: product.depth };
  });
}

/**
 * Overwrite W/H/D of a product list with the latest sheet values (matched by
 * ODOO id). Products not in the sheet — hand-added SKUs — are left alone.
 * Returns how many products changed.
 */
function applySheetDimensions(list) {
  if (!Array.isArray(list)) return 0;
  let changed = 0;
  list.forEach((product) => {
    const dims = sheetDimsById[product.odoo || product.id];
    if (!dims) return;
    // ponytail: blank cells in the sheet keep the existing size instead of wiping it
    const touched = ['width', 'height', 'depth'].filter(
      (key) => dims[key] && String(product[key] || '') !== dims[key]
    );
    touched.forEach((key) => { product[key] = dims[key]; });
    if (touched.length) changed++;
  });
  return changed;
}

/**
 * Pull the sheet in the background and refresh the sizes of the board that was
 * just restored from localStorage / a branch snapshot.
 */
function refreshDimensionsFromSheet() {
  return loadSheetRows()
    .then((rows) => {
      rememberSheetDimensions(rows.map(mapSheetRowToProduct).filter(Boolean));
      const changed = applySheetDimensions(products);

      if (changed) showToast(`อัปเดตขนาดสินค้าใหม่ ${changed} SKU จาก Google Sheet`);
      attachLocalPackShots(products);
      if (!changed) return;

      renderProductList();
      renderShelfFill();
      updateLegend();
      updateSummary();
      saveState();
      if (window.Planogram3D && Planogram3D.isOpen()) Planogram3D.refresh();
    })
    .catch((error) => {
      console.warn('Dimension refresh skipped:', error);
    });
}

/* ═══ Local pack shots: assets/products/<ODOO>[-side|-top].png ═══ */

const PACK_SHOT_DIR = 'assets/products';

/**
 * Products with no Image URL in the sheet fall back to a local pack shot named
 * after the ODOO code. The file is probed first so a missing one keeps the
 * coloured placeholder instead of showing a broken-image icon.
 */
function attachLocalPackShots(list) {
  const pending = (list || [])
    .filter((product) => !product.image && product.odoo)
    .map((product) => {
      const base = `${PACK_SHOT_DIR}/${encodeURIComponent(product.odoo)}`;
      // <ODOO>.png is the front; -side/-top are the other faces of the box,
      // used when the product is laid down on the shelf.
      return Promise.all([
        probeImage(`${base}.png`),
        probeImage(`${base}-side.png`),
        probeImage(`${base}-top.png`),
      ]).then(([front, side, top]) => {
        if (!front && !side && !top) return null;
        product.image = front || side || top;
        product.faces = { front: front, side: side, top: top };
        return product.image;
      });
    });

  if (!pending.length) return Promise.resolve(0);

  return Promise.all(pending).then((results) => {
    const found = results.filter(Boolean).length;
    if (found) {
      renderProductList();
      renderShelfFill();
      saveState();
      if (window.Planogram3D && Planogram3D.isOpen()) Planogram3D.refresh();
    }
    return found;
  });
}

// ponytail: one probe per SKU per sync; if the folder grows past a few hundred
// files, ship a generated manifest.json instead of probing.
function probeImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function applyProductLibraryFilter() {
  const before = products.length;
  products = products.filter(isAllowedProductCategory);
  if (products.length !== before) pruneMissingPlacements();
  if (selectedProductId && !products.some((product) => product.id === selectedProductId)) {
    selectedProductId = products[0] ? products[0].id : null;
  }
}

function isAllowedProductCategory(product) {
  const catFilter = getCategoryFilter();
  if (!catFilter) return true; // ถ้าเว้นว่างไว้ จะอนุญาตทุก category
  return cleanCell(product.category).toLowerCase() === catFilter.toLowerCase();
}

function cleanCell(value) {
  return value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
}

function cleanDimension(value) {
  return cleanCell(value).replace(/\s*[-–]\s*/g, '-');
}

function colorFromText(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index++) {
    hash = text.charCodeAt(index) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 42% 38%)`;
}

function pruneMissingPlacements() {
  const validIds = new Set(products.map((product) => product.id));
  Object.keys(shelfData).forEach((key) => {
    if (Array.isArray(shelfData[key])) {
      shelfData[key] = shelfData[key].filter((productId) => validIds.has(productId));
      if (!shelfData[key].length) delete shelfData[key];
      return;
    }
    if (!validIds.has(shelfData[key])) delete shelfData[key];
  });
}

function setSheetSyncState(state, message) {
  const panel = $('sheetSyncPanel');
  const status = $('sheetSyncStatus');
  const button = $('btnSyncSheet');
  if (!panel || !status || !button) return;

  panel.dataset.state = state;
  status.textContent = message;
  button.disabled = state === 'loading';
  button.textContent = state === 'loading' ? 'Syncing...' : 'Sync Sheet';
}
