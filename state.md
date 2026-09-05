# Planogram

> **AI**: อ่านเฉพาะส่วน ⚡ NOW ก่อนเริ่มงานทุกครั้ง — อ่านส่วน 📜 LOG เฉพาะเมื่อผู้ใช้ถามเรื่อง history หรือเมื่อต้อง archive NOW เก่า
> **Human**: อัปเดต NOW ทุกครั้งที่ทำงานเสร็จ แล้ว archive NOW เก่าลง LOG

---

## ⚡ NOW
- **Status**: Commit + push main และ deploy สำเร็จ: Studio/Sketch 3D, toolbar แยกเหนือ canvas และ Top View batch placement จากคลัง
- **Feature commit**: `7c79564` — feat: add studio 3D views and top-view batch placement
- **Live**: https://planogram-mpsynergy.surge.sh และ https://mpscommercial.github.io/Planogram/
- **Validation**: Surge CLI Success; GitHub Pages build ของ `7c79564` = built; ตรวจ HTTP ไฟล์ `index.html`, `src/planogram3d.js`, `src/topview.js`, `src/products.js`, `src/styles.css` บนทั้งสอง host ตรงกับ local ทุกไฟล์; batch/columns tests + syntax/diff checks ผ่าน
- **Scope**: Multi-select ใช้กับคลังสินค้า; การเลือก/ย้ายหลายตัวบนแปลนยังไม่ได้เพิ่ม
- **Next**: ใช้งานเวอร์ชัน live และเก็บ feedback
- **Working tree**: ไม่รวม `.DS_Store` ที่เปลี่ยนอยู่ก่อนแล้วใน commit

---

## 📜 LOG

### Archived NOW — before deployment 2026-09-06
- **Status**: Top View เลือกสินค้าจากคลังหลายตัวด้วย click/checkbox แล้วคลิกหรือลากวางทั้งชุด; เรียงแถวตาม grid, ไม่ล้นห้อง, ปฏิเสธทั้งชุดหากพื้นที่ไม่พอ, Undo/Redo เป็นชุด; Esc/ยกเลิกล้างการเลือก
- **3D**: แยก toolbar ออกจาก canvas ด้วย `viewport3d`; ResizeObserver และ camera framing ใช้ขนาด viewport จริง
- **Validation**: Browser เลือก 2 ตัว วางจาก 3 → 5 ชิ้น แล้ว Undo กลับ 3; วัด toolbarBottom <= canvasTop; `test/3d.html` PASS; `node test/topview-batch.test.js`, `node test/columns.test.js`, syntax และ diff checks ผ่าน
- **Scope**: Multi-select รอบนี้ใช้กับคลังสินค้า; การเลือก/ย้ายหลายตัวที่อยู่บนแปลนยังเป็นงานถัดไปหากต้องการ; ไม่มี deploy
- **Next**: ทดลองที่ `http://localhost:8765` ก่อน deploy
- **Files**: `src/topview.js`, `src/products.js`, `src/planogram3d.js`, `src/styles.css`, `index.html`, `test/topview-batch.test.js`, `test/3d.html`, `state.md`

---


### Archived NOW — before batch placement / toolbar fix
- **Status**: ปรับ 3D ร่วมของ Planogram / Top View เป็น architectural studio: procedural environment reflections, warm lighting, Studio/Sketch, Perspective/Front/Top orthographic และ Grid toggle; ปรับพื้น/เงา top view 2D
- **Validation**: Browser self-check `http://localhost:8765/test/3d.html` PASS (2 workspaces × 3 cameras, perpendicular top, render styles, grid bounds/spacing, close/reopen); ตรวจภาพ shelf, furniture room และพื้นแปลน 2D; `node test/columns.test.js` + JS syntax checks ผ่าน
- **Scope**: Real-time Three.js เดิม; ยังไม่ใช่ V-Ray ray tracing หรือ import SKP; ยังไม่ได้ deploy
- **Branch**: main
- **Next**: ทดลองกับ layout / product images จริงก่อน deploy; preview `http://localhost:8765`
- **Files**: `index.html`, `src/planogram3d.js`, `src/topview.js`, `src/styles.css`, `test/3d.html`, `state.md`

