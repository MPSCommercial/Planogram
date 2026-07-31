/* ═══════════════════════════════════════════════════════
   salesData.js — Fetch branch sales figures from the MDT
   Dashboard's public Supabase data file (same file, no new
   backend). Small hand-rolled parser — not a port of MDT's
   full dataParser.js, only what a branch drill-down needs.
   ═══════════════════════════════════════════════════════ */

const SALES_XLSX_URL = 'https://ornwcpzmaouumjmkpdbz.supabase.co/storage/v1/object/public/mdt-data/MT_database_channel.xlsx';

// Channel → column map, mirrors MDT Dashboard's data/README_data_format.md contract.
const SALES_CHANNEL_CONFIGS = [
  { sheet: 'sb', branch: 'ชื่อสาขา', product: 'Description', qty: 'Order quantity', amount: 'Subtotal 1', yearCol: 'Year', monthCol: 'Month' },
  { sheet: 'homepro', branch: 'SHIPPOINT', product: 'ARTICLE DESC.', qty: 'Billing QTY.', amount: 'Billing AMT.', dateCol: 'BILLING_DATE' },
  { sheet: 'ofm', branch: 'Store ID Name', product: 'Product Detail Name', qty: 'Sales Quantity', amount: 'Net Sales Exc VAT', yearCol: 'Year', monthCol: 'Month Number', headerRow: 4, pid: 'PID', excludePidPrefix: 'Y' },
  { sheet: 'ofm', branch: 'Store ID Name', product: 'Product Detail Name', qty: 'Sales Quantity', amount: 'Net Sales Exc VAT', yearCol: 'Year', monthCol: 'Month Number', headerRow: 4, pid: 'PID', onlyPidPrefix: 'Y' },
  { sheet: 'cds', branch: 'Store Name', product: 'SKU Name', qty: 'Sales Quantity', amount: 'Total Net Sales (Sales Amount)', dateCol: 'Sales Date', statusField: 'SKU Status', statusMustBe: 'A' },
  { sheet: 'b2s', branch: 'Store ID Name', product: 'Product Detail Name', qty: 'Sales Quantity', amount: 'Net Sales Exc VAT', yearCol: 'Year', monthCol: 'Month Number', headerRow: 4, pid: 'PID' },
  { sheet: 'betrend_New', branch: 'KU', product: 'Material - Text', qty: 'Qty', amount: 'Gross Sales', yearCol: 'Year', monthCol: 'Month', branchLookupSheet: 'betrend_store', branchLookupKeyCol: 'Store Code', branchLookupValCol: 'สาขา' },
  { sheet: 'twd', branch: 'Storename', product: 'ProductName', qty: 'RevenueQuant', amount: 'Sale Amount', dateCol: 'RevenueDate' },
  { sheet: 'pwb', branch: 'STORENAME', product: 'PRODUCTNAME', qty: 'SALEMONTHQTY', amount: 'SALEMONTHAMOUNT', dateCol: 'TDATE' },
  { sheet: 'scg', branch: 'Location', product: 'Item Name', qty: 'Quantity', amount: 'Net Income (Incl. Discount)', dateCol: 'Sales Order Date' },
];

let _salesWorkbookPromise = null;

/**
 * Fetch + parse the shared sales workbook once, cache the promise for the session.
 */
function fetchSalesWorkbook() {
  if (_salesWorkbookPromise) return _salesWorkbookPromise;
  _salesWorkbookPromise = fetch(SALES_XLSX_URL, { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.arrayBuffer();
    })
    .then((buf) => XLSX.read(buf, { type: 'array', cellDates: true }));
  return _salesWorkbookPromise;
}

function _sheetRows(wb, sheetName, headerRow) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const opts = { defval: '' };
  if (headerRow) opts.range = headerRow - 1;
  return XLSX.utils.sheet_to_json(ws, opts);
}

function _buildLookup(wb, sheetName, keyCol, valCol) {
  const map = {};
  _sheetRows(wb, sheetName).forEach((r) => {
    const k = String(r[keyCol] || '').trim();
    if (k) map[k] = String(r[valCol] || '').trim();
  });
  return map;
}

