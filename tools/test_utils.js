// Checks for the shelf-geometry helpers in src/utils.js. Run: node tools/test_utils.js
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const ctx = { window: {}, console, document: { getElementById: () => null } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(`${__dirname}/../src/utils.js`, 'utf8'), ctx);
const depthRows = vm.runInContext('depthRows', ctx);

// 9cm deep box on a 48cm shelf: five fit, and all five are used by default
const box = { width: '12.5', height: '8', depth: '9' };
assert.deepEqual(depthRows(box, 48).max, 5);
assert.equal(depthRows(box, 48).used, 5, 'default should still fill the shelf depth');

// the user's own number wins, but never beyond what fits
assert.equal(depthRows({ ...box, rows: 2 }, 48).used, 2);
assert.equal(depthRows({ ...box, rows: 99 }, 48).used, 5, 'not clamped to the shelf depth');
assert.equal(depthRows({ ...box, rows: 0 }, 48).used, 5, 'zero should fall back to the max');
assert.equal(depthRows({ ...box, rows: 'x' }, 48).used, 5, 'garbage should fall back to the max');
assert.equal(depthRows({ ...box, rows: -3 }, 48).used, 5);

// turning the box on its side changes which measurement runs into the shelf
const onSide = { ...box, orientation: 'side' };
assert.equal(depthRows(onSide, 48).max, 3, 'side view should be 12.5cm deep, so three fit');
assert.equal(depthRows({ ...onSide, rows: 5 }, 48).used, 3, 'stale row count must re-clamp');

// a product deeper than the shelf still places one
assert.equal(depthRows({ width: '40', height: '40', depth: '60' }, 48).max, 1);

console.log('utils.js checks ok');
