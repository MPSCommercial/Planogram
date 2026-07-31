/* ═══════════════════════════════════════════════════════
   branches.js — Save/switch a full planogram board per branch
   ═══════════════════════════════════════════════════════ */

const BRANCH_STORAGE_KEY = 'planogram_branches';
let currentBranchId = '';

/**
 * Load saved branches from localStorage.
 */
function loadBranches() {
  try {
    const raw = localStorage.getItem(BRANCH_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

/**
 * Persist branches to localStorage.
 */
function saveBranches(list) {
  try {
    localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    // localStorage might be full — silently fail
  }
}

/**
 * Find a branch by id.
 */
function findBranch(id) {
  return loadBranches().find((b) => b.id === id) || null;
}

/**
 * Generate an incrementing id suffix that avoids collisions with existing ids.
 */
function nextBranchId() {
  const used = loadBranches()
    .map((b) => parseInt(String(b.id).replace('branch-', ''), 10))
    .filter((n) => !isNaN(n));
  return used.length ? Math.max(...used) + 1 : 1;
}

/**
 * Populate the branch <select> with saved branches.
 */
function renderBranchOptions(selectedId = '') {
  const select = $('branchSelect');
  if (!select) return;

  const branches = loadBranches();
  let html = '<option value="">เลือกสาขา…</option>';
  html += branches.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
  select.innerHTML = html;
  select.value = selectedId;
  currentBranchId = selectedId;

  const delBtn = $('btnDeleteBranch');
  if (delBtn) delBtn.disabled = !selectedId;

  if (typeof renderBranchView === 'function') {
    renderBranchView(selectedId ? findBranch(selectedId) : null);
  }
}

/**
 * Save the current board (shelf spec + products + placements) as a branch.
 */
function saveCurrentAsBranch() {
  const name = (prompt('ตั้งชื่อสาขา:', '') || '').trim();
  if (!name) return;

  const board = buildBoardSnapshot();
  const list = loadBranches();
  const existing = list.find((b) => b.name === name);
  if (existing) {
    if (!confirm(`มีสาขาชื่อ "${name}" อยู่แล้ว ต้องการเขียนทับด้วยข้อมูลบอร์ดปัจจุบันหรือไม่?`)) return;
    existing.board = board;
  } else {
    list.push({ id: `branch-${nextBranchId()}`, name, board });
  }
  saveBranches(list);

  const saved = list.find((b) => b.name === name);
  renderBranchOptions(saved ? saved.id : '');
  showToast(`บันทึกสาขา "${name}" แล้ว`);
}

/**
 * Load the selected branch's board onto the canvas.
 */
function switchToSelectedBranch() {
  const select = $('branchSelect');
  if (!select || !select.value) {
    showToast('เลือกสาขาก่อน');
    return;
  }
  const branch = findBranch(select.value);
  if (!branch) {
    showToast('ไม่พบสาขา');
    return;
  }

  applyBoardData(branch.board);
  currentBranchId = branch.id;
  if (typeof renderBranchView === 'function') renderBranchView(branch);
  showToast(`เปิดสาขา "${branch.name}" แล้ว`);
}

/**
 * Delete the currently selected branch.
 */
function deleteSelectedBranch() {
  const select = $('branchSelect');
  if (!select || !select.value) return;
  const branch = findBranch(select.value);
  if (!branch) return;
  if (!confirm(`ลบสาขา "${branch.name}"?`)) return;

  saveBranches(loadBranches().filter((b) => b.id !== branch.id));
  renderBranchOptions('');
  showToast(`ลบสาขา "${branch.name}" แล้ว`);
}
