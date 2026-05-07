/* ═══════════════════════════════════════════════════════
   sheets.js — Google Sheet product database sync
   ═══════════════════════════════════════════════════════ */

const PRODUCT_SHEET_ID = '1l8pkJUaXIhwTsKJzHP9AW5MLMYKjXNo7ApcIcOyNUqE';
const PRODUCT_SHEET_GID = '0';
const PRODUCT_SHEET_URL = `https://docs.google.com/spreadsheets/d/${PRODUCT_SHEET_ID}/gviz/tq?gid=${PRODUCT_SHEET_GID}&headers=1&tqx=out:json`;
const PRODUCT_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${PRODUCT_SHEET_ID}/export?format=csv&gid=${PRODUCT_SHEET_GID}`;
const PRODUCT_CATEGORY_FILTER = 'Accessories';

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
      const importedProducts = rows
        .map(mapSheetRowToProduct)
        .filter(Boolean)
        .filter(isAllowedProductCategory);

      if (!importedProducts.length) {
        throw new Error('No products found in sheet');
      }

      products = importedProducts;
      selectedProductId = products[0].id;
      pruneMissingPlacements();
      renderProductList();
      renderShelfFill();
      updateLegend();
      updateSummary();
      saveState();

      const missingImages = products.filter((product) => !product.image).length;
      setSheetSyncState('ok', `Synced ${products.length} Accessories SKU · missing image ${missingImages}`);
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
    return fetch(PRODUCT_SHEET_CSV_URL, { cache: 'no-store' })
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

    script.src = `${PRODUCT_SHEET_URL};responseHandler:${callbackName}`;
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

function applyProductLibraryFilter() {
  const before = products.length;
  products = products.filter(isAllowedProductCategory);
  if (products.length !== before) pruneMissingPlacements();
  if (selectedProductId && !products.some((product) => product.id === selectedProductId)) {
    selectedProductId = products[0] ? products[0].id : null;
  }
}

function isAllowedProductCategory(product) {
  return cleanCell(product.category).toLowerCase() === PRODUCT_CATEGORY_FILTER.toLowerCase();
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