function _normNum(v) {
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function _extractYearMonth(row, cfg) {
  if (cfg.yearCol && cfg.monthCol) {
    return { year: parseInt(row[cfg.yearCol], 10) || 0, month: parseInt(row[cfg.monthCol], 10) || 0 };
  }
  if (cfg.dateCol) {
    const raw = row[cfg.dateCol];
    const d = raw instanceof Date ? raw : new Date(raw);
    if (!isNaN(d.getTime())) return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  return { year: 0, month: 0 };
}

/**
 * Read + normalize one channel's rows: {branch, product, code, qty, amount, year, month}
 */
function _extractChannelRows(wb, cfg) {
  const rows = _sheetRows(wb, cfg.sheet, cfg.headerRow);
  const lookup = cfg.branchLookupSheet
    ? _buildLookup(wb, cfg.branchLookupSheet, cfg.branchLookupKeyCol, cfg.branchLookupValCol)
    : null;

  return rows
    .filter((r) => {
      if (cfg.statusField && String(r[cfg.statusField] || '').trim() !== cfg.statusMustBe) return false;
      const pid = cfg.pid ? String(r[cfg.pid] || '').trim() : '';
      if (cfg.excludePidPrefix && pid.startsWith(cfg.excludePidPrefix)) return false;
      if (cfg.onlyPidPrefix && !pid.startsWith(cfg.onlyPidPrefix)) return false;
      return true;
    })
    .map((r) => {
      let branch = String(r[cfg.branch] || '').trim();
      if (lookup) branch = lookup[branch] || branch;
      const { year, month } = _extractYearMonth(r, cfg);
      return {
        branch,
        product: String(r[cfg.product] || '').trim(),
        code: cfg.pid ? String(r[cfg.pid] || '').trim() : '',
        qty: _normNum(r[cfg.qty]),
        amount: _normNum(r[cfg.amount]),
        year,
        month,
      };
    })
    .filter((r) => r.branch && r.product);
}

/**
 * Aggregate sales for one branch across all channels: monthly totals + product breakdown.
 * Returns a Promise<{ totalQty, totalAmount, monthly: [{year,month,qty,amount}] sorted asc,
 *                       products: [{name, code, qty, amount}] sorted desc by amount }>
 */
function getBranchSales(branchName) {
  return fetchSalesWorkbook().then((wb) => {
    const target = branchName.trim().toLowerCase();
    const byProduct = {};
    const byMonth = {};
    let totalQty = 0;
    let totalAmount = 0;

    SALES_CHANNEL_CONFIGS.forEach((cfg) => {
      _extractChannelRows(wb, cfg).forEach((row) => {
        if (row.branch.toLowerCase() !== target) return;

        totalQty += row.qty;
        totalAmount += row.amount;

        const pKey = row.product;
        if (!byProduct[pKey]) byProduct[pKey] = { name: row.product, code: row.code, qty: 0, amount: 0 };
        byProduct[pKey].qty += row.qty;
        byProduct[pKey].amount += row.amount;
        if (!byProduct[pKey].code && row.code) byProduct[pKey].code = row.code;

        if (row.year && row.month) {
          const mKey = `${row.year}-${String(row.month).padStart(2, '0')}`;
          if (!byMonth[mKey]) byMonth[mKey] = { year: row.year, month: row.month, qty: 0, amount: 0 };
          byMonth[mKey].qty += row.qty;
          byMonth[mKey].amount += row.amount;
        }
      });
    });

    const products = Object.values(byProduct).sort((a, b) => b.amount - a.amount);
    const monthly = Object.values(byMonth).sort((a, b) => (a.year - b.year) || (a.month - b.month));

    return { totalQty, totalAmount, monthly, products };
  });
}

/**
 * Match a sales product to a Planogram board product: SKU code first (product.odoo),
 * fall back to a case-insensitive substring match on name.
 */
function matchSalesProduct(products, salesProduct) {
  if (salesProduct.code) {
    const byCode = products.find((p) => p.odoo && p.odoo.toUpperCase() === salesProduct.code.toUpperCase());
    if (byCode) return byCode;
  }
  const name = (salesProduct.name || '').toLowerCase();
  if (!name) return null;
  return products.find((p) => {
    const pname = (p.name || '').toLowerCase();
    return pname && (pname.includes(name) || name.includes(pname));
  }) || null;
}
