/* ═══════════════════════════════════════════════════════
   templates.js — Shelf dimension templates (presets + saved)
   ═══════════════════════════════════════════════════════ */

const TEMPLATE_STORAGE_KEY = 'planogram_shelf_templates';
const HIDDEN_BUILTIN_KEY = 'planogram_hidden_builtin_templates';

// ─── Fields that make up a shelf template (no product / name data) ───
const TEMPLATE_FIELDS = [
  'segments', 'shelves', 'width', 'height', 'depth', 'gap', 'shelfThickness',
  'backColor', 'shelfColor', 'hasBackPanel', 'hasSidePanel', 'hasDivider',
];

// ─── Built-in basic shelf templates for Modern Trade ───
const BUILTIN_TEMPLATES = [
  {
    id: 'builtin-gondola-standard',
    name: 'Gondola มาตรฐาน',
    builtin: true,
    spec: {
      segments: 3, shelves: 6, width: 360, height: 220, depth: 48, gap: 28,
      shelfThickness: 3, backColor: '#3a3a3a', shelfColor: '#f4f4f0',
      hasBackPanel: true, hasSidePanel: true, hasDivider: true,
    },
  },
  {
    id: 'builtin-gondola-tall',
    name: 'Gondola สูง',
    builtin: true,
    spec: {
      segments: 4, shelves: 7, width: 480, height: 240, depth: 50, gap: 24,
      shelfThickness: 3, backColor: '#3a3a3a', shelfColor: '#f4f4f0',
      hasBackPanel: true, hasSidePanel: true, hasDivider: true,
    },
  },
  {
    id: 'builtin-endcap',
    name: 'Endcap / หัวเชลฟ์',
    builtin: true,
    spec: {
      segments: 1, shelves: 5, width: 120, height: 180, depth: 45, gap: 26,
      shelfThickness: 3, backColor: '#34343a', shelfColor: '#f4f4f0',
      hasBackPanel: true, hasSidePanel: true, hasDivider: false,
    },
  },
  {
    id: 'builtin-wall-low',
    name: 'Wall Shelf เตี้ย',
    builtin: true,
    spec: {
      segments: 2, shelves: 4, width: 240, height: 150, depth: 40, gap: 30,
      shelfThickness: 3, backColor: '#3a3a3a', shelfColor: '#f4f4f0',
      hasBackPanel: true, hasSidePanel: false, hasDivider: true,
    },
  },
  {
    id: 'builtin-cooler',
    name: 'ตู้แช่ / Cooler',
    builtin: true,
    spec: {
      segments: 2, shelves: 5, width: 200, height: 200, depth: 55, gap: 26,
      shelfThickness: 4, backColor: '#2b2f33', shelfColor: '#eef2f4',
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
 * Load the set of builtin template ids the user has hidden/removed.
 */
function loadHiddenBuiltins() {
  try {
    const raw = localStorage.getItem(HIDDEN_BUILTIN_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

/**
 * Persist the set of hidden builtin template ids.
 */
function saveHiddenBuiltins(list) {
  try {
    localStorage.setItem(HIDDEN_BUILTIN_KEY, JSON.stringify(list));
  } catch (e) {
    // localStorage might be unavailable — silently fail
  }
}

/**
 * Builtin templates the user has not hidden.
 */
function visibleBuiltinTemplates() {
  const hidden = loadHiddenBuiltins();
  return BUILTIN_TEMPLATES.filter((t) => !hidden.includes(t.id));
}

/**
 * Find a template (builtin or user) by id, regardless of hidden state.
 */
function findTemplate(id) {
  return BUILTIN_TEMPLATES.concat(loadUserTemplates()).find((t) => t.id === id) || null;
}

/**
 * Populate the template <select> with builtin + user groups.
 */
function renderTemplateOptions(selectedId = '') {
  const select = $('templateSelect');
  if (!select) return;

  const userTemplates = loadUserTemplates();
  const builtins = visibleBuiltinTemplates();
  const optionHtml = (t) => `<option value="${t.id}">${esc(t.name)}</option>`;

  let html = '<option value="">เลือกเทมเพลต…</option>';
  if (builtins.length) {
    html += `<optgroup label="พื้นฐาน">${builtins.map(optionHtml).join('')}</optgroup>`;
  }
  if (userTemplates.length) {
    html += `<optgroup label="ของฉัน">${userTemplates.map(optionHtml).join('')}</optgroup>`;
  }
  select.innerHTML = html;
  select.value = selectedId;

  const delBtn = $('btnDeleteTemplate');
  if (delBtn) delBtn.disabled = !select.value;

  const exportBtn = $('btnExportTemplate');
  if (exportBtn) exportBtn.disabled = !select.value;

  const restoreBtn = $('btnRestoreTemplates');
  if (restoreBtn) restoreBtn.style.display = loadHiddenBuiltins().length ? '' : 'none';
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
    list.push({ id: `user-${nextTemplateId()}`, name, builtin: false, spec });
  }
  saveUserTemplates(list);

  const saved = list.find((t) => t.name === name);
  renderTemplateOptions(saved ? saved.id : '');
  showToast(`บันทึกเทมเพลต "${name}" แล้ว`);
}

/**
 * Delete the currently selected user template.
 */
function deleteSelectedTemplate() {
  const select = $('templateSelect');
  if (!select || !select.value) return;
  const tpl = findTemplate(select.value);
  if (!tpl) return;
  if (!confirm(`ลบเทมเพลต "${tpl.name}"?`)) return;

  if (tpl.builtin) {
    // Builtin templates are hidden rather than deleted, so they can be restored.
    const hidden = loadHiddenBuiltins();
    if (!hidden.includes(tpl.id)) hidden.push(tpl.id);
    saveHiddenBuiltins(hidden);
  } else {
    saveUserTemplates(loadUserTemplates().filter((t) => t.id !== tpl.id));
  }

  renderTemplateOptions('');
  showToast(`ลบเทมเพลต "${tpl.name}" แล้ว`);
}

/**
 * Restore all hidden builtin templates back into the list.
 */
function restoreBuiltinTemplates() {
  saveHiddenBuiltins([]);
  renderTemplateOptions('');
  showToast('คืนค่าเทมเพลตพื้นฐานแล้ว');
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