---


### Archived NOW — before 2026-09-06 studio views
- **Status**: Deploy โปรเจกต์เวอร์ชันล่าสุด (ลบปุ่มแก้ไข/ลบจากการ์ด product list, ปรับ UI แสดงสินค้าซ้อนแนวลึกให้เด่นชัด และคำนวณ cap ลึกตามจริง) ขึ้น Surge ที่ `planogram-mpsynergy.surge.sh` สำเร็จเรียบร้อย
- **Live URL**: `https://planogram-mpsynergy.surge.sh` (และ `https://mpscommercial.github.io/Planogram/`)
- **Branch**: main
- **Blocker**: ไม่มี
- **Next**: ตรวจสอบการแสดงผลบน live site และทดสอบการซ้อนสินค้าบน browser
- **Files**: `src/products.js`, `src/planogram.js`, `src/styles.css`, `src/utils.js`, `state.md`

---


### 🗓️ 2026-09-05
- ✅ Previous NOW: อัปเดต GitHub `main` ด้วยระบบวางสินค้าซ้อน 2 แกนใน Planogram — รองรับซ้อนแนวตั้งและแนวลึก, ลากเพื่อซ้อน, จัดลำดับ/ลบสินค้าใน inspector, depth alignment, shelf lock, popup clamp และสเกลจริง; test ผ่านใน commit `0e6934f`
- Files: `index.html`, `src/app.js`, `src/i18n.js`, `src/planogram.js`, `src/planogram3d.js`, `src/styles.css`, `src/utils.js`, `test/columns.test.js`, `state.md`

### 🗓️ 2026-09-02
- ✅ Previous NOW: ปรับแก้การแสดงผลสีในมุมมอง 3D (Three.js) ให้สีอิ่มสวย ไม่ซีดขาว ด้วย sRGB-to-linear conversion, ACES tone mapping, แสง และ material ที่สมดุลขึ้น
- Files: `src/planogram3d.js`, `state.md`

### 🗓️ 2026-08-22
- ✅ Previous NOW: ปรับแก้ระบบ Color Management และแสงเงาใน Three.js 3D View แก้ปัญหาสีเชลฟ์และวัสดุซีดขาว
- Files: `src/planogram3d.js`, `state.md`

### 🗓️ 2026-08-21
- ✅ Previous NOW: เพิ่มระบบ "หลายเชลฟ์" (Multi-Board) — เพิ่มเชลฟ์ได้มากกว่า 1 อันในหน้าเดียว ตั้งชื่อฝั่งได้ (ซ้าย/ขวา/หลัง ฯลฯ); ปุ่มสลับภาษา TH/EN สำหรับ UI หลัก (default เป็น EN); เทมเพลตเชลฟ์ใหม่ "เชลฟ์ไม้-ส้ม" พร้อม thumbnail; แก้บั๊กแนวลึกสินค้า (`depth rows`); ย่อขนาด summary card และ board tile ให้กระชับขึ้น
- Files: `index.html`, `src/multiBoard.js`, `src/i18n.js`, `src/utils.js`, `src/planogram.js`, `src/topview.js`, `src/templates.js`, `src/app.js`, `src/styles.css`, `assets/templates/shelf-wood-orange.png`, `state.md`
- ✅ Previous NOW: live spec อัปเดตทันทีที่แก้ไข (ไม่ต้องกดปุ่ม build ใหม่ — เอาปุ่ม "สร้าง/อัปเดต Shelf" ที่ซ้ำซ้อนออก); เพิ่ม shelf template ใหม่ "เชลฟ์ใหม่ (ส้ม-ขาว)" (ERGOTREND 1200×1500×450mm) พร้อม thumbnail รูปจริงในทุกเทมเพลต; stock export default เติมคอลัมน์ สต็อก ให้ก่อน (เว้น ตัวโชว์ ให้กรอกเอง); 3D view เพิ่มปุ่ม "รีเซ็ตมุมมอง" และแก้บั๊กแผ่นชั้นไม่เต็มความกว้าง segment ตอน apply template; README ชี้ลิงก์ deploy ไปที่ GitHub Pages
- Files: `README.md`, `index.html`, `src/app.js`, `src/export.js`, `src/planogram3d.js`, `src/styles.css`, `src/templates.js`, `assets/products/`, `assets/templates/`

