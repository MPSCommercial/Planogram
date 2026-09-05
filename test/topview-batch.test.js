// Run: node test/topview-batch.test.js
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync('src/topview.js','utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(source.slice(0,source.indexOf('(function ()')),ctx);
const room={width:300,depth:240,gridSize:20};
const items=[{id:'desk',width:140,depth:80},{id:'chair',width:60,depth:60},{id:'shelf',width:120,depth:45}];
const placed=ctx.layoutTopviewBatch(items,room,290,230);
assert.strictEqual(placed.length,3);
for(let i=0;i<placed.length;i++) {
 const a=placed[i],size=items[i];
 assert(a.x>=0&&a.y>=0&&a.x+size.width<=300&&a.y+size.depth<=240);
 for(let j=0;j<i;j++) {const b=placed[j],bs=items[j];assert(a.x>=b.x+bs.width||b.x>=a.x+size.width||a.y>=b.y+bs.depth||b.y>=a.y+size.depth);}
}
assert.strictEqual(ctx.layoutTopviewBatch([{id:'big',width:301,depth:10}],room,0,0),null);
assert.strictEqual(ctx.layoutTopviewBatch(Array(20).fill(items[0]),room,0,0),null);
assert.strictEqual(ctx.layoutTopviewBatch([{id:'bad',width:NaN,depth:10}],room,0,0),null);
assert.strictEqual(ctx.layoutTopviewBatch([{id:'exact',width:300,depth:240}],room,999,-99)[0].x,0);
console.log('topview batch ok: wrapping, bounds, no self-overlap, atomic failure');
