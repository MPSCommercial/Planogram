/* ═══════════════════════════════════════════════════════
   templates.js — Shelf dimension templates (presets + saved)
   ═══════════════════════════════════════════════════════ */

const TEMPLATE_STORAGE_KEY = 'planogram_shelf_templates';

// ─── Fields that make up a shelf template (no product / name data) ───
const TEMPLATE_FIELDS = [
  'segments', 'shelves', 'width', 'height', 'depth', 'gap', 'shelfThickness',
  'backColor', 'shelfColor', 'hasBackPanel', 'hasSidePanel', 'hasDivider',
];

// ─── Built-in templates (shipped with the app, not stored in localStorage) ───
const BUILTIN_TEMPLATES = [
  {
    id: 'builtin-orange',
    name: 'เชลฟ์ส้ม',
    builtin: true,
    spec: {
      segments: 1, shelves: 3, width: 95, height: 142, depth: 35,
      gap: 28, shelfThickness: 3,
      backColor: '#c1571f', shelfColor: '#c1571f',
      hasBackPanel: true, hasSidePanel: true, hasDivider: true,
    },
  },
];

/**
 * Load user-saved templates from localStorage.
 */
function loadUserTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

/**
 * Persist user templates to localStorage.
 */
function saveUserTemplates(list) {
  try {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    // localStorage might be unavailable / full — silently fail
  }
}

/**
 * Find a template by id — checks built-ins first, then user-saved.
 */
function findTemplate(id) {
  return BUILTIN_TEMPLATES.find((t) => t.id === id)
    || loadUserTemplates().find((t) => t.id === id) || null;
}

/**
 * Populate the template <select> with built-in shelves + the user's saved ones.
 */
function renderTemplateOptions(selectedId = '') {
  const select = $('templateSelect');
  if (!select) return;

  const userTemplates = loadUserTemplates();
  const optionHtml = (t) => `<option value="${t.id}">${esc(t.name)}</option>`;

  select.innerHTML = '<option value="">เลือกเทมเพลต…</option>'
    + BUILTIN_TEMPLATES.map(optionHtml).join('')
    + userTemplates.map(optionHtml).join('');
  select.value = selectedId;

  const selected = findTemplate(select.value);

  const delBtn = $('btnDeleteTemplate');
  if (delBtn) delBtn.disabled = !select.value || !!(selected && selected.builtin);

  const exportBtn = $('btnExportTemplate');
  if (exportBtn) exportBtn.disabled = !select.value;

}

/**
 * Apply the currently selected template to the spec form, then rebuild.
 */
function applySelectedTemplate() {
  const select = $('templateSelect');
  if (!select || !select.value) {
    showToast('เลือกเทมเพลตก่อน');
    return;
  }
  const tpl = findTemplate(select.value);
  if (!tpl) {
    showToast('ไม่พบเทมเพลต');
    return;
  }

  const s = tpl.spec;
  $('numSegments').value = s.segments;
  $('shelvesPerSegment').value = s.shelves;
  $('overallWidth').value = s.width;
  $('overallHeight').value = s.height;
  $('shelfDepth').value = s.depth;
  $('gapSize').value = s.gap;
  $('shelfThickness').value = s.shelfThickness;
  $('backColor').value = s.backColor;
  $('shelfColor').value = s.shelfColor;
  $('hasBackPanel').checked = s.hasBackPanel !== false;
  $('hasSidePanel').checked = s.hasSidePanel !== false;
  $('hasSegmentDivider').checked = s.hasDivider !== false;

  buildShelf();
  showToast(`ใช้เทมเพลต "${tpl.name}" แล้ว`);
}

/**
 * Save the current shelf dimensions as a new user template.
 */
function saveCurrentAsTemplate() {
  const name = (prompt('ตั้งชื่อเทมเพลตเชลฟ์:', '') || '').trim();
  if (!name) return;

  const current = readSpec();
  const spec = {};
  TEMPLATE_FIELDS.forEach((k) => { spec[k] = current[k]; });

  const list = loadUserTemplates();
  const existing = list.find((t) => t.name === name);
  if (existing) {
    if (!confirm(`มีเทมเพลตชื่อ "${name}" อยู่แล้ว ต้องการเขียนทับหรือไม่?`)) return;
    existing.spec = spec;
  } else {
    list.push({ id: `user-${nextTemplateId()}`, name, spec });
  }
  saveUserTemplates(list);

  const saved = list.find((t) => t.name === name);
  renderTemplateOptions(saved ? saved.id : '');
  showToast(`บันทึกเทมเพลต "${name}" แล้ว`);
}

/**
 * Delete the currently selected template.
 */
function deleteSelectedTemplate() {
  const select = $('templateSelect');
  if (!select || !select.value) return;
  const tpl = findTemplate(select.value);
  if (!tpl) return;
  if (tpl.builtin) { showToast('เทมเพลตนี้เป็นค่ามาตรฐาน ลบไม่ได้'); return; }
  if (!confirm(`ลบเทมเพลต "${tpl.name}"?`)) return;

  saveUserTemplates(loadUserTemplates().filter((t) => t.id !== tpl.id));

  renderTemplateOptions('');
  showToast(`ลบเทมเพลต "${tpl.name}" แล้ว`);
}

/**
 * Generate an incrementing id suffix that avoids collisions with existing ids.
 */
function nextTemplateId() {
  const used = loadUserTemplates()
    .map((t) => parseInt(String(t.id).replace('user-', ''), 10))
    .filter((n) => !isNaN(n));
  return used.length ? Math.max(...used) + 1 : 1;
}
