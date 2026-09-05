/* ═══════════════════════════════════════════════════════
   products.js — Product data management & UI
   ═══════════════════════════════════════════════════════ */

let products = [];
let selectedProductId = null;
let pendingImageBase64 = null;
let editingProductId = null;
let editImageBase64 = null;
let activeCategoryFilter = '';

/**
 * Add a new product from the form inputs
 */
function addProduct() {
  const name = $('pName').value.trim();
  if (!name) {
    showToast('กรุณาใส่ชื่อสินค้า');
    return;
  }

  const product = {
    id: uid(),
    name,
    category: $('pCat').value.trim() || 'ไม่ระบุ',
    brand: $('pBrand').value.trim() || '',
    color: $('pColor').value,
    facing: clamp(parseInt($('pFacing').value) || 1, 1, 12),
    width: $('pWidth').value.trim() || '',
    height: $('pHeight').value.trim() || '',
    depth: $('pDepth').value.trim() || '',
    price: parseFloat($('pPrice').value) || 0,
    salesRate: parseFloat($('pSalesRate').value) || 0,
    image: pendingImageBase64,
  };

  products.push(product);

  // Reset form
  $('pName').value = '';
  if ($('pDepth')) $('pDepth').value = '';
  if ($('pPrice')) $('pPrice').value = '';
  if ($('pSalesRate')) $('pSalesRate').value = '';
  removeUploadedImage();
  renderProductList();
  updateLegend();
  updateSummary();
  selectProduct(product.id);
  saveState();
  if (window.Planogram3D && Planogram3D.isOpen()) Planogram3D.refresh();
  showToast('เพิ่มสินค้าแล้ว');
}

/**
 * Delete a product and remove it from all shelf placements
 */
function deleteProduct(id, event) {
  if (event) event.stopPropagation();
  products = products.filter((p) => p.id !== id);

  // Remove from shelf
  Object.keys(shelfData).forEach((key) => {
    if (Array.isArray(shelfData[key])) {
      shelfData[key] = pruneColumns(shelfData[key], (pid) => pid !== id);
      if (!shelfData[key].length) delete shelfData[key];
    }
  });

  if (selectedProductId === id) {
    selectedProductId = null;
    $('modeText').textContent = 'เลือกสินค้า แล้วคลิกช่องหรือ drag ไปวางบน shelf';
  }

  renderProductList();
  renderShelfFill();
  updateLegend();
  updateSummary();
  saveState();
  if (window.Planogram3D && Planogram3D.isOpen()) Planogram3D.refresh();
}

/**
 * Select a product for placement
 */
function selectProduct(id) {
  if (window.TopViewLayout && TopViewLayout.isActive()) { TopViewLayout.toggleProduct(id); return; }
  selectedProductId = id;
  const product = products.find((p) => p.id === id);
  $('modeText').textContent = product
    ? `กำลังเลือก: ${product.name} (F:${product.facing})`
    : 'เลือกสินค้า แล้วคลิก shelf หรือ drag ไปวางได้เลย';
  renderProductList();
}

/**
 * Render the product library list
 */
// ponytail: each view's library scopes to its own sheet tab — Top View to
// Master Fur (furniture), Planogram to Master ACC — so the other tab's SKUs
// never show up as browsable there. Hand-added SKUs (no tabRole) show in both.
function productLibrarySource() {
  return window.TopViewLayout && TopViewLayout.isActive()
    ? products.filter((p) => p.tabRole !== 'acc')
    : products.filter((p) => p.tabRole !== 'furniture');
}