### 🗓️ 2026-08-20
- ✅ Previous NOW: ตั้งค่า default shelf spec ในหน้าเปิดแอปให้เป็น "เชลฟ์ส้ม" (อ้างอิงสเปค ERGOTREND 950×350×1420mm) — 1 segment, 3 shelves, สีส้ม `#c1571f` ทั้ง back panel และ shelf; ที่ปรับได้หลังจากนี้ยังเหมือนเดิมคือจำนวนชั้นวาง (`shelvesPerSegment`) และความสูงต่อชั้น (drag บน canvas หรือพิมพ์ cm)
- Files: `index.html`, `src/sheets.js`, `src/utils.js`, `src/products.js`, `src/planogram.js`, `src/export.js`, `src/app.js`, `tools/packshot.py`, `tools/cutout.swift`, `assets/products/`, `state.md`
- ✅ Previous NOW: แก้ PNG export สีซีด โดยปิด animation/transition ใน DOM clone ก่อน `html2canvas` จับภาพ พร้อม deploy Surge แล้ว
- ✅ Previous NOW: ย้าย production hosting จาก Surge ไป **GitHub Pages** เพราะ Surge deploy fail ซ้ำ ๆ ทุกครั้ง (`Aborted`/crash) ทั้งจากเครื่อง user เองและ session นั้น ลองทุกทาง (เปลี่ยน Node version, `surge@latest`, รอ 1 ชม. เผื่อ rate-limit) ก็ยังไม่ผ่าน — สรุปว่าเป็นปัญหาฝั่ง Surge/บัญชี ไม่ใช่โค้ด จึงเปลี่ยน repo เป็น **public** แล้วเปิด GitHub Pages (จำเป็นเพราะ private repo ใช้ Pages ไม่ได้บน Free plan) auto-deploy จาก branch `main` ทุกครั้งที่ push; Surge เดิม (`https://planogram-mpsynergy.surge.sh`) ปล่อยไว้เฉยๆ ไม่ลบ; รอบเดียวกันนี้ยังเพิ่ม built-in template dropdown (ไม่ทับ localStorage เดิมของ user), แก้เงาทแยงบนแผ่นหลังเชลฟ์แคบ/ลึกใน 3D view, ทำฐาน kick plate สีเดียวกับเชลฟ์, เพิ่ม summary card ประมาณจำนวนสินค้าที่เชลฟ์รับได้เต็ม, เพิ่มปุ่ม Export "ตัวโชว์-สต็อก.xlsx" ตามฟอร์แมต Ergotrend
- Files: `index.html`, `src/app.js`, `src/export.js`, `src/planogram.js`, `src/planogram3d.js`, `src/templates.js`, `assets/Template/Template.xlsx`, `state.md`

### 🗓️ 2026-08-05
- ✅ Previous NOW: เพิ่มปุ่ม `Export เชลฟ์เปล่า PNG` ใน Shelf Templates และแก้ exporter ให้สร้างไฟล์ PNG binary ผ่าน `canvas.toBlob()` พร้อมตรวจไฟล์ไม่ว่างก่อนดาวน์โหลด; ส่งออกแบบ flat ไม่มีเงาและคืน canvas/localStorage เดิม
- Files: `index.html`, `src/app.js`, `src/templates.js`, `src/export.js`, `src/styles.css`, `state.md`
- ✅ Previous NOW: พัฒนาระบบวิเคราะห์ความจุแนวลึกสินค้าชิ้นใหญ่, ปรับปรุง UX ปุ่มลบ และแก้ข้อความทับซ้อนใน Export PNG ของ Top View 2D
- Files: `index.html`, `src/products.js`, `src/planogram.js`, `src/export.js`, `src/topview.js`, `src/styles.css`, `state.md`

