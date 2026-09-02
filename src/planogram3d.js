/* ══════════════════════════════════════════════════════
   planogram3d.js — SketchUp-style 3D view (Three.js)
   Renders the current spec + shelfData + products as real
   3D volumes you can orbit, zoom and pan around.
   ══════════════════════════════════════════════════════ */

(function () {
  // World scale: 1 three.js unit = 1 cm.
  let renderer, scene, camera, controls;
  let contentGroup = null;   // holds gondola + products, rebuilt on refresh
  let rafId = null;
  let resizeObs = null;
  let initialized = false;
  let textureLoader = null;

  function container() { return $('stage3d'); }

  /** Converts a CSS hex or name color into a linear THREE.Color so sRGB output encoding doesn't wash it out. */
  function to3Color(color) {
    const c = new THREE.Color(color || '#cccccc');
    if (typeof c.convertSRGBToLinear === 'function') {
      c.convertSRGBToLinear();
    }
    return c;
  }

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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
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

    // ── Lighting: balanced ambient + key directional with rich contrast ──
    const hemi = new THREE.HemisphereLight(0xffffff, 0x64748b, 0.46);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(420, 620, 540);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.05;
    scene.add(key);
    scene.userData.keyLight = key;

    const fill = new THREE.DirectionalLight(0xe2edfa, 0.28);
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
      color: to3Color(color || '#cccccc'),
      roughness: opts.roughness != null ? opts.roughness : 0.48,
      metalness: opts.metalness != null ? opts.metalness : 0.02,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = opts.cast !== false;
    mesh.receiveShadow = opts.receive !== false;

    if (opts.edges !== false) {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo, 30),
        new THREE.LineBasicMaterial({ color: 0x2a2f36, transparent: true, opacity: opts.edgeOpacity != null ? opts.edgeOpacity : 0.16 })
      );
      mesh.add(edges);
    }
    return mesh;
  }

  /** A rounded box mesh using ExtrudeGeometry for smooth corners and bevels. */
  function makeRoundedBox(w, h, d, radius, color, opts = {}) {
    const r = Math.min(radius || 2, w / 2 - 0.1, h / 2 - 0.1, d / 2 - 0.1);
    if (r <= 0.2) {
      return makeBox(w, h, d, color, opts);
    }

    const shape = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;

    shape.moveTo(x, y + r);
    shape.lineTo(x, y + h - r);
    shape.quadraticCurveTo(x, y + h, x + r, y + h);
    shape.lineTo(x + w - r, y + h);
    shape.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
    shape.lineTo(x + w, y + r);
    shape.quadraticCurveTo(x + w, y, x + w - r, y);
    shape.lineTo(x + r, y);
    shape.quadraticCurveTo(x, y, x, y + r);

    const bevelThickness = Math.min(r, d / 2 - 0.1);
    const extrudeSettings = {
      depth: d - bevelThickness * 2,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: bevelThickness,
      bevelThickness: bevelThickness,
      curveSegments: 8
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();

    const mat = new THREE.MeshStandardMaterial({
      color: to3Color(color || '#cccccc'),
      roughness: opts.roughness != null ? opts.roughness : 0.48,
      metalness: opts.metalness != null ? opts.metalness : 0.02,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = opts.cast !== false;
    mesh.receiveShadow = opts.receive !== false;

    if (opts.edges !== false) {
      // 45 degree threshold prevents drawing edge lines on curved surfaces
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo, 45),
        new THREE.LineBasicMaterial({ color: 0x2a2f36, transparent: true, opacity: opts.edgeOpacity != null ? opts.edgeOpacity : 0.10 })
      );
      mesh.add(edges);
    }
    return mesh;
  }

  /** A product box; front (+Z) face gets the package image if available. */
  function makeProduct(prod, w, h, d) {
    const base = to3Color(prod.color || '#8a8f98');
    const side = new THREE.MeshStandardMaterial({ color: base, roughness: 0.48, metalness: 0.02 });
    let front = side;

    if (prod.image) {
      const tex = textureLoader.load(prod.image);
      tex.encoding = THREE.sRGBEncoding;
      if (prod.rotation === 90) {
        tex.rotation = Math.PI / 2; // Rotate 90 degrees
        tex.center.set(0.5, 0.5);
      }
      front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.02 });
    }
    // BoxGeometry face order: +X, -X, +Y, -Y, +Z(front), -Z(back)
    const mats = [side, side, side.clone(), side, front, side];
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mats);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x20242a, transparent: true, opacity: prod.image ? 0.22 : 0.3 })
    );
    mesh.add(edges);
    return mesh;
  }

  function product3DKind(p) {
    const text = `${p.topviewAsset || ''} ${p.name || ''} ${p.category || ''}`.toLowerCase();
    if (text.includes('nevi')) return 'nevi-desk';
    if (text.includes('sayl')) return 'sayl-chair';
    if (text.includes('office table') || text.includes('table') || text.includes('desk') || text.includes('โต๊ะ')) return 'table';
    if (text.includes('office chair') || text.includes('chair') || text.includes('เก้าอี้') || text.includes('seat')) return 'chair';
    if (text.includes('fixture shelf') || text.includes('shelf') || text.includes('ชั้นวาง')) return 'shelf';
    if (text.includes('bed') || text.includes('เตียง')) return 'bed';
    return 'box';
  }

  function addNeviDeskModel(group, origW, origH, origD) {
    const tableH = origH || 75;
    const topH = 3.2;
    const frameColor = '#3e4248';
    const metalColor = '#8d949c';
    const topColor = '#d9ccb9';

    const top = makeRoundedBox(origW, topH, origD, 2.2, topColor, { roughness: 0.55, edgeOpacity: 0.28 });
    top.position.set(0, tableH - topH / 2, 0);
    group.add(top);

    const topLip = makeRoundedBox(origW, 1.2, 2.2, 0.5, '#8e877c', { roughness: 0.60, edgeOpacity: 0.24 });
    topLip.position.set(0, tableH - topH - 1.4, -origD / 2 + 1.5);
    group.add(topLip);

    const screenH = Math.min(30, tableH * 0.45);
    const screen = makeRoundedBox(origW * 0.86, screenH, 2.4, 1.0, '#b2aa9f', { roughness: 0.65, edgeOpacity: 0.30 });
    screen.position.set(0, tableH + screenH / 2 - 2, -origD / 2 + 3.5);
    group.add(screen);

    const beam = makeRoundedBox(origW * 0.86, 3.2, 5.2, 1.4, metalColor, { roughness: 0.45, edgeOpacity: 0.28 });
    beam.position.set(0, tableH * 0.5, 0);
    group.add(beam);

    const footW = 5;
    const footD = origD * 0.82;
    const legH = tableH - topH;
    [-1, 1].forEach((side) => {
      const x = side * (origW / 2 - 7);
      const leg = makeRoundedBox(5.5, legH, 5.5, 1.2, frameColor, { roughness: 0.45, edgeOpacity: 0.32 });
      leg.position.set(x, legH / 2, 0);
      group.add(leg);

      const foot = makeRoundedBox(footW, 3.2, footD, 1.4, metalColor, { roughness: 0.42, edgeOpacity: 0.30 });
      foot.position.set(x, 1.6, 0);
      group.add(foot);
    });

    const control = makeRoundedBox(Math.min(24, origW * 0.16), 2.4, 10, 1.0, '#20242a', { roughness: 0.45, edgeOpacity: 0.34 });
    control.position.set(origW / 2 - 18, tableH - topH - 2.8, origD / 2 - 8);
    group.add(control);
  }

  function addSaylChairModel(group, origW, origH, origD) {
    const seatY = Math.min(46, Math.max(38, origH * 0.5));
    const seatThick = 6;
    const shellColor = '#9b9187';
    const darkColor = '#22201f';
    const metalColor = '#777c82';

    const seat = makeRoundedBox(origW * 0.78, seatThick, origD * 0.72, 5, shellColor, { roughness: 0.58, edgeOpacity: 0.32 });
    seat.position.set(0, seatY, 2);
    group.add(seat);

    const backH = Math.max(34, origH - seatY + 6);
    const back = makeRoundedBox(origW * 0.72, backH, 4.2, 5, shellColor, { roughness: 0.60, edgeOpacity: 0.34 });
    back.position.set(0, seatY + backH / 2 - 1, -origD * 0.34);
    back.rotation.x = -0.16;
    group.add(back);

    const spine = makeRoundedBox(7, backH * 0.85, 5, 2, darkColor, { roughness: 0.48, edgeOpacity: 0.38 });
    spine.position.set(0, seatY + backH * 0.42, -origD * 0.38);
    spine.rotation.x = -0.12;
    group.add(spine);

    [-1, 1].forEach((side) => {
      const support = makeRoundedBox(2.2, 20, 3.2, 0.9, darkColor, { roughness: 0.45, edgeOpacity: 0.38 });
      support.position.set(side * origW * 0.42, seatY + 7, -origD * 0.03);
      support.rotation.z = side * 0.12;
      group.add(support);

      const arm = makeRoundedBox(5, 2.2, origD * 0.48, 1.6, darkColor, { roughness: 0.42, edgeOpacity: 0.38 });
      arm.position.set(side * origW * 0.42, seatY + 18, 0);
      group.add(arm);
    });

    const column = makeRoundedBox(6, seatY - seatThick / 2, 6, 2.4, darkColor, { roughness: 0.42, edgeOpacity: 0.38 });
    column.position.set(0, (seatY - seatThick / 2) / 2, 0);
    group.add(column);

    const baseRadius = origW * 0.42;
    for (let angle = 0; angle < 360; angle += 72) {
      const rad = angle * Math.PI / 180;
      const prong = makeRoundedBox(4, 2.6, baseRadius, 1.1, metalColor, { roughness: 0.45, edgeOpacity: 0.34 });
      prong.position.set(Math.sin(rad) * baseRadius / 2, 2.2, Math.cos(rad) * baseRadius / 2);
      prong.rotation.y = rad;
      group.add(prong);

      const wheel = makeRoundedBox(6, 4, 4, 1.8, darkColor, { roughness: 0.40, edgeOpacity: 0.40 });
      wheel.position.set(Math.sin(rad) * baseRadius, 2.5, Math.cos(rad) * baseRadius);
      group.add(wheel);
    }
  }

  /** Build the gondola structure + placed products from current state. */
  function buildScene() {
    if (contentGroup) {
      scene.remove(contentGroup);
      disposeGroup(contentGroup);
    }
    contentGroup = new THREE.Group();
    scene.add(contentGroup);

    if (window.TopViewLayout && TopViewLayout.isActive()) {
      return buildTopviewScene();
    }

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
      new THREE.MeshStandardMaterial({ color: to3Color('#e5e9f0'), roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.2;
    floor.receiveShadow = true;
    contentGroup.add(floor);

    const grid = new THREE.GridHelper(Math.max(W, D) * 4, Math.round(Math.max(W, D) * 4 / 20), 0xc4cbd4, 0xd6dce3);
    grid.position.y = 0;
    contentGroup.add(grid);

    // ── Gondola base (kick plate) — matches the shelf color, not a fixed grey ──
    const base = makeBox(W, thick, D, s.shelfColor);
    base.position.set(0, thick / 2, 0);
    contentGroup.add(base);

    // ── Back panel — doesn't receive shadows, so shelf boards in narrow/deep
    // segments don't cast a harsh diagonal band across it ──
    if (s.hasBackPanel) {
      const back = makeBox(W, H, panelT, s.backColor, { receive: false });
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
        const div = makeBox(panelT, H, D, '#9ca3af', { roughness: 0.5 });
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
        if (seg !== 0 && s.hasDivider) leftBound += panelT / 2;

        let rightBound = segLeft + segW;
        if (seg !== segCount - 1 && s.hasDivider) rightBound -= panelT / 2;

        const boardW = Math.max(0, rightBound - leftBound);
        const boardX = (leftBound + rightBound) / 2;

        const board = makeBox(boardW, thick, D - 0.4, s.shelfColor);
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

        const cellH = segHeights[i];
        const maxH = Math.max(2, cellH - thick); // Clamp to prevent vertical overflow

        placed.forEach((col) => {
          const colW = colMetrics(col, D).width;
          let zFront = D / 2 - frontPad; // front face of the next layer, walks toward the back panel
          depthLayers(col).forEach((layer) => {
            let yBottom = surfaceY + thick; // products in one depth layer pile up, bottom→top
            let layerDepth = 0;
            stackIds(layer).forEach((pid) => {
              const p = list.find((q) => q.id === pid);
              if (!p) return;
              const facing = p.facing || 1;
              const dims = getProductDimensions(p, D);
              const w = dims.width * facing;
              const h = Math.min(dims.height, maxH); // Clamp product height to cell space
              const d = dims.depth;

              const stack = Math.max(1, p.stack || 1);
              const rows = depthRows(p, D).used;
              // Butted up against each other the rows read as one long block, so
              // split them with whatever depth is left over — never more.
              const slack = Math.max(0, zFront + D / 2 - rows * d);
              const rowGap = rows > 1 ? Math.min(0.5, slack / (rows - 1)) : 0;
              const base = makeProduct(p, w, h, d);
              for (let k = 0; k < stack; k++) {
                for (let r = 0; r < rows; r++) {
                  const mesh = (k === 0 && r === 0) ? base : base.clone();
                  mesh.position.set(
                    cursorX + (colW - w) / 2 + w / 2, // centre narrower products in the column
                    yBottom + h / 2 + k * h,
                    zFront - d / 2 - r * (d + rowGap)
                  );
                  contentGroup.add(mesh);
                }
              }
              yBottom += stack * h;
              layerDepth = Math.max(layerDepth, rows * d + (rows - 1) * rowGap);
            });
            zFront -= layerDepth + 0.5; // next depth layer sits behind this one
          });
          cursorX += colW + 0.6; // tiny gap between SKUs
        });
      }
    }

    return { W, H };
  }

  function frameCamera(W, H) {
    if (window.TopViewLayout && TopViewLayout.isActive()) {
      const spec = TopViewLayout.getSpec();
      const span = Math.max(spec.width, spec.depth);
      controls.target.set(0, 28, 0);
      camera.position.set(span * 0.62, span * 0.76, span * 0.92);
      camera.updateProjectionMatrix();

      const key = scene.userData.keyLight;
      const cam = key.shadow.camera;
      const r = span * 0.72;
      cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
      cam.near = 1; cam.far = 3000;
      cam.updateProjectionMatrix();
      return;
    }

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

  function buildTopviewScene() {
    const spec = TopViewLayout.getSpec();
    const items = TopViewLayout.getPlacedItems();
    const W = spec.width;
    const D = spec.depth;
    const H = 220; // Default height reference for framing camera
    
    // ── Floor: room plane ──
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W, D),
      new THREE.MeshStandardMaterial({ color: to3Color('#dde3e8'), roughness: 0.92 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    contentGroup.add(floor);

    // ── Grid helper ──
    const grid = new THREE.GridHelper(Math.max(W, D), Math.round(Math.max(W, D) / spec.gridSize), 0x7f8790, 0xc6ced7);
    grid.position.y = 0.1;
    contentGroup.add(grid);

    // ── Room Walls (low border walls) ──
    const wallThick = 4;
    const wallH = 15;
    
    // Back wall
    const wallB = makeBox(W, wallH, wallThick, '#c9c3b8', { cast: false, edgeOpacity: 0.22 });
    wallB.position.set(0, wallH/2, -D/2 - wallThick/2);
    contentGroup.add(wallB);
    
    // Left wall
    const wallL = makeBox(wallThick, wallH, D, '#c9c3b8', { cast: false, edgeOpacity: 0.22 });
    wallL.position.set(-W/2 - wallThick/2, wallH/2, 0);
    contentGroup.add(wallL);

    // Right wall
    const wallR = makeBox(wallThick, wallH, D, '#c9c3b8', { cast: false, edgeOpacity: 0.22 });
    wallR.position.set(W/2 + wallThick/2, wallH/2, 0);
    contentGroup.add(wallR);

    // Front wall
    const wallF = makeBox(W, wallH, wallThick, '#c9c3b8', { cast: false, edgeOpacity: 0.22 });
    wallF.position.set(0, wallH/2, D/2 + wallThick/2);
    contentGroup.add(wallF);

    // ── Render placed items ──
    const list = (typeof products !== 'undefined') ? products : [];
    const thick = 3;
    const frontPad = 0;
    
    items.forEach((item) => {
      const p = list.find((q) => q.id === item.productId);
      if (!p) return;

      const origW = parseCm(p.width, 10);
      const origH = parseCm(p.height, 10);
      const origD = parseCm(p.depth, 10);

      // Create a 3D group to handle position and rotation
      const itemGroup = new THREE.Group();
      const color = p.color || '#cccccc';
      const kind = product3DKind(p);

      // Procedural custom modeling based on category/name
      if (kind === 'nevi-desk') {
        addNeviDeskModel(itemGroup, origW, origH, origD);
      }
      else if (kind === 'sayl-chair') {
        addSaylChairModel(itemGroup, origW, origH, origD);
      }
      else if (kind === 'table') {
        // Table: top + modesty panel + drawers + 4 legs
        const topH = 3.5;
        const legW = 3.5;
        const tableH = origH || 75;
        const legH = tableH - topH;
        
        // Table top
        let top;
        if (p.image) {
          const tex = textureLoader.load(p.image);
          tex.encoding = THREE.sRGBEncoding;
          const imgMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.02 });
          const sideMat = new THREE.MeshStandardMaterial({ color: to3Color(color), roughness: 0.48, metalness: 0.02 });
          const mats = [sideMat, sideMat, imgMat, sideMat, imgMat, sideMat];
          top = new THREE.Mesh(new THREE.BoxGeometry(origW, topH, origD), mats);
          top.castShadow = true;
          top.receiveShadow = true;
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(top.geometry),
            new THREE.LineBasicMaterial({ color: 0x2a2f36, transparent: true, opacity: 0.08 })
          );
          top.add(edges);
        } else {
          top = makeRoundedBox(origW, topH, origD, 2.5, color);
        }
        top.position.set(0, tableH - topH/2, 0);
        itemGroup.add(top);

        // Modesty Panel (privacy screen between legs)
        const panelW = origW - 8;
        const panelH = legH * 0.55;
        const panelD = 1.2;
        const modesty = makeRoundedBox(panelW, panelH, panelD, 0.6, '#4a4d53');
        modesty.position.set(0, legH - panelH/2, -origD/2 + panelD/2 + 2);
        itemGroup.add(modesty);

        // Drawer Unit (under desk)
        const drawerW = Math.min(32, origW * 0.35);
        const drawerH = legH - 6;
        const drawerD = origD - 6;
        const drawer = makeRoundedBox(drawerW, drawerH, drawerD, 1.5, color);
        drawer.position.set(origW/2 - drawerW/2 - 4, drawerH/2 + 2, -1);
        itemGroup.add(drawer);

        // Drawer handles (metal lines)
        for (let j = 0; j < 3; j++) {
          const dy = (drawerH/3) * (j + 0.5) + 2;
          const handle = makeRoundedBox(drawerW * 0.5, 1.2, 1.5, 0.4, '#c1c6cd');
          handle.position.set(origW/2 - drawerW/2 - 4, dy, drawerD/2 - 0.5);
          itemGroup.add(handle);
        }

        // 4 Legs
        const legPositions = [
          [-origW/2 + legW/2, -origD/2 + legW/2],
          [origW/2 - legW/2, -origD/2 + legW/2],
          [-origW/2 + legW/2, origD/2 - legW/2],
          [origW/2 - legW/2, origD/2 - legW/2]
        ];
        legPositions.forEach(([lx, lz]) => {
          const inDrawerZone = (lx > origW/2 - drawerW - 8);
          if (inDrawerZone) {
            // Shorter support leg under drawers
            const shortLegH = 2;
            const leg = makeRoundedBox(legW, shortLegH, legW, 0.8, '#2a2f36');
            leg.position.set(lx, shortLegH/2, lz);
            itemGroup.add(leg);
          } else {
            const leg = makeRoundedBox(legW, legH, legW, 0.8, '#3a3a3a');
            leg.position.set(lx, legH/2, lz);
            itemGroup.add(leg);
          }
        });
      } 
      else if (kind === 'chair') {
        // Chair: seat + armrests + backrest frame + cylinder shaft + 5 prongs + wheels
        const seatH = 45;
        const seatThick = 6;
        
        // Seat cushion & backrest
        let seat, backrest;
        const backH = origH - seatH;
        const backW = origW * 0.8;
        const backD = 3;

        if (p.image) {
          const tex = textureLoader.load(p.image);
          tex.encoding = THREE.sRGBEncoding;
          const imgMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.02 });
          const sideMat = new THREE.MeshStandardMaterial({ color: to3Color(color), roughness: 0.48, metalness: 0.02 });
          
          // seat gets image on top (+Y)
          const seatMats = [sideMat, sideMat, imgMat, sideMat, sideMat, sideMat];
          seat = new THREE.Mesh(new THREE.BoxGeometry(origW * 0.9, seatThick, origD * 0.9), seatMats);
          seat.castShadow = true;
          seat.receiveShadow = true;
          const seatEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(seat.geometry),
            new THREE.LineBasicMaterial({ color: 0x2a2f36, transparent: true, opacity: 0.08 })
          );
          seat.add(seatEdges);
          
          // backrest gets image on front (+Z) and top (+Y)
          const backMats = [sideMat, sideMat, imgMat, sideMat, imgMat, sideMat];
          backrest = new THREE.Mesh(new THREE.BoxGeometry(backW, backH, backD), backMats);
          backrest.castShadow = true;
          backrest.receiveShadow = true;
          const backEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(backrest.geometry),
            new THREE.LineBasicMaterial({ color: 0x2a2f36, transparent: true, opacity: 0.08 })
          );
          backrest.add(backEdges);
        } else {
          seat = makeRoundedBox(origW * 0.9, seatThick, origD * 0.9, 3.0, color);
          backrest = makeRoundedBox(backW, backH, backD, 3.0, color);
        }

        seat.position.set(0, seatH - seatThick/2, 0);
        itemGroup.add(seat);

        // Armrests (L-shaped supports + pads)
        const armW = 4;
        const armH = 14;
        const armD = origD * 0.55;
        [-1, 1].forEach((side) => {
          const support = makeRoundedBox(1.5, armH, 3, 0.5, '#2a2a2a');
          support.position.set(side * (origW * 0.45), seatH + armH/2 - seatThick, 0);
          itemGroup.add(support);
          
          const pad = makeRoundedBox(armW, 2, armD, 1.0, '#151515');
          pad.position.set(side * (origW * 0.45), seatH + armH - 1, 0);
          itemGroup.add(pad);
        });

        backrest.position.set(0, seatH + backH/2, -origD/2 + backD/2 + 2);
        itemGroup.add(backrest);

        // Lumbar support strap
        const lumbar = makeRoundedBox(backW * 0.85, 4, backD + 1, 1.5, '#111111', { cast: false });
        lumbar.position.set(0, seatH + backH * 0.25, -origD/2 + backD/2 + 2);
        itemGroup.add(lumbar);

        // Center cylinder column
        const colH = seatH - seatThick;
        const col = makeRoundedBox(6, colH, 6, 2.0, '#222222');
        col.position.set(0, colH/2, 0);
        itemGroup.add(col);
        
        // 5-Star wheeled base
        const baseRadius = origW * 0.45;
        for (let angle = 0; angle < 360; angle += 72) {
          const rad = angle * Math.PI / 180;
          
          // Base prongs
          const prong = makeRoundedBox(4, 2.5, baseRadius, 1.0, color);
          prong.position.set(Math.sin(rad) * baseRadius/2, 2.5/2, Math.cos(rad) * baseRadius/2);
          prong.rotation.y = rad;
          itemGroup.add(prong);

          // Caster wheels
          const wheel = makeRoundedBox(4.5, 4.5, 4.5, 2.2, '#111111');
          wheel.position.set(Math.sin(rad) * baseRadius, 4.5/2, Math.cos(rad) * baseRadius);
          itemGroup.add(wheel);
        }
      } 
      else if (kind === 'shelf') {
        // Fixture shelf: back + 2 sides + 4 shelves
        const shelfW = origW;
        const shelfH = origH || 180;
        const shelfD = origD;
        const sideT = 2.5;
        const backT = 1.5;
        
        // Back panel
        let back;
        if (p.image) {
          const tex = textureLoader.load(p.image);
          tex.encoding = THREE.sRGBEncoding;
          const imgMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.02 });
          const sideMat = new THREE.MeshStandardMaterial({ color: to3Color('#3a3a3a'), roughness: 0.48, metalness: 0.02 });
          const mats = [sideMat, sideMat, sideMat, sideMat, imgMat, sideMat]; // +Z is front
          back = new THREE.Mesh(new THREE.BoxGeometry(shelfW, shelfH, backT), mats);
          back.castShadow = true;
          back.receiveShadow = true;
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(back.geometry),
            new THREE.LineBasicMaterial({ color: 0x2a2f36, transparent: true, opacity: 0.08 })
          );
          back.add(edges);
        } else {
          back = makeRoundedBox(shelfW, shelfH, backT, 1.2, '#3a3a3a');
        }
        back.position.set(0, shelfH/2, -shelfD/2 + backT/2);
        itemGroup.add(back);

        // 2 Side panels
        [-1, 1].forEach((sign) => {
          const side = makeRoundedBox(sideT, shelfH, shelfD, 1.0, color);
          side.position.set(sign * (shelfW/2 - sideT/2), shelfH/2, 0);
          itemGroup.add(side);
        });

        // 4 Shelves boards
        const boardThick = 2;
        const count = 4;
        for (let j = 0; j < count; j++) {
          const sy = (shelfH / count) * (j + 0.5);
          const board = makeRoundedBox(shelfW - sideT * 2, boardThick, shelfD - 2, 0.8, color);
          board.position.set(0, sy, 0);
          itemGroup.add(board);
        }
      } 
      else if (kind === 'bed') {
        // Bed: base block + headboard + pillows
        const bedH = origH || 45;
        const headH = 95;
        const headT = 6;
        
        // Mattress base
        let base;
        if (p.image) {
          const tex = textureLoader.load(p.image);
          tex.encoding = THREE.sRGBEncoding;
          const imgMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.02 });
          const sideMat = new THREE.MeshStandardMaterial({ color: to3Color(color), roughness: 0.48, metalness: 0.02 });
          const mats = [sideMat, sideMat, imgMat, sideMat, imgMat, sideMat];
          base = new THREE.Mesh(new THREE.BoxGeometry(origW, bedH, origD - headT), mats);
          base.castShadow = true;
          base.receiveShadow = true;
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(base.geometry),
            new THREE.LineBasicMaterial({ color: 0x2a2f36, transparent: true, opacity: 0.08 })
          );
          base.add(edges);
        } else {
          base = makeRoundedBox(origW, bedH, origD - headT, 5.0, color);
        }
        base.position.set(0, bedH/2, headT/2);
        itemGroup.add(base);

        // Headboard
        const head = makeRoundedBox(origW, headH, headT, 3.0, '#20242a');
        head.position.set(0, headH/2, -origD/2 + headT/2);
        itemGroup.add(head);

        // Pillow
        const pillow = makeRoundedBox(origW * 0.72, 6, origD * 0.18, 2.5, '#ffffff');
        pillow.position.set(0, bedH + 3, -origD/2 + headT + (origD * 0.18)/2 + 4);
        itemGroup.add(pillow);
      } 
      else {
        // Default generic furniture box
        let defaultBox;
        if (p.image) {
          const tex = textureLoader.load(p.image);
          tex.encoding = THREE.sRGBEncoding;
          const imgMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.02 });
          const sideMat = new THREE.MeshStandardMaterial({ color: to3Color(color), roughness: 0.48, metalness: 0.02 });
          const mats = [sideMat, sideMat, imgMat, sideMat, imgMat, sideMat];
          defaultBox = new THREE.Mesh(new THREE.BoxGeometry(origW, origH, origD), mats);
          defaultBox.castShadow = true;
          defaultBox.receiveShadow = true;
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(defaultBox.geometry),
            new THREE.LineBasicMaterial({ color: 0x20242a, transparent: true, opacity: 0.08 })
          );
          defaultBox.add(edges);
        } else {
          defaultBox = makeRoundedBox(origW, origH, origD, 3.0, color);
        }
        defaultBox.position.set(0, origH/2, 0);
        itemGroup.add(defaultBox);
      }

      // Convert coordinates
      const isRotated = (item.rotation === 90 || item.rotation === 270);
      const w = isRotated ? origD : origW;
      const d = isRotated ? origW : origD;

      const posX = item.x + w / 2 - W / 2;
      const posZ = item.y + d / 2 - D / 2;

      itemGroup.position.set(posX, 0, posZ);
      itemGroup.rotation.y = -item.rotation * Math.PI / 180;

      contentGroup.add(itemGroup);
    });

    return { W, H: Math.max(W, D) * 0.5 };
  }

  // ── Public API ──
  function open() {
    if (!ensureInit()) return;
    const host = container();
    host.style.display = 'block';
    
    const board = (window.TopViewLayout && TopViewLayout.isActive()) ? $('topviewArea') : $('exportArea');
    if (board) board.style.display = 'none';
    
    resize();
    const dims = buildScene();
    frameCamera(dims.W, dims.H);
    if (!rafId) animate();
  }

  function close() {
    const host = container();
    if (host) host.style.display = 'none';
    
    const isTopview = (window.TopViewLayout && TopViewLayout.isActive());
    const board = isTopview ? $('topviewArea') : $('exportArea');
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
