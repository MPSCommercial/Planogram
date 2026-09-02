// Self-check for depth-layer column helpers (src/utils.js). Run: node test/columns.test.js
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');
const ctx = { console, products: [
  { id: 'a', width: '10', height: '20', depth: '10', facing: 2, rows: 2 },
  { id: 'b', width: '30', height: '20', depth: '20', facing: 1 },
] };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('src/utils.js', 'utf8'), ctx);
const eq = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b)); // vm realm: no shared Array proto
const { colIds, flatPlacements, packCol, pruneColumns, colMetrics, depthLayers, stackIds } = ctx;

eq(colIds('a'), ['a']);
eq(colIds(['a', 'b']), ['a', 'b']);
eq(flatPlacements(['a', ['b', 'a']]), ['a', 'b', 'a']);
assert.strictEqual(packCol([]), null);
assert.strictEqual(packCol(['a']), 'a');
eq(packCol(['a', 'b']), ['a', 'b']);
eq(packCol([['a', 'b']]), [['a', 'b']]); // a lone stacked layer stays a stack, not two depth layers
// deleting 'b' collapses the layered column back to a plain id; the b-only column disappears
eq(pruneColumns(['a', ['a', 'b'], 'b'], (id) => id !== 'b'), ['a', 'a']);
// width = widest layer (b: 30 > a: 10×2), depth = a rows(2×10) + b(20) = 40 → fits 48, overflows 30
const m = colMetrics(['a', 'b'], 48);
eq({ width: m.width, depth: m.depth, over: m.over }, { width: 30, depth: 40, over: false });
assert.strictEqual(colMetrics(['a', 'b'], 30).over, true);

// vertical stacks: [[bottom, top], back]
const two = [['a', 'b'], 'a'];
eq(depthLayers(two), [['a', 'b'], 'a']);
eq(stackIds(two[0]), ['a', 'b']);
eq(colIds(two), ['a', 'b', 'a']);
// removing 'b' collapses the stack back to a plain id
eq(pruneColumns([two], (id) => id !== 'b'), [['a', 'a']]);
// front layer depth = max(a: 20, b: 20) = 20, back a: 20 → 40; height = front a(20)+b(20) = 40
const s2 = colMetrics(two, 48);
eq({ width: s2.width, depth: s2.depth, height: s2.height }, { width: 30, depth: 40, height: 40 });
console.log('columns ok');
