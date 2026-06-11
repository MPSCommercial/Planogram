/* ═══════════════════════════════════════════════════════
   planogram3d.js — SketchUp-style 3D view (Three.js)
   Renders the current spec + shelfData + products as real
   3D volumes you can orbit, zoom and pan around.
   ═══════════════════════════════════════════════════════ */

(function () {
  // World scale: 1 three.js unit = 1 cm.
  let renderer, scene, camera, controls;
  let contentGroup = null;   // holds gondola + products, rebuilt on refresh
  let rafId = null;
  let resizeObs = null;
  let initialized = false;
  let textureLoader = null;

  function container() { return $('stage3d'); }

  /** Lazily create renderer/scene/camera/lights once. */
  function ensureInit() {
    if (initialized) return true;
    if (!window.THREE) {
      showToast('กำลังโหลด 3D engine… ลองอีกครั้ง');
      return false;
    }
    const host = container();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    host.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#eef1f5');

    camera = new THREE.PerspectiveCamera(42, 1, 0.5, 8000);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.495; // can't go under the floor
    controls.minDistance = 40;
    controls.maxDistance = 4000;

    // ── Lighting: soft SketchUp-like ambient + key directional ──
    const hemi = new THREE.HemisphereLight(0xffffff, 0xb9bfc7, 0.85);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(420, 620, 540);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.05;
    scene.add(key);
    scene.userData.keyLight = key;

    const fill = new THREE.DirectionalLight(0xffffff, 0.25);
    fill.position.set(-380, 300, -260);
    scene.add(fill);

    textureLoader = new THREE.TextureLoader();
    initialized = true;

    // Resize handling
    resizeObs = new ResizeObserver(() => resize());
    resizeObs.observe(host);
    window.addEventListener('resize', resize);
    return true;
  }

  function resize() {
    if (!renderer) return;
    const host = container();
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function disposeGroup(group) {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
  }

  /** A box mesh with the SketchUp signature dark edge outline. */
  function makeBox(w, h, d, color, opts = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color || '#cccccc'),
      roughness: opts.roughness != null ? opts.roughness : 0.62,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = opts.cast !== false;
    mesh.receiveShadow = opts.receive !== false;

    if (opts.edges !== false) {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo, 30),
        new THREE.LineBasicMaterial({ color: 0x2a2f36, transparent: true, opacity: 0.28 })
      );
      mesh.add(edges);
    }
    return mesh;
  }

  /** A product box; front (+Z) face gets the package image if available. */
  function makeProduct(prod, w, h, d) {
    const base = new THREE.Color(prod.color || '#8a8f98');
    const side = new THREE.MeshStandardMaterial({ color: base, roughness: 0.6 });
    let front = side;

    if (prod.image) {
      const tex = textureLoader.load(prod.image);
      tex.encoding = THREE.sRGBEncoding;
      if (prod.rotation === 90) {
        tex.rotation = Math.PI / 2; // Rotate 90 degrees
        tex.center.set(0.5, 0.5);
      }
      front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
    }
    // BoxGeometry face order: +X, -X, +Y, -Y, +Z(front), -Z(back)
    const mats = [side, side, side.clone(), side, front, side];
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mats);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x20242a, transparent: true, opacity: 0.32 })
    );
    mesh.add(edges);
    return mesh;
  }

  /** Build the gondola structure + placed products from current state. */
  function buildScene() {
    if (contentGroup) {
      scene.remove(contentGroup);
      disposeGroup(contentGroup);
    }
    contentGroup = new THREE.Group();
    scene.add(contentGroup);

    const s = (typeof spec === 'object' && spec.segments) ? spec : null;
    if (!s) {
      showToast('สร้าง shelf ก่อนเปิดมุมมอง 3D');
      return { W: 360, H: 220 };
    }

    const W = s.width;            // cm
    const H = s.height;           // cm
    const D = s.depth;            // cm
    const segCount = s.segments;
    const shelfCount = s.shelves;
    const segW = W / segCount;
    // Per-shelf cell heights (top shelf first); fall back to an even split.
    const cellHeights = (Array.isArray(s.shelfHeights) && s.shelfHeights.length === shelfCount)
      ? s.shelfHeights
      : Array.from({ length: shelfCount }, () => H / shelfCount);
    // Surface (board top) height from the floor for each shelf index.
    const surfaceYs = [];
    let cumTop = 0;
    for (let i = 0; i < shelfCount; i++) { cumTop += cellHeights[i]; surfaceYs.push(H - cumTop); }
    const thick = Math.max(2, s.shelfThickness);
    const panelT = 3;
    const frontPad = 2;           // products sit slightly back from the lip

    // ── Floor: ground plane + SketchUp grid ──
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 4, D * 8),
      new THREE.MeshStandardMaterial({ color: '#e7ebf0', roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.2;
    floor.receiveShadow = true;
    contentGroup.add(floor);

    const grid = new THREE.GridHelper(Math.max(W, D) * 4, Math.round(Math.max(W, D) * 4 / 20), 0xc4cbd4, 0xd6dce3);
    grid.position.y = 0;
    contentGroup.add(grid);

    // ── Gondola base ──
    const base = makeBox(W, thick, D, '#cfd4da');
    base.position.set(0, thick / 2, 0);
    contentGroup.add(base);

    // ── Back panel ──
    if (s.hasBackPanel) {
      const back = makeBox(W, H, panelT, s.backColor);
      back.position.set(0, H / 2, -D / 2 + panelT / 2);
      contentGroup.add(back);
    }

    // ── Side panels ──
    if (s.hasSidePanel) {
      [-1, 1].forEach((sign) => {
        const sidePanel = makeBox(panelT, H, D, s.shelfColor);
        sidePanel.position.set(sign * (W / 2 - panelT / 2), H / 2, 0);
        contentGroup.add(sidePanel);
      });
    }

    // Calculate segment left boundaries and custom widths
    const segmentWidths = s.segmentWidths || Array.from({ length: segCount }, () => W / segCount);
    const segmentLefts = [];
    let tempLeft = -W / 2;
    for (let i = 0; i < segCount; i++) {
      segmentLefts.push(tempLeft);
      tempLeft += segmentWidths[i];
    }

    // ── Segment dividers ──
    if (s.hasDivider) {
      for (let seg = 1; seg < segCount; seg++) {
        const x = segmentLefts[seg];
        const div = makeBox(panelT, H, D, '#b9bec5');
        div.position.set(x, H / 2, 0);
        contentGroup.add(div);
      }
    }

    // ── Shelf surfaces & Products ──
    // shelf i = 0 is the TOP shelf (matches 2D label S{shelves-i}).
    const list = (typeof products !== 'undefined') ? products : [];

    for (let seg = 0; seg < segCount; seg++) {
      const segW = segmentWidths[seg];
      const segLeft = segmentLefts[seg];
      const centerX = segLeft + segW / 2;

      // Calculate surfaceYs for this specific segment
      const segHeights = (s.segmentShelfHeights && Array.isArray(s.segmentShelfHeights[seg]))
        ? s.segmentShelfHeights[seg]
        : cellHeights;
      
      const segSurfaceYs = [];
      let segCumTop = 0;
      for (let i = 0; i < shelfCount; i++) {
        segCumTop += segHeights[i];
        segSurfaceYs.push(H - segCumTop);
      }

      // Draw shelf boards for this segment
      for (let i = 0; i < shelfCount; i++) {
        const surfaceY = segSurfaceYs[i];
        
        let leftBound = segLeft;
        if (seg === 0) {
          if (s.hasSidePanel) leftBound += panelT;
        } else {
          if (s.hasDivider) leftBound += panelT / 2;
        }

        let rightBound = segLeft + segW;
        if (seg === segCount - 1) {
          if (s.hasSidePanel) rightBound -= panelT;
        } else {
          if (s.hasDivider) rightBound -= panelT / 2;
        }

        const boardW = Math.max(0, rightBound - leftBound);
        const boardX = (leftBound + rightBound) / 2;

        const board = makeBox(boardW, thick, D - 2, s.shelfColor);
        board.position.set(boardX, surfaceY + thick / 2, 0);
        contentGroup.add(board);
      }

      // Place products for this segment
      for (let i = 0; i < shelfCount; i++) {
        const key = `${seg}-${i}`;
        const placed = (typeof shelfData !== 'undefined' && shelfData[key]) ? shelfData[key] : [];
        if (!placed.length) continue;

        const surfaceY = segSurfaceYs[i];
        let cursorX = segLeft + 2;

        placed.forEach((pid) => {
          const p = list.find((q) => q.id === pid);
          if (!p) return;
          const facing = p.facing || 1;
          const dims = getProductDimensions(p, D);
          const w = dims.width * facing;
          const h = dims.height;
          const d = dims.depth;

          const stack = Math.max(1, p.stack || 1);
          const base = makeProduct(p, w, h, d);
          for (let k = 0; k < stack; k++) {
            const mesh = k === 0 ? base : base.clone();
            mesh.position.set(
              cursorX + w / 2,
              surfaceY + thick + h / 2 + k * h,
              D / 2 - d / 2 - frontPad
            );
            contentGroup.add(mesh);
          }
          cursorX += w + 0.6; // tiny gap between SKUs
        });
      }
    }

    return { W, H };
  }

  function frameCamera(W, H) {
    const cx = 0, cy = H * 0.46, cz = 0;
    controls.target.set(cx, cy, cz);
    camera.position.set(W * 0.62, H * 0.95, (W * 0.5 + H * 0.9 + 200));
    camera.updateProjectionMatrix();

    // size shadow frustum to the gondola
    const key = scene.userData.keyLight;
    const cam = key.shadow.camera;
    const r = Math.max(W, H) * 0.9;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
    cam.near = 1; cam.far = 3000;
    cam.updateProjectionMatrix();
  }

  function animate() {
    rafId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  // ── Public API ──
  function open() {
    if (!ensureInit()) return;
    const host = container();
    host.style.display = 'block';
    const board = $('exportArea');
    if (board) board.style.display = 'none';
    resize();
    const dims = buildScene();
    frameCamera(dims.W, dims.H);
    if (!rafId) animate();
  }

  function close() {
    const host = container();
    if (host) host.style.display = 'none';
    const board = $('exportArea');
    if (board) board.style.display = '';
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function refresh() {
    if (!initialized || !rafId) return;
    const dims = buildScene();
    frameCamera(dims.W, dims.H);
  }

  function isOpen() {
    const host = container();
    return host && host.style.display === 'block';
  }

  window.Planogram3D = { open, close, refresh, isOpen };
})();
