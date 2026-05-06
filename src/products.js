/* ═══════════════════════════════════════════════════════
   products.js — Product data management & UI
   ═══════════════════════════════════════════════════════ */

let products = [];
let selectedProductId = null;
let pendingImageBase64 = null;

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
    width: $('pWidth').value || '',
    height: $('pHeight').value || '',
    image: pendingImageBase64,
  };

  products.push(product);

  // Reset form
  $('pName').value = '';
  removeUploadedImage();
  renderProductList();
  updateLegend();
  updateSummary();
  selectProduct(product.id);
  saveState();
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
    if (shelfData[key] === id) delete shelfData[key];
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
}

/**
 * Select a product for placement
 */
function selectProduct(id) {
  selectedProductId = id;
  const product = products.find((p) => p.id === id);
  $('modeText').textContent = product
    ? `กำลังเลือก: ${product.name} (F:${product.facing})`
    : 'เลือกสินค้า แล้วคลิกช่องหรือ drag ไปวางบน shelf';
  renderProductList();
}

/**
 * Render the product library list
 */
function renderProductList() {
  const list = $('productList');
  const search = ($('productSearch').value || '').toLowerCase();
  $('productCountBadge').textContent = products.length;

  const filtered = search
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.brand.toLowerCase().includes(search) ||
          p.category.toLowerCase().includes(search)
      )
    : products;

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
      'product-card' + (product.id === selectedProductId ? ' selected' : '');
    card.draggable = true;

    const thumb = product.image
      ? `<div class="thumb"><img src="${product.image}" alt=""></div>`
      : `<div class="thumb" style="background:${product.color};color:${contrast(product.color)}">${esc(initials(product.name))}</div>`;

    card.innerHTML = `
      ${thumb}
      <div>
        <div class="product-name">${esc(product.name)}</div>
        <div class="product-meta">${esc(product.brand || product.category)} · F:${product.facing}${product.width ? ` · ${product.width}×${product.height}cm` : ''}</div>
      </div>
      <button class="btn btn-danger" onclick="deleteProduct('${product.id}', event)">ลบ</button>
    `;

    card.addEventListener('click', () => selectProduct(product.id));
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', product.id);
      selectProduct(product.id);
    });
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
