/* ═══════════════════════════════════════════════════════
   multiBoard.js — Multiple shelf "boards" sharing the single
   Shelf-Specification form and Product Library. A row of small
   tiles above the canvas lets the user pick which board the
   shared panels currently edit.
   ═══════════════════════════════════════════════════════ */

const BOARD_ROW_KEY = 'planogram_board_row';

function loadBoardRow() {
  try {
    const raw = localStorage.getItem(BOARD_ROW_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (data && Array.isArray(data.boards) && data.boards.length && data.activeId) return data;
  } catch (e) {
    // fall through to default
  }
  return { activeId: 'board-1', boards: [{ id: 'board-1', label: 'เชลฟ์ 1' }] };
}

function saveBoardRow(data) {
  try {
    localStorage.setItem(BOARD_ROW_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage might be full — silently fail
  }
}

function nextBoardId(boards) {
  const used = boards.map((b) => parseInt(String(b.id).replace('board-', ''), 10)).filter((n) => !isNaN(n));
  return `board-${used.length ? Math.max(...used) + 1 : 1}`;
}

function boardStats(entry, isActive) {
  const s = isActive ? spec : (entry.snapshot ? entry.snapshot.planogram : null);
  const placements = isActive ? shelfData : (entry.snapshot ? entry.snapshot.placements : {});
  if (!s) return { segShelf: '–', skuCount: 0 };
  const skuCount = Object.values(placements || {}).reduce((n, arr) => n + flatPlacements(Array.isArray(arr) ? arr : []).length, 0);
  return { segShelf: `${s.segments}×${s.shelves}`, skuCount };
}

function renderBoardTiles() {
  const wrap = $('boardTiles');
  if (!wrap) return;
  const data = loadBoardRow();

  wrap.innerHTML = data.boards.map((b) => {
    const isActive = b.id === data.activeId;
    const stats = boardStats(b, isActive);
    return `
      <div class="board-tile${isActive ? ' active' : ''}" data-id="${b.id}">
        <input class="board-tile-label" data-id="${b.id}" value="${esc(b.label || '')}" placeholder="ฝั่ง...">
        <span class="board-tile-stats">${stats.segShelf} · ${stats.skuCount} ชิ้น</span>
        ${data.boards.length > 1 ? `<button class="board-tile-remove" data-id="${b.id}" title="ลบเชลฟ์นี้" type="button">×</button>` : ''}
      </div>
    `;
  }).join('');
}

function switchToBoard(id) {
  const data = loadBoardRow();
  if (id === data.activeId) return;

  const outgoing = data.boards.find((b) => b.id === data.activeId);
  if (outgoing) {
    const snap = buildBoardSnapshot();
    // Deliberately omit `products` — the catalog is shared across all boards.
    outgoing.snapshot = { planogram: snap.planogram, placements: snap.placements };
  }

  const incoming = data.boards.find((b) => b.id === id);
  if (!incoming) return;

  const incomingData = incoming.snapshot
    ? incoming.snapshot
    : { planogram: JSON.parse(JSON.stringify(spec)), placements: {} };
  delete incoming.snapshot; // it's the active board now — live globals are the source of truth

  closeMiniInspector();
  applyBoardData(incomingData);
  // A product may have been deleted from the shared catalog while this board
  // was dormant — drop any now-dangling placement ids before showing it.
  pruneMissingPlacements();
  renderShelfFill();
  updateSummary();

  data.activeId = id;
  saveBoardRow(data);
  renderBoardTiles();
  saveState();
}

function addBoard() {
  const data = loadBoardRow();
  const id = nextBoardId(data.boards);
  data.boards.push({ id, label: `เชลฟ์ ${data.boards.length + 1}` });
  saveBoardRow(data);
  switchToBoard(id);
}

function removeBoard(id) {
  const data = loadBoardRow();
  if (data.boards.length <= 1) {
    showToast('ต้องมีอย่างน้อย 1 เชลฟ์');
    return;
  }
  const target = data.boards.find((b) => b.id === id);
  if (!target || !confirm(`ลบ "${target.label || id}"? ข้อมูลของเชลฟ์นี้จะหายไป`)) return;

  if (id === data.activeId) {
    const fallback = data.boards.find((b) => b.id !== id);
    switchToBoard(fallback.id);
  }

  const fresh = loadBoardRow();
  fresh.boards = fresh.boards.filter((b) => b.id !== id);
  saveBoardRow(fresh);
  renderBoardTiles();
}

document.addEventListener('DOMContentLoaded', () => {
  const wrap = $('boardTiles');
  if (!wrap) return;

  wrap.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.board-tile-remove');
    if (removeBtn) { removeBoard(removeBtn.dataset.id); return; }
    if (e.target.closest('.board-tile-label')) return;
    const tile = e.target.closest('.board-tile');
    if (tile) switchToBoard(tile.dataset.id);
  });

  wrap.addEventListener('change', (e) => {
    const input = e.target.closest('.board-tile-label');
    if (!input) return;
    const data = loadBoardRow();
    const entry = data.boards.find((b) => b.id === input.dataset.id);
    if (entry) {
      entry.label = input.value;
      saveBoardRow(data);
    }
  });

  const addBtn = $('btnAddBoard');
  if (addBtn) addBtn.addEventListener('click', addBoard);

  renderBoardTiles();
});
