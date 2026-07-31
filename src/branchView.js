/* ═══════════════════════════════════════════════════════
   branchView.js — Branch sales KPI + best/worst product panel
   Called by branches.js whenever the selected/loaded branch changes.
   ═══════════════════════════════════════════════════════ */

function renderBranchView(branch) {
  const panel = $('branchViewPanel');
  if (!panel) return;

  if (!branch) {
    panel.innerHTML = '';
    return;
  }

  panel.innerHTML = '<div class="branch-view-loading">กำลังโหลดยอดขาย…</div>';

  getBranchSales(branch.name)
    .then((sales) => renderBranchViewContent(panel, branch, sales))
    .catch((err) => {
      console.error('Branch sales load error:', err);
      panel.innerHTML = '<div class="branch-view-error">โหลดข้อมูลยอดขายไม่สำเร็จ — ตรวจสอบชื่อสาขาหรือการเชื่อมต่ออินเทอร์เน็ต</div>';
    });
}

function renderBranchViewContent(panel, branch, sales) {
  const boardProducts = (branch.board && branch.board.products) || [];
  const latest = sales.monthly[sales.monthly.length - 1] || null;
  const prev = sales.monthly[sales.monthly.length - 2] || null;
  const momPct = latest && prev && prev.amount ? ((latest.amount - prev.amount) / prev.amount) * 100 : null;

  const top5 = sales.products.slice(0, 5);
  const bottom5 = sales.products.slice(-5).reverse();

  const productRow = (p) => {
    const matched = matchSalesProduct(boardProducts, p);
    return `<li class="bv-item">
      <span class="bv-name">${esc(p.name)}${matched ? ' <span class="bv-match">อยู่บนชั้น</span>' : ''}</span>
      <span class="bv-amount">${fmtBaht(p.amount)}</span>
    </li>`;
  };

  panel.innerHTML = `
    <div class="branch-view">
      <div class="branch-view-kpis">
        <div class="bv-kpi">
          <div class="bv-kpi-label">ยอดขายรวม</div>
          <div class="bv-kpi-value">${fmtBaht(sales.totalAmount)}</div>
        </div>
        <div class="bv-kpi">
          <div class="bv-kpi-label">จำนวนชิ้น</div>
          <div class="bv-kpi-value">${sales.totalQty.toLocaleString('th-TH')}</div>
        </div>
        <div class="bv-kpi">
          <div class="bv-kpi-label">MoM</div>
          <div class="bv-kpi-value">${momPct === null ? '—' : (momPct >= 0 ? '+' : '') + momPct.toFixed(1) + '%'}</div>
        </div>
      </div>
      ${top5.length ? `
      <div class="branch-view-section">
        <div class="branch-view-section-label">ขายดี Top 5</div>
        <ul class="branch-view-list">${top5.map(productRow).join('')}</ul>
      </div>` : ''}
      ${bottom5.length ? `
      <div class="branch-view-section">
        <div class="branch-view-section-label">ขายน้อย Bottom 5</div>
        <ul class="branch-view-list">${bottom5.map(productRow).join('')}</ul>
      </div>` : ''}
      ${!sales.products.length ? '<div class="branch-view-empty">ไม่พบข้อมูลยอดขายของสาขานี้ในไฟล์ — ตรวจชื่อสาขาให้ตรงกับที่ใช้ใน MDT Dashboard</div>' : ''}
    </div>
  `;
}

function fmtBaht(v) {
  return '฿' + Math.round(v).toLocaleString('th-TH');
}