function renderCategoryFilter() {
  const sel = $('categoryFilter');
  if (!sel) return;
  const groups = [...new Set(productLibrarySource().map((p) => p.subCategory || p.category).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">ทั้งหมด</option>' +
    groups.map((g) => `<option value="${esc(g)}"${g === activeCategoryFilter ? ' selected' : ''}>${esc(g)}</option>`).join('');
}

function renderProductList() {
  const list = $('productList');
  const search = ($('productSearch').value || '').toLowerCase();
  const source = productLibrarySource();
  $('productCountBadge').textContent = source.length;

  renderCategoryFilter();

  let filtered = source;
  if (activeCategoryFilter) {
    filtered = filtered.filter((p) => (p.subCategory || p.category) === activeCategoryFilter);
  }
  if (search) {
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        (p.brand || '').toLowerCase().includes(search) ||
        (p.category || '').toLowerCase().includes(search) ||
        (p.odoo || '').toLowerCase().includes(search) ||
        (p.subCategory || '').toLowerCase().includes(search)
    );
  }

  const topview = window.TopViewLayout && TopViewLayout.isActive();
  const selectionBar = $('tvProductSelection');
  selectionBar.hidden = !topview;
  if (topview) {
    $('tvProductSelectionCount').textContent = `เลือก ${TopViewLayout.selectedProducts.size} ตัว · คลิกบนแปลนเพื่อวางทั้งชุด`;
    $('tvClearProductSelection').onclick = () => TopViewLayout.clearProductSelection();
  }
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-list">${
      products.length
        ? 'ไม่พบสินค้าที่ค้นหา'
        : 'ยังไม่มีสินค้า<br>เพิ่ม SKU หรือกดโหลดตัวอย่าง'
    }</div>`;
    return;
  }

  list.innerHTML = '';
  filtered.forEach((product) => {
    const card = document.createElement('div');
    card.className =
      'product-card' + ((topview ? TopViewLayout.selectedProducts.has(product.id) : product.id === selectedProductId) ? ' selected' : '');
    card.draggable = true;

    const thumbImage = productImage(product);
    const thumb = thumbImage
      ? `<div class="thumb"><img src="${esc(thumbImage)}" alt="" draggable="false"></div>`
      : `<div class="thumb" style="background:${product.color};color:${contrast(product.color)}" draggable="false">${esc(initials(product.name))}</div>`;

    const priceText = product.price ? `฿${product.price}` : '';
    const salesText = product.salesRate ? `${product.salesRate}/วัน` : '';
    const meta = [
      product.odoo,
      product.brand || product.category,
      priceText,
      salesText,
      `F:${product.facing}`,
      product.width ? `${product.width}×${product.height || '-'}` + (product.depth ? `×${product.depth}` : '') + 'cm' : '',
    ].filter(Boolean).join(' · ');

    card.innerHTML = `
      ${thumb}
      <div>
        <div class="product-name" title="${esc(product.name)}">${esc(product.name)}</div>
        <div class="product-meta">${esc(meta)}</div>
      </div>
    `;

    if (topview) {
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'tv-product-check';
      check.checked = TopViewLayout.selectedProducts.has(product.id);
      check.setAttribute('aria-label', `เลือก ${product.name}`);
      check.addEventListener('click', e => { e.stopPropagation(); selectProduct(product.id); });
      card.appendChild(check);
    }
    card.addEventListener('click', () => selectProduct(product.id));
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', product.id);
      e.dataTransfer.setData('text', product.id);
      e.dataTransfer.effectAllowed = 'move';
      if (!topview) selectProduct(product.id);
      else if (!TopViewLayout.selectedProducts.has(product.id)) {
        TopViewLayout.selectedProducts.clear();
        TopViewLayout.selectedProducts.add(product.id);
      }

      // Auto-close 3D view on drag start to reveal the 2D placement canvas
      if (window.Planogram3D && Planogram3D.isOpen()) {
        Planogram3D.close();
        const btn = $('btnToggle3D');
        if (btn) btn.classList.remove('active');
        showToast('สลับเข้าสู่โหมด 2D อัตโนมัติเพื่อจัดวางสินค้า');
      }
    });
    if (topview) card.addEventListener('dragend', renderProductList);
    list.appendChild(card);
  });
}

/**
 * Handle product image upload
 */
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    pendingImageBase64 = ev.target.result;
    $('previewImg').src = pendingImageBase64;
    $('uploadHint').style.display = 'none';
    $('uploadPreview').style.display = 'block';
    $('uploadZone').classList.add('has-image');
    $('uploadZone').querySelector('input[type=file]').style.pointerEvents = 'none';
  };
  reader.readAsDataURL(file);
}

/**
 * Remove the uploaded image preview
 */
function removeUploadedImage(e) {
  if (e) e.stopPropagation();
  pendingImageBase64 = null;
  $('imgInput').value = '';
  $('previewImg').src = '';
  $('uploadHint').style.display = '';
  $('uploadPreview').style.display = 'none';
  $('uploadZone').classList.remove('has-image');
  $('uploadZone').querySelector('input[type=file]').style.pointerEvents = 'auto';
}

/**
 * Update the category legend
 */
function updateLegend() {
  const legend = $('legendBox');
  const categories = {};
  products.forEach((p) => {
    if (!categories[p.category]) categories[p.category] = p.color;
  });
  legend.innerHTML = Object.entries(categories)
    .map(
      ([name, color]) =>
        `<div class="legend-item"><span class="dot" style="background:${color}"></span>${esc(name)}</div>`
    )
    .join('');
}

/**
 * Open the edit modal for a product
 */
function openEditModal(id, event) {
  if (event) event.stopPropagation();
  const product = products.find((p) => p.id === id);
  if (!product) return;

  editingProductId = id;
  editImageBase64 = product.image;

  // Populate form
  $('editName').value = product.name;
  $('editCat').value = product.category;
  $('editBrand').value = product.brand;
  $('editColor').value = product.color;
  $('editFacing').value = product.facing;
  $('editWidth').value = product.width || '';
  $('editHeight').value = product.height || '';
  if ($('editDepth')) $('editDepth').value = product.depth || '';
  if ($('editPrice')) $('editPrice').value = product.price || '';
  if ($('editSalesRate')) $('editSalesRate').value = product.salesRate || '';

  // Show image preview if exists
  if (product.image) {
    $('editPreviewImg').src = product.image;
    $('editUploadHint').style.display = 'none';
    $('editUploadPreview').style.display = 'block';
    $('editUploadZone').classList.add('has-image');
    $('editUploadZone').querySelector('input[type=file]').style.pointerEvents = 'none';
  } else {
    resetEditImage();
  }

  // Open modal
  $('editModal').classList.add('open');
}

/**
 * Close the edit modal
 */
function closeEditModal() {
  $('editModal').classList.remove('open');
  editingProductId = null;
  editImageBase64 = null;
  resetEditImage();
  if ($('editDepth')) $('editDepth').value = '';
  if ($('editPrice')) $('editPrice').value = '';
  if ($('editSalesRate')) $('editSalesRate').value = '';
}

/**
 * Save the edited product
 */
function saveEditProduct() {
  const product = products.find((p) => p.id === editingProductId);
  if (!product) return;

  const name = $('editName').value.trim();
  if (!name) {
    showToast('กรุณาใส่ชื่อสินค้า');
    return;
  }

  product.name = name;
  product.category = $('editCat').value.trim() || 'ไม่ระบุ';
  product.brand = $('editBrand').value.trim() || '';
  product.color = $('editColor').value;
  product.facing = clamp(parseInt($('editFacing').value) || 1, 1, 12);
  product.width = $('editWidth').value.trim() || '';
  product.height = $('editHeight').value.trim() || '';
  product.depth = $('editDepth') ? $('editDepth').value.trim() : '';
  product.price = $('editPrice') ? parseFloat($('editPrice').value) || 0 : 0;
  product.salesRate = $('editSalesRate') ? parseFloat($('editSalesRate').value) || 0 : 0;
  product.image = editImageBase64;

  closeEditModal();
  renderProductList();
  renderShelfFill();
  updateLegend();
  updateSummary();
  saveState();
  if (window.Planogram3D && Planogram3D.isOpen()) Planogram3D.refresh();
  showToast('บันทึกการแก้ไขแล้ว');
}

/**
 * Handle image upload in edit modal
 */
function handleEditImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    editImageBase64 = ev.target.result;
    $('editPreviewImg').src = editImageBase64;
    $('editUploadHint').style.display = 'none';
    $('editUploadPreview').style.display = 'block';
    $('editUploadZone').classList.add('has-image');
    $('editUploadZone').querySelector('input[type=file]').style.pointerEvents = 'none';
  };
  reader.readAsDataURL(file);
}

/**
 * Remove image in edit modal
 */
function removeEditImage(e) {
  if (e) e.stopPropagation();
  editImageBase64 = null;
  resetEditImage();
}

/**
 * Reset the edit image upload zone
 */
function resetEditImage() {
  $('editImgInput').value = '';
  $('editPreviewImg').src = '';
  $('editUploadHint').style.display = '';
  $('editUploadPreview').style.display = 'none';
  $('editUploadZone').classList.remove('has-image');
  $('editUploadZone').querySelector('input[type=file]').style.pointerEvents = 'auto';
}
