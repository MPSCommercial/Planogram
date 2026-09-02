/* ═══════════════════════════════════════════════════════
   i18n.js — th/en toggle for static UI chrome.
   Dynamically-generated text (toasts, product data, export
   tables, template/branch names) stays Thai — not covered here.
   ═══════════════════════════════════════════════════════ */

const LANG_STORAGE_KEY = 'planogram_lang';

const TRANSLATIONS = {
  shelf_spec_heading: { th: 'ข้อมูลจำเพาะชั้นวาง', en: 'Shelf Specification' },
  planogram_name_label: { th: 'ชื่อ Planogram', en: 'Planogram Name' },
  segments_label: { th: 'จำนวน Segment', en: 'Segments' },
  shelves_per_segment_label: { th: 'ชั้นวาง / Segment', en: 'Shelves / Segment' },
  overall_width_label: { th: 'ความกว้างรวม', en: 'Overall Width' },
  overall_height_label: { th: 'ความสูงรวม', en: 'Overall Height' },
  shelf_depth_label: { th: 'ความลึกชั้นวาง', en: 'Shelf Depth' },
  gap_between_shelves_label: { th: 'ระยะห่างระหว่างชั้น', en: 'Gap Between Shelves' },
  shelf_thickness_label: { th: 'ความหนาชั้นวาง', en: 'Shelf Thickness' },
  back_panel_label: { th: 'แผงหลัง', en: 'Back Panel' },
  shelf_color_label: { th: 'สีชั้นวาง', en: 'Shelf Color' },
  has_back_panel_label: { th: 'มีแผงหลัง', en: 'Back panel' },
  has_side_panel_label: { th: 'มีแผงข้าง', en: 'Side panels' },
  has_segment_divider_label: { th: 'มีตัวกั้น Segment', en: 'Segment dividers' },
  seg_width_toggle: { th: 'ปรับความกว้างราย Segment (Bay)', en: 'Adjust Width per Segment (Bay)' },
  seg_width_heading: { th: 'กำหนดความกว้างรายตู้ (cm)', en: 'Set width per bay (cm)' },
  template_label: { th: 'เทมเพลตเชลฟ์', en: 'Shelf Templates' },
  template_select_aria: { th: 'เลือกเทมเพลตเชลฟ์', en: 'Select shelf template' },
  apply: { th: 'ใช้', en: 'Apply' },
  template_thumb_alt: { th: 'ตัวอย่างเชลฟ์', en: 'Shelf preview' },
  template_save: { th: 'บันทึกขนาดปัจจุบันเป็นเทมเพลต', en: 'Save current size as template' },
  template_delete_aria: { th: 'ลบเทมเพลต', en: 'Delete template' },
  delete: { th: 'ลบ', en: 'Delete' },
  template_export_empty: { th: 'Export เชลฟ์เปล่า PNG', en: 'Export Empty Shelf PNG' },
  branch_label: { th: 'สาขา (Branch)', en: 'Branch' },
  branch_select_aria: { th: 'เลือกสาขา', en: 'Select branch' },
  open: { th: 'เปิด', en: 'Open' },
  branch_save: { th: 'บันทึกบอร์ดปัจจุบันเป็นสาขา', en: 'Save current board as branch' },
  branch_delete_aria: { th: 'ลบสาขา', en: 'Delete branch' },
  room_update: { th: 'สร้าง / อัปเดตห้อง', en: 'Create / Update Room' },
  room_tpl_showroom: { th: 'Showroom (ชั้นวางสินค้าเรียงต่อกัน)', en: 'Showroom (shelves in a row)' },
  room_tpl_bedroom: { th: 'Bedroom (เตียง + โต๊ะทำงาน + เก้าอี้ + ชั้นวาง)', en: 'Bedroom (bed + desk + chair + shelf)' },
  room_tpl_office: { th: 'Office Workspace (โต๊ะทำงานคู่ + ชั้นวางของริมผนัง)', en: 'Office Workspace (dual desk + wall shelf)' },
  tv_inspector_empty: { th: 'คลิกเลือกสิ่งของในแปลน เพื่อแก้ไขตำแหน่งและหมุน', en: 'Click an item in the layout to edit its position and rotation' },
  tv_rotate_label: { th: 'หมุน (°)', en: 'Rotate (°)' },
  tv_size_label: { th: 'ขนาด W×D', en: 'Size W×D' },
  tv_duplicate: { th: 'ทำซ้ำ ⌘D', en: 'Duplicate ⌘D' },
  tv_rotate45: { th: 'หมุน 45°', en: 'Rotate 45°' },
  tv_delete: { th: 'ลบ ⌫', en: 'Delete ⌫' },
  tv_hint: { th: 'ลูกศร = ขยับตาม grid · Shift+ลูกศร = ขยับ 1 cm · ลากปุ่ม ↺ = หมุน 8 ทิศ · ⌘Z = Undo', en: 'Arrows = move by grid · Shift+Arrow = move 1 cm · drag ↺ = rotate 8-way · ⌘Z = Undo' },
  mode_text_default: { th: 'เลือกสินค้า แล้วคลิก shelf หรือ drag ไปวางได้เลย', en: 'Pick a product, then click a shelf or drag it into place' },
  toggle_3d_title: { th: 'สลับมุมมอง 3D', en: 'Toggle 3D view' },
  load_demo: { th: 'โหลดตัวอย่าง', en: 'Load Demo' },
  show_report: { th: 'รายงานสินค้า (BOM)', en: 'Product Report (BOM)' },
  clear_all: { th: 'ล้างชั้นวาง', en: 'Clear Shelf' },
  empty_state_planogram_html: { th: 'กด <strong>"สร้าง / อัปเดต Shelf"</strong> เพื่อเริ่มวาง Planogram', en: 'Click <strong>"Create / Update Shelf"</strong> to start building the planogram' },
  topview_hint: { th: 'Space+ลาก = เลื่อนผัง · ⌘+Scroll = ซูม · M = วัดระยะ', en: 'Space+drag = pan · ⌘+Scroll = zoom · M = measure' },
  export_image: { th: 'Export รูป', en: 'Export Image' },
  measure_title: { th: 'วัดระยะ (M)', en: 'Measure (M)' },
  measure_btn: { th: '📏 วัด', en: '📏 Measure' },
  empty_state_topview_html: { th: 'กด <strong>"สร้าง / อัปเดตห้อง"</strong> เพื่อเริ่มจัดวาง Layout ด้านบน', en: 'Click <strong>"Create / Update Room"</strong> above to start laying out the room' },
  stage3d_hint: { th: 'ลากเพื่อหมุน · scroll ซูม · คลิกขวาลากเพื่อเลื่อน', en: 'Drag to rotate · scroll to zoom · right-click drag to pan' },
  reset_view: { th: 'รีเซ็ตมุมมอง', en: 'Reset View' },
  upload_hint_product: { th: 'อัปโหลดรูปสินค้า', en: 'Upload product image' },
  product_name_label: { th: 'ชื่อสินค้า / SKU', en: 'Product Name / SKU' },
  add_product_btn: { th: 'เพิ่มสินค้า', en: 'Add Product' },
  sheet_sync_status: { th: 'Google Sheet พร้อม sync', en: 'Google Sheet ready to sync' },
  sheet_settings_title: { th: 'ตั้งค่า Google Sheet', en: 'Google Sheet Settings' },
  search_products_placeholder: { th: 'ค้นหาสินค้า...', en: 'Search products...' },
  edit_product_title: { th: 'แก้ไขสินค้า', en: 'Edit Product' },
  change_product_image: { th: 'เปลี่ยนรูปสินค้า', en: 'Change product image' },
  cancel: { th: 'ยกเลิก', en: 'Cancel' },
  save: { th: 'บันทึก', en: 'Save' },
  report_title: { th: 'รายงานสรุปการจัดเรียงสินค้า (BOM & Placements)', en: 'Placement Summary Report (BOM & Placements)' },
  report_skus_placed: { th: 'จำนวน SKU ที่วาง', en: 'SKUs Placed' },
  report_total_qty: { th: 'จำนวนชิ้นรวม (Facing × Stack)', en: 'Total Units (Facing × Stack)' },
  report_space_used: { th: 'พื้นที่ใช้งานสะสมบนเชลฟ์', en: 'Cumulative Shelf Space Used' },
  report_tab_bom: { th: 'สรุปยอดสินค้า (BOM Summary)', en: 'BOM Summary' },
  report_tab_placements: { th: 'รายละเอียดจุดจัดวาง (Placement Details)', en: 'Placement Details' },
  close: { th: 'ปิด', en: 'Close' },
  export_stock_xlsx: { th: 'Export ตัวโชว์-สต็อก.xlsx', en: 'Export Display-Stock.xlsx' },
  facing_dec_title: { th: 'ลด Facing', en: 'Decrease Facing' },
  facing_inc_title: { th: 'เพิ่ม Facing', en: 'Increase Facing' },
  depth_rows_label: { th: 'แถวลึก', en: 'Depth Rows' },
  depth_rows_dec_title: { th: 'ลดจำนวนชิ้นที่วางเรียงเข้าไปในแนวลึก', en: 'Decrease units placed in depth' },
  depth_rows_inc_title: { th: 'เพิ่มจำนวนชิ้นที่วางเรียงเข้าไปในแนวลึก', en: 'Increase units placed in depth' },
  stack_dec_title: { th: 'ลดชั้นวางซ้อน', en: 'Decrease stacking' },
  stack_inc_title: { th: 'วางซ้อนเพิ่ม', en: 'Increase stacking' },
  remove_from_shelf_title: { th: 'ลบจากชั้นวาง', en: 'Remove from shelf' },
  facing_side_label: { th: 'หันด้าน', en: 'Facing Side' },
  orientation_select_title: { th: 'เลือกด้านที่แสดง', en: 'Choose the side shown' },
  orient_front: { th: 'ด้านหน้า (Front)', en: 'Front' },
  orient_side: { th: 'ด้านข้าง (Side)', en: 'Side' },
  orient_top: { th: 'ด้านบน (Top)', en: 'Top' },
  depth_align_label: { th: 'ตำแหน่งลึก', en: 'Depth align' },
  depth_align_title: { th: 'วางชิดขอบหน้าหรือดันไปชิดขอบหลังชั้น', en: 'Hug the front edge or push to the back of the shelf' },
  depth_align_front: { th: 'ชิดขอบหน้า', en: 'Front edge' },
  depth_align_back: { th: 'ชิดขอบหลัง', en: 'Back edge' },
  rotate_label: { th: 'หมุน', en: 'Rotate' },
  rotate_90_title: { th: 'หมุนสินค้า 90 องศา', en: 'Rotate product 90°' },
  depth_rows_used_label: { th: 'แถวลึกที่ใช้:', en: 'Depth rows used:' },
  capacity_here_label: { th: 'ความจุรวมจุดนี้:', en: 'Total capacity here:' },
  sales_rate_label: { th: 'อัตราการขาย:', en: 'Sales rate:' },
  add_shelf_column: { th: '+ เพิ่มเชลฟ์ (ฝั่ง)', en: '+ Add Shelf' },
  shelf_side_placeholder: { th: 'ฝั่ง...', en: 'Side...' },
};

function getLang() {
  return localStorage.getItem(LANG_STORAGE_KEY) || 'en';
}

function applyLanguage(lang) {
  document.documentElement.lang = lang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const t = TRANSLATIONS[el.dataset.i18n];
    if (t) el.textContent = t[lang];
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const t = TRANSLATIONS[el.dataset.i18nHtml];
    if (t) el.innerHTML = t[lang];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const t = TRANSLATIONS[el.dataset.i18nPlaceholder];
    if (t) el.placeholder = t[lang];
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const t = TRANSLATIONS[el.dataset.i18nTitle];
    if (t) el.title = t[lang];
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const t = TRANSLATIONS[el.dataset.i18nAriaLabel];
    if (t) el.setAttribute('aria-label', t[lang]);
  });
  document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
    const t = TRANSLATIONS[el.dataset.i18nAlt];
    if (t) el.alt = t[lang];
  });

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

function setLang(lang) {
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  applyLanguage(lang);
}

document.addEventListener('DOMContentLoaded', () => {
  applyLanguage(getLang());
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
});