### 🗓️ 2026-06-26
- ✅ Previous NOW: แก้ 3D Top View ให้ Herman Miller Nevi Desk และ Sayl Chair ไม่ตกไปเป็นกล่อง generic แล้ว โดยเพิ่มโมเดล procedural เฉพาะรุ่นและปรับ Office Workspace template ให้ใช้ Nevi/Sayl preset เมื่อมี
- Files: `index.html`, `src/topview.js`, `src/styles.css`, `src/planogram3d.js`, `state.md`, `3d/`

### 🗓️ 2026-06-11
- ✅ Previous NOW: ตรวจไฟล์ในโฟลเดอร์ `3d/` แล้วพบ Nevi desk DWG 2D 5 ขนาด และ Sayl Chair SKP พร้อมเพิ่ม preset + top-view silhouette สำหรับ Herman Miller Nevi Desk และ Herman Miller Sayl Chair ในหน้า Top View Layout
- Files: `index.html`, `src/topview.js`, `src/styles.css`, `state.md`, `3d/`
- ✅ Previous NOW: ปรับการแสดงสินค้าใน Top View Layout ให้เป็นสัญลักษณ์ top-down แบบแปลนจริง แยกประเภท Bed / Chair / Table / Shelf / Product ได้จากรูปทรง พร้อมคงระบบ Export รูปและหมุน 8 ทิศ
- Files: `index.html`, `src/topview.js`, `src/styles.css`, `state.md`
- ✅ Previous NOW: เพิ่มปุ่ม Export รูปเฉพาะ Top View Layout และเพิ่มระบบหมุนสินค้าแบบลาก handle คล้าย SketchUp โดย snap ได้ 8 ทิศ (ทุก 45°) พร้อมปรับ inspector ให้เลือกองศา 0-315°
- Files: `index.html`, `src/topview.js`, `src/styles.css`, `state.md`
- ✅ Previous NOW: เพิ่มสเกลบอกความยาวและความลึกให้ Top View Layout โดยแสดง dimension ruler พร้อม tick ระยะ cm รอบบอร์ดห้อง ปรับให้สเกลคำนวณตามขนาดห้อง/zoom ปัจจุบัน และ deploy ขึ้น Surge แล้ว
- Files: `index.html`, `src/topview.js`, `src/styles.css`, `state.md`
- ✅ Previous NOW: พัฒนาระบบแสดงผลภาพสินค้าจริง (Real Product Mockup) พร้อมปรับปรุงโมเดล 3D ใน Top View Layout ให้มีความโค้งมนสวยงาม (Rounded Corners/Bevel) แทนทรงกล่องเหลี่ยมมุมคมเดิม และลดความเข้มของเส้น Edges ลงเพื่อรูปลักษณ์ที่นุ่มนวลสมจริงมากยิ่งขึ้น
- Files: `src/planogram3d.js`, `state.md`
- ✅ Previous NOW: ปรับปรุง UI ของปุ่มลบ (Delete Button) และปุ่มหมุนเฟอร์นิเจอร์ (Rotate Button) บนแคนวาส 2D ของพื้นที่ห้องให้มีขนาดใหญ่ขึ้นเป็นรูปทรงกลมสีสันชัดเจน (แดง/น้ำเงิน) ขอบสีขาวลอยเด่น และแสดงผลแบบทับเหลื่อมขอบมุมขวาบน/ล่าง (Overlapping badges) พร้อมเอฟเฟกต์ย่อขยายเมื่อวางเมาส์ (Hover scale) เพื่อการคลิกสั่งงานและลบสินค้าที่สะดวกขึ้นเรียบร้อยแล้ว
- Files: `src/topview.js`, `state.md`
- ✅ Previous NOW (2): ปรับปรุงรูปทรงโมเดล 3D แบบสำนักงาน (Office-style) สำหรับโต๊ะทำงานและเก้าอี้สำนักงาน โดยเพิ่มแผงปิดบังขาส่วนหน้า (Modesty Panel), ตู้ลิ้นชักด้านข้าง (Drawer Unit) พร้อมหูจับโลหะ และออกแบบเก้าอี้ตามหลักการยศาสตร์ (Ergonomic armrests, Lumbar support) พร้อมโครงขา 5 แฉกและล้อเลื่อนเรียบร้อยแล้ว
- Files: `src/planogram3d.js`, `state.md`
- ✅ Previous NOW (2): เพิ่มระบบคลิกเพื่อวางสินค้า (Click-to-Place) บนบอร์ด 2D Grid ของ Top View Layout เพื่อความมั่นใจ 100% ว่าผู้ใช้จะสามารถจัดวางสินค้าได้แม้มีปัญหา Drag & Drop ของเบราว์เซอร์ และเพิ่มระบบ "Room Layout Templates" (มี 3 แบบ: Showroom, Bedroom, Office Workspace) ซึ่งจัดพิกัดสินค้าเฟอร์นิเจอร์หลัก (โต๊ะ, เก้าอี้, เตียง, ชั้นวางสินค้า) ไว้เป็นตัวอย่างเรียบร้อย
- Files: `index.html`, `src/topview.js`, `state.md`
- ✅ Previous NOW (2): แก้ไขปัญหาผู้ใช้ไม่สามารถเพิ่มสินค้าลงในแปลน Top View ได้เนื่องจากเปิด 3D View ค้างไว้บดบังหน้าจอการวาง 2D โดยการเพิ่มระบบ Auto-close 3D View เมื่อมีการเปลี่ยนสลับหน้าจอแท็บ (nav-tab) และปิด 3D View อัตโนมัติเมื่อผู้ใช้เริ่มคลิกขยับลากสินค้า (dragstart) เพื่อเปลี่ยนมุมมองกลับมาเป็น 2D Canvas พร้อมให้ทำการวางสิ่งของได้ทันทีอย่างลื่นไหล
- Files: `src/topview.js`, `src/products.js`, `state.md`
- ✅ Previous NOW (2): เพิ่มฟังก์ชันการย่อ/ขยาย (Zoom In / Zoom Out / Zoom Reset และ Mouse Scroll Wheel + Ctrl) สำหรับแปลนห้อง 2D ใน Top View Layout พร้อมแก้ไขปัญหาระบบ Drag & Drop เพื่อรองรับความเสถียรของเบราว์เซอร์ในการจับลากสินค้า (โดยเฉพาะการ์ดที่มีรูปภาพ) และการันตี dropEffect = 'move' ในทุกการจัดวางสินค้าลงในพื้นที่แปลนห้องเรียบร้อยแล้ว
- Files: `index.html`, `src/topview.js`, `src/products.js`, `state.md`
- ✅ Previous NOW (3): เพิ่มเมนูและพื้นที่ทำงาน "Top View Layout" สำหรับจัดวางแปลนห้อง (Floor Planning) รองรับสินค้าเฟอร์นิเจอร์หลัก (Fixture Shelf, Office Table, Office Chair, Comfort Bed) แบบ 2D drag & drop snap-to-grid และแสดงผล 3D ในมุมมองกล้องมุมสูงพร้อมโมเดลแบบ Procedural ที่มีรายละเอียด พร้อมเพิ่มอินพุต Depth (ความลึก) ในหน้าต่างเพิ่ม/แก้ไขสินค้า
- Files: `index.html`, `src/topview.js`, `src/products.js`, `src/planogram3d.js`, `state.md`
- ✅ Previous NOW (2): แก้ไขปัญหาตู้ตรงกลาง (Segment 1) แสดงเป็นสีขาวทึบบดบังแผ่นหลังและชั้นวาง โดยการจำกัดความสูงสินค้าสูงสุดใน 3D View (Clamp height) ไม่ให้ทะลุออกนอกช่องชั้นวางขึ้นไปด้านบน พร้อมทั้ง deploy ขึ้น Surge อีกครั้ง
- Files: `src/planogram3d.js`, `state.md`
- ✅ Previous NOW (3): ปรับปรุงเนื้อหาใน README.md ให้ถูกต้องสอดคล้องกับฟีเจอร์และโครงสร้างของ Repository ในปัจจุบัน (ระบบ Free-Placement, 3D, Stacking, รายงาน BOM และไฟล์ใน src/)
- Files: `README.md`, `state.md`
- ✅ Previous NOW (2): อัปเดตข้อมูลการ Deploy ไปยัง Surge.sh ลงใน README.md เรียบร้อยแล้ว
- ✅ Previous NOW: อัปเดตข้อมูลการ Deploy ไปยัง Surge.sh ลงใน README.md เรียบร้อยแล้ว
- Files: `README.md`, `state.md`
- ✅ Previous NOW (2): แก้ไขปัญหาสีกระพริบ (Shadow acne) ใน Three.js 3D View และแก้ไขการคำนวณตำแหน่งแผ่นชั้นวาง (shelf boards) ไม่ให้ทับซ้อนกับ divider/side panel พร้อมทั้ง deploy ขึ้น Surge อีกครั้ง
- ✅ Previous NOW: แก้ไขปัญหาสีกระพริบ (Shadow acne) ใน Three.js 3D View และแก้ไขการคำนวณตำแหน่งแผ่นชั้นวาง (shelf boards) ไม่ให้ทับซ้อนกับ divider/side panel พร้อมทั้ง deploy ขึ้น Surge อีกครั้ง
- Files: `src/planogram3d.js`, `state.md`
- ✅ Previous NOW (2): Deploy โปรเจกต์ขึ้น Surge เรียบร้อยแล้วที่ URL: http://planogram-mpsynergy.surge.sh
- ✅ Previous NOW: Deploy โปรเจกต์ขึ้น Surge เรียบร้อยแล้วที่ URL: http://planogram-mpsynergy.surge.sh
- Files: `state.md`
- ✅ Previous NOW (2): เพิ่มฟีเจอร์หันด้านสินค้า (Orientation: Front / Side / Top) และฟีเจอร์หมุนสินค้า 90 องศา (Rotation) รองรับการแสดงผลทั้งแบบ Canvas 2D และ Three.js WebGL 3D, การคำนวณพื้นที่จัดเก็บจริงในรายงาน BOM, และการเก็บรักษาข้อมูลผ่าน JSON/localStorage อย่างครบถ้วน
- ✅ Previous NOW: เพิ่มฟีเจอร์หันด้านสินค้า (Orientation: Front / Side / Top) และฟีเจอร์หมุนสินค้า 90 องศา (Rotation) รองรับการแสดงผลทั้งแบบ Canvas 2D และ Three.js WebGL 3D, การคำนวณพื้นที่จัดเก็บจริงในรายงาน BOM, และการเก็บรักษาข้อมูลผ่าน JSON/localStorage อย่างครบถ้วน
- Files: `src/utils.js`, `index.html`, `src/styles.css`, `src/planogram.js`, `src/planogram3d.js`, `src/export.js`, `src/app.js`

