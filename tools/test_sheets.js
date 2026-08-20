// Checks for the pure sheet helpers. Run: node tools/test_sheets.js
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const ctx = {
  window: {}, console,
  $: () => null,
  clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
  products: [], shelfData: {}, selectedProductId: null,
  renderProductList() {}, renderShelfFill() {}, updateLegend() {}, updateSummary() {},
  saveState() {}, showToast(m) { ctx.toast = m; }, pruneMissingPlacements() {},
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(`${__dirname}/../src/sheets.js`, 'utf8'), ctx);
const get = (name) => vm.runInContext(name, ctx);

// ── share links have to become something <img> can load ──
const drive = 'https://drive.google.com/thumbnail?id=1AbC_defGH12345678&sz=w1000';
const normalize = get('normalizeImageUrl');
assert.equal(normalize('https://drive.google.com/file/d/1AbC_defGH12345678/view?usp=sharing'), drive);
assert.equal(normalize('https://drive.google.com/open?id=1AbC_defGH12345678'), drive);
assert.equal(normalize('https://drive.google.com/uc?export=view&id=1AbC_defGH12345678'), drive);
assert.equal(normalize('https://cdn.example.com/a.png'), 'https://cdn.example.com/a.png');
assert.equal(normalize('assets/products/A10018.png'), 'assets/products/A10018.png');
assert.equal(normalize(''), '');

// ── a sheet row keeps its link, and only real sizes overwrite a saved board ──
const row = {
  ODOO: 'A10018', 'Product Name': 'ERGO MOUSE 01', Category: 'Accessories',
  'Image URL': 'https://drive.google.com/file/d/1AbC_defGH12345678/view',
  Width_cm: '12.5', Height_cm: '8', Depth_cm: '9', Price: '1,290',
};
const mapped = get('mapSheetRowToProduct')(row);
assert.equal(mapped.image, drive, 'sheet link not normalised on import');
assert.equal(mapped.price, 1290, 'price column not read (thousands separator?)');

get('rememberSheetValues')([mapped]);
const board = [
  { id: 'A10018', odoo: 'A10018', width: '99', height: '99', depth: '99' },
  { id: 'p_local', width: '11', height: '22', depth: '33' },
];
assert.equal(get('applySheetValues')(board), 1);
assert.deepEqual([board[0].width, board[0].height, board[0].depth], ['12.5', '8', '9']);
assert.equal(board[0].price, 1290, 'price not carried onto the saved board');
assert.equal(board[1].width, '11', 'hand-added product was touched');
assert.equal(get('applySheetValues')(board), 0, 'not idempotent');

// ── a blank cell must not wipe a size that is already there ──
get('rememberSheetValues')([get('mapSheetRowToProduct')({ ...row, Width_cm: '', Height_cm: '', Depth_cm: '', Price: '' })]);
get('applySheetValues')(board);
assert.equal(board[0].width, '12.5', 'blank sheet cell wiped an existing size');
assert.equal(board[0].price, 1290, 'blank price cell wiped an existing price');

console.log('sheets.js checks ok');
