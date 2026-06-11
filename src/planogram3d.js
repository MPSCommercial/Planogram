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

        const cellH = segHeights[i];
        const maxH = Math.max(2, cellH - thick); // Clamp to prevent vertical overflow

        placed.forEach((pid) => {
          const p = list.find((q) => q.id === pid);
          if (!p) return;
          const facing = p.facing || 1;
          const dims = getProductDimensions(p, D);
          const w = dims.width * facing;
          const h = Math.min(dims.height, maxH); // Clamp product height to cell space
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

  function buildTopviewScene() {
    const spec = TopViewLayout.getSpec();
    const items = TopViewLayout.getPlacedItems();
    const W = spec.width;
    const D = spec.depth;
    const H = 220; // Default height reference for framing camera
    
    // ── Floor: room plane ──
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W, D),
      new THREE.MeshStandardMaterial({ color: '#f2f1ec', roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    contentGroup.add(floor);

    // ── Grid helper ──
    const grid = new THREE.GridHelper(Math.max(W, D), Math.round(Math.max(W, D) / spec.gridSize), 0x90949a, 0xd6dce3);
    grid.position.y = 0.1;
    contentGroup.add(grid);

    // ── Room Walls (low border walls) ──
    const wallThick = 4;
    const wallH = 15;
    
    // Back wall
    const wallB = makeBox(W, wallH, wallThick, '#e2dfd5', { cast: false });
    wallB.position.set(0, wallH/2, -D/2 - wallThick/2);
    contentGroup.add(wallB);
    
    // Left wall
    const wallL = makeBox(wallThick, wallH, D, '#e2dfd5', { cast: false });
    wallL.position.set(-W/2 - wallThick/2, wallH/2, 0);
    contentGroup.add(wallL);

    // Right wall
    const wallR = makeBox(wallThick, wallH, D, '#e2dfd5', { cast: false });
    wallR.position.set(W/2 + wallThick/2, wallH/2, 0);
    contentGroup.add(wallR);

    // Front wall
    const wallF = makeBox(W, wallH, wallThick, '#e2dfd5', { cast: false });
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

      // Procedural custom modeling based on category/name
      if (p.name.includes('Office Table') || p.name.includes('โต๊ะ')) {
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
          const imgMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
          const sideMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.6 });
          const mats = [sideMat, sideMat, imgMat, sideMat, imgMat, sideMat];
          top = new THREE.Mesh(new THREE.BoxGeometry(origW, topH, origD), mats);
          top.castShadow = true;
          top.receiveShadow = true;
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(top.geometry),
            new THREE.LineBasicMaterial({ color: 0x2a2f36, transparent: true, opacity: 0.28 })
          );
          top.add(edges);
        } else {
          top = makeBox(origW, topH, origD, color);
        }
        top.position.set(0, tableH - topH/2, 0);
        itemGroup.add(top);

        // Modesty Panel (privacy screen between legs)
        const panelW = origW - 8;
        const panelH = legH * 0.55;
        const panelD = 1.2;
        const modesty = makeBox(panelW, panelH, panelD, '#4a4d53');
        modesty.position.set(0, legH - panelH/2, -origD/2 + panelD/2 + 2);
        itemGroup.add(modesty);

        // Drawer Unit (under desk)
        const drawerW = Math.min(32, origW * 0.35);
        const drawerH = legH - 6;
        const drawerD = origD - 6;
        const drawer = makeBox(drawerW, drawerH, drawerD, color);
        drawer.position.set(origW/2 - drawerW/2 - 4, drawerH/2 + 2, -1);
        itemGroup.add(drawer);

        // Drawer handles (metal lines)
        for (let j = 0; j < 3; j++) {
          const dy = (drawerH/3) * (j + 0.5) + 2;
          const handle = makeBox(drawerW * 0.5, 1.2, 1.5, '#c1c6cd');
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
            const leg = makeBox(legW, shortLegH, legW, '#2a2f36');
            leg.position.set(lx, shortLegH/2, lz);
            itemGroup.add(leg);
          } else {
            const leg = makeBox(legW, legH, legW, '#3a3a3a');
            leg.position.set(lx, legH/2, lz);
            itemGroup.add(leg);
          }
        });
      } 
      else if (p.name.includes('Office Chair') || p.name.includes('เก้าอี้')) {
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
          const imgMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
          const sideMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.6 });
          
          // seat gets image on top (+Y)
          const seatMats = [sideMat, sideMat, imgMat, sideMat, sideMat, sideMat];
          seat = new THREE.Mesh(new THREE.BoxGeometry(origW * 0.9, seatThick, origD * 0.9), seatMats);
          seat.castShadow = true;
          seat.receiveShadow = true;
          const seatEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(seat.geometry),
            new THREE.LineBasicMaterial({ color: 0x2a2f36, transparent: true, opacity: 0.28 })
          );
          seat.add(seatEdges);
          
          // backrest gets image on front (+Z) and top (+Y)
          const backMats = [sideMat, sideMat, imgMat, sideMat, imgMat, sideMat];
          backrest = new THREE.Mesh(new THREE.BoxGeometry(backW, backH, backD), backMats);
          backrest.castShadow = true;
          backrest.receiveShadow = true;
          const backEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(backrest.geometry),
            new THREE.LineBasicMaterial({ color: 0x2a2f36, transparent: true, opacity: 0.28 })
          );
          backrest.add(backEdges);
        } else {
          seat = makeBox(origW * 0.9, seatThick, origD * 0.9, color);
          backrest = makeBox(backW, backH, backD, color);
        }

        seat.position.set(0, seatH - seatThick/2, 0);
        itemGroup.add(seat);

        // Armrests (L-shaped supports + pads)
        const armW = 4;
        const armH = 14;
        const armD = origD * 0.55;
        [-1, 1].forEach((side) => {
          const support = makeBox(1.5, armH, 3, '#2a2a2a');
          support.position.set(side * (origW * 0.45), seatH + armH/2 - seatThick, 0);
          itemGroup.add(support);
          
          const pad = makeBox(armW, 2, armD, '#151515');
          pad.position.set(side * (origW * 0.45), seatH + armH - 1, 0);
          itemGroup.add(pad);
        });

        backrest.position.set(0, seatH + backH/2, -origD/2 + backD/2 + 2);
        itemGroup.add(backrest);

        // Lumbar support strap
        const lumbar = makeBox(backW * 0.85, 4, backD + 1, '#111111', { cast: false });
        lumbar.position.set(0, seatH + backH * 0.25, -origD/2 + backD/2 + 2);
        itemGroup.add(lumbar);

        // Center cylinder column
        const colH = seatH - seatThick;
        const col = makeBox(6, colH, 6, '#222222');
        col.position.set(0, colH/2, 0);
        itemGroup.add(col);
        
        // 5-Star wheeled base
        const baseRadius = origW * 0.45;
        for (let angle = 0; angle < 360; angle += 72) {
          const rad = angle * Math.PI / 180;
          
          // Base prongs
          const prong = makeBox(4, 2.5, baseRadius);
          prong.position.set(Math.sin(rad) * baseRadius/2, 2.5/2, Math.cos(rad) * baseRadius/2);
          prong.rotation.y = rad;
          itemGroup.add(prong);

          // Caster wheels
          const wheel = makeBox(4.5, 4.5, 4.5, '#111111');
          wheel.position.set(Math.sin(rad) * baseRadius, 4.5/2, Math.cos(rad) * baseRadius);
          itemGroup.add(wheel);
        }
      } 
      else if (p.name.includes('Fixture Shelf') || p.name.includes('ชั้นวาง')) {
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
          const imgMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
          const sideMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a3a3a'), roughness: 0.6 });
          const mats = [sideMat, sideMat, sideMat, sideMat, imgMat, sideMat]; // +Z is front
          back = new THREE.Mesh(new THREE.BoxGeometry(shelfW, shelfH, backT), mats);
          back.castShadow = true;
          back.receiveShadow = true;
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(back.geometry),
            new THREE.LineBasicMaterial({ color: 0x2a2f36, transparent: true, opacity: 0.28 })
          );
          back.add(edges);
        } else {
          back = makeBox(shelfW, shelfH, backT, '#3a3a3a');
        }
        back.position.set(0, shelfH/2, -shelfD/2 + backT/2);
        itemGroup.add(back);

        // 2 Side panels
        [-1, 1].forEach((sign) => {
          const side = makeBox(sideT, shelfH, shelfD, color);
          side.position.set(sign * (shelfW/2 - sideT/2), shelfH/2, 0);
          itemGroup.add(side);
        });

        // 4 Shelves boards
        const boardThick = 2;
        const count = 4;
        for (let j = 0; j < count; j++) {
          const sy = (shelfH / count) * (j + 0.5);
          const board = makeBox(shelfW - sideT * 2, boardThick, shelfD - 2, color);
          board.position.set(0, sy, 0);
          itemGroup.add(board);
        }
      } 
      else if (p.name.includes('Bed') || p.name.includes('เตียง')) {
        // Bed: base block + headboard + pillows
        const bedH = origH || 45;
        const headH = 95;
        const headT = 6;
        
        // Mattress base
        let base;
        if (p.image) {
          const tex = textureLoader.load(p.image);
          tex.encoding = THREE.sRGBEncoding;
          const imgMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
          const sideMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.6 });
          const mats = [sideMat, sideMat, imgMat, sideMat, imgMat, sideMat];
          base = new THREE.Mesh(new THREE.BoxGeometry(origW, bedH, origD - headT), mats);
          base.castShadow = true;
          base.receiveShadow = true;
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(base.geometry),
            new THREE.LineBasicMaterial({ color: 0x2a2f36, transparent: true, opacity: 0.28 })
          );
          base.add(edges);
        } else {
          base = makeBox(origW, bedH, origD - headT, color);
        }
        base.position.set(0, bedH/2, headT/2);
        itemGroup.add(base);

        // Headboard
        const head = makeBox(origW, headH, headT, '#20242a');
        head.position.set(0, headH/2, -origD/2 + headT/2);
        itemGroup.add(head);

        // Pillow
        const pillow = makeBox(origW * 0.72, 6, origD * 0.18, '#ffffff');
        pillow.position.set(0, bedH + 3, -origD/2 + headT + (origD * 0.18)/2 + 4);
        itemGroup.add(pillow);
      } 
      else {
        // Default generic furniture box
        let defaultBox;
        if (p.image) {
          const tex = textureLoader.load(p.image);
          tex.encoding = THREE.sRGBEncoding;
          const imgMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
          const sideMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.6 });
          const mats = [sideMat, sideMat, imgMat, sideMat, imgMat, sideMat];
          defaultBox = new THREE.Mesh(new THREE.BoxGeometry(origW, origH, origD), mats);
          defaultBox.castShadow = true;
          defaultBox.receiveShadow = true;
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(defaultBox.geometry),
            new THREE.LineBasicMaterial({ color: 0x20242a, transparent: true, opacity: 0.32 })
          );
          defaultBox.add(edges);
        } else {
          defaultBox = makeBox(origW, origH, origD, color);
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