### 🗓️ 2026-06-10
- ✅ Previous NOW: แก้ไขฟีเจอร์การป้อนระดับความสูงเชลฟ์ย่อย (cell-height-input) ให้เปลี่ยนชนิดช่องกรอกเป็น `text` พร้อมระบุ `numeric` inputmode เพื่อตัดปัญหาเบราว์เซอร์บีบ/ตัดตัวเลขตัวแรก (spin-button crop) และปรับ CSS จัดกึ่งกลางตัวเลขพร้อมกำหนดความกว้างขั้นต่ำของกล่องบอกระยะ cm (cell-height-pill) ให้แสดงผลครบถ้วนสวยงามทุกตู้
- Files: `src/planogram.js`, `src/styles.css`

### 🗓️ 2026-06-04
- ✅ Previous NOW: เพิ่มฟังก์ชันกำหนดความสูงของชั้นวางแยกกันอิสระราย Segment (Independent Shelf Heights per Segment) โดยทุก Segment จะมีช่องกรอก cm และตัว grip สำหรับลากปรับความสูงของแผ่นชั้นแต่ละตู้ (Bay) แยกกันเป็นอิสระ และอัปเดตการเรนเดอร์ในมุมมอง 3D (Three.js WebGL) ให้วาดแผ่นชั้นวางและตัวสินค้าแยกชิ้นตามระดับความสูงจริงของแต่ละ Segment
- Files: `src/planogram.js`, `src/planogram3d.js`, `src/export.js`
- ✅ Previous NOW (2): เพิ่มฟังก์ชันกำหนดความกว้างของ Segment แยกกันอิสระ (Independent Segment Widths) พร้อมอินพุตย่อยรายตู้ (Bay) ใน Left Panel โดยเมื่อผู้ใช้แก้ไขความกว้างตู้ย่อย ค่าความกว้างรวม (overallWidth) จะคำนวณสะสมอัตโนมัติ และอัปเดตตำแหน่งสินค้าและ Divider ทั้งบน Canvas 2D และ WebGL 3D ทันที
- Files: `index.html`, `src/app.js`, `src/planogram.js`, `src/planogram3d.js`, `src/export.js`
- ✅ Previous NOW (3): เพิ่มฟังก์ชันรายงานตำแหน่งจัดวางสินค้า (BOM & Placement Report) แบบเปิดหน้าต่างรายงานสรุป และรองรับการดึงภาพสินค้าจริง พร้อมระบบ Export CSV (รองรับภาษาไทยใน Excel) ปรับสลับข้อมูลได้สองมุมมอง (BOM Summary / Placement Details)
- Files: `index.html`, `src/styles.css`, `src/export.js`, `src/app.js`
- ✅ Previous NOW (3): เพิ่มการซ่อน/แสดงผนังข้าง (Side panels) แบบ real-time โดยไม่ล้างสินค้าเดิมบนชั้นวาง (preserve placements) เมื่อปรับเปลี่ยนตัวเลือกสไตล์หรือขนาดตู้ และรีเฟรชทั้ง 2D และ 3D อัตโนมัติเมื่อกดเลือก
- Files: `src/planogram.js`, `src/app.js`, `planogram_tool.html`
- ✅ Previous NOW (3): เพิ่มชั้นวางแบบปรับตำแหน่งแผ่นชั้นได้อิสระ + สเกลความสูง — แต่ละชั้นมี cell height (cm) ของตัวเอง (`spec.shelfHeights`), ลากแผ่นชั้นบนแคนวาส (board-grip) หรือพิมพ์ตัวเลข cm ต่อชั้น (pill input) ได้, มีไม้บรรทัด cm ด้านซ้าย (ruler) + ป้ายความสูงต่อชั้น. อัปเดตทั้ง 2D, 3D (`surfaceYs` cumulative) และ persistence
- Files: `src/planogram.js`, `src/planogram3d.js`, `src/export.js`, `index.html`, `src/styles.css`
- หมายเหตุ: ช่อง "Gap Between Shelves" ในฟอร์มไม่ถูกใช้ใน layout แล้ว (แทนด้วยตำแหน่งแผ่นชั้น) — ยังเก็บค่าไว้ ยังไม่ลบ
