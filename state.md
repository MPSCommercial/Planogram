# Planogram

> **AI**: อ่านเฉพาะส่วน ⚡ NOW ก่อนเริ่มงานทุกครั้ง — อ่านส่วน 📜 LOG เฉพาะเมื่อผู้ใช้ถามเรื่อง history หรือเมื่อต้อง archive NOW เก่า
> **Human**: อัปเดต NOW ทุกครั้งที่ทำงานเสร็จ แล้ว archive NOW เก่าลง LOG

---

## ⚡ NOW

- **Status**: เพิ่มฟังก์ชันกำหนดความกว้างของ Segment แยกกันอิสระ (Independent Segment Widths) พร้อมอินพุตย่อยรายตู้ (Bay) ใน Left Panel โดยเมื่อผู้ใช้แก้ไขความกว้างตู้ย่อย ค่าความกว้างรวม (overallWidth) จะคำนวณสะสมอัตโนมัติ และอัปเดตตำแหน่งสินค้าและ Divider ทั้งบน Canvas 2D และ WebGL 3D ทันที
- **Branch**: main | **Commit**: 679abab
- **Deploy**: Cloudflare Pages (Auto-deployed)
- **Blocker**: None
- **Next**: ทดสอบการจัดวางและการคำนวณความกว้างใน 2D & 3D, ตรวจสอบความถูกต้องของการเซฟและนำเข้า JSON
- **Files**: `index.html`, `src/app.js`, `src/planogram.js`, `src/planogram3d.js`, `src/export.js`, `state.md`

---

## 📜 LOG

### 🗓️ 2026-06-04
- ✅ Previous NOW: เพิ่มฟังก์ชันรายงานตำแหน่งจัดวางสินค้า (BOM & Placement Report) แบบเปิดหน้าต่างรายงานสรุป และรองรับการดึงภาพสินค้าจริง พร้อมระบบ Export CSV (รองรับภาษาไทยใน Excel) ปรับสลับข้อมูลได้สองมุมมอง (BOM Summary / Placement Details)
- Files: `index.html`, `src/styles.css`, `src/export.js`, `src/app.js`
- ✅ Previous NOW (2): เพิ่มการซ่อน/แสดงผนังข้าง (Side panels) แบบ real-time โดยไม่ล้างสินค้าเดิมบนชั้นวาง (preserve placements) เมื่อปรับเปลี่ยนตัวเลือกสไตล์หรือขนาดตู้ และรีเฟรชทั้ง 2D และ 3D อัตโนมัติเมื่อกดเลือก
- Files: `src/planogram.js`, `src/app.js`, `planogram_tool.html`
- ✅ Previous NOW (3): เพิ่มชั้นวางแบบปรับตำแหน่งแผ่นชั้นได้อิสระ + สเกลความสูง — แต่ละชั้นมี cell height (cm) ของตัวเอง (`spec.shelfHeights`), ลากแผ่นชั้นบนแคนวาส (board-grip) หรือพิมพ์ตัวเลข cm ต่อชั้น (pill input) ได้, มีไม้บรรทัด cm ด้านซ้าย (ruler) + ป้ายความสูงต่อชั้น. อัปเดตทั้ง 2D, 3D (`surfaceYs` cumulative) และ persistence
- Files: `src/planogram.js`, `src/planogram3d.js`, `src/export.js`, `index.html`, `src/styles.css`
- หมายเหตุ: ช่อง "Gap Between Shelves" ในฟอร์มไม่ถูกใช้ใน layout แล้ว (แทนด้วยตำแหน่งแผ่นชั้น) — ยังเก็บค่าไว้ ยังไม่ลบ

> ย้าย NOW เก่ามาใส่ที่นี่ทุกครั้งที่อัปเดต — ไม่ต้องลบ

### 🗓️ 2026-06-02
- ✅ Previous NOW: เพิ่มการวางสินค้าซ้อนกัน (stacking) — property `stack` ต่อสินค้า ปรับใน mini-inspector, เรนเดอร์ 2D (stack-unit) + 3D (clone mesh)
- Files: `src/planogram.js`, `src/planogram3d.js`, `index.html`, `src/app.js`, `src/styles.css`, `state.md`

### 🗓️ 2026-06-02
- ✅ Previous NOW: เพิ่มฟีเจอร์ Shelf Templates — เทมเพลตพื้นฐาน 5 แบบ + บันทึก/ลบ/ซ่อน-คืนค่า (localStorage)
- Files: `src/templates.js`, `index.html`, `src/app.js`, `src/styles.css`, `state.md`

### 🗓️ 2026-06-02
- ✅ Previous NOW: Pushed all recent local commits up to date with `origin/main`
- ✅ Branch: `main` | Commit: `be7bfb1` — style: revert sticky stage toolbar and apply transparent minimal font-only layout | Deploy: Pushed to `origin/main`
- ✅ Next เดิม: พร้อมเริ่มงานพัฒนาส่วนถัดไปตาม `PLANOGRAM_REQUIREMENTS.md` หรือรอรับ feedback จากผู้ใช้
- Files: `state.md`

### 🗓️ 2026-05-21
- ✅ Previous NOW: Completed Stage Toolbar aesthetic cleanup by reverting sticky behaviors and setting background to 100% transparent to ensure a highly minimal font-only layout
- ✅ Branch: `main` | Commit: `be7bfb1` — style: revert sticky stage toolbar and apply transparent minimal font-only layout | Deploy: Pushed to `origin/main`
- ✅ Next เดิม: พร้อมตรวจสอบ Visual QA โทนสีและเลย์เอาต์มินิมอลแบบใหม่ร่วมกับผู้ใช้
- Files: `state.md`

### 🗓️ 2026-05-21
- ✅ Previous NOW: Shipped 3D Perspective Mode and Shelf Capacity Utilization Warnings to index.html and assets
- ✅ Branch: `main` | Commit: `286bf75` — feat: add 3D perspective mode and shelf capacity utilization warning badge
- ✅ Next เดิม: พร้อมทดสอบ 3D visual effects และรับความเห็นเพิ่มเติมจากผู้ใช้
- Files: `index.html`, `src/app.js`, `src/planogram.js`, `src/styles.css`, `state.md`

### 🗓️ 2026-05-21
- ✅ Previous NOW: Shipped interactive UI/UX enhancements (on-board rearranging, direct facing manipulation, and dynamic sync configuration)
- ✅ Branch: `main` | Commit: `4807b43` — feat: on-board rearranging, direct facing manipulation via mini-inspector, and dynamic sheet sync settings
- ✅ Next เดิม: ตรวจสอบการทำงานของ feature ทั้ง 3 และรับ requirement/feedback อื่น ๆ เพิ่มเติม
- Files: `index.html`, `src/app.js`, `src/planogram.js`, `src/styles.css`, `state.md`

### 🗓️ 2026-05-21
- ✅ Previous NOW: Checked repo hooks; no active Git/npm hook is configured
- ✅ Branch: `main` | Commit: `21f4d96` — style: smooth stage background gradient and toolbar blend
- ✅ Next เดิม: หากต้องการ enforce checks ก่อน commit/push ให้เพิ่ม hook manager เช่น Husky/Lefthook หรือสร้าง `.git/hooks/pre-commit` เอง
- Files: `index.html`, `src/app.js`, `src/planogram.js`, `src/sheets.js`, `src/styles.css`, `state.md`

### 🗓️ 2026-05-17
- ✅ ตรวจ hook ของ repo: ไม่มี executable hook ใน `.git/hooks`, ไม่มี `core.hooksPath`, ไม่มี `package.json`/Husky/Lefthook/lint-staged config
- ✅ Hidden files ที่พบ (`.omg/state/learn-watch.json`, `.sc/last-chat-settings.json`) เป็น tool state/config ไม่ใช่ hook runtime ของ repo
- Files: `state.md`

### 🗓️ 2026-05-17
- ✅ Previous NOW: Shipped refreshed Planogram UI layout and Figma design reference to `origin/main`
- ✅ Branch: `main` | Commit: `b8167bb` — feat: refresh planogram studio layout | Deploy: pushed to `origin/main`
- ✅ Next เดิม: เปิด visual QA ที่ `http://localhost:4174/?v=design-layout` หากต้องการตรวจ UI ต่อ
- Files: `state.md`

### 🗓️ 2026-05-11
- ✅ ปรับ design layout ตาม `frontend-design` + `DESIGN.md`: เปลี่ยน typography เป็น IBM Plex Sans Thai/Mono, ปรับ topbar/nav, panels, product cards, summary cards, canvas board, และ shelf visual ให้ scan ง่ายขึ้น
- ✅ เพิ่ม motion เร็ว: app entry, card reveal, hover lift, panel/collapse transitions, drag-over shelf feedback, product placement pop, modal/toast transitions และรองรับ `prefers-reduced-motion`
- ✅ Verification ผ่าน: `node --check` สำหรับไฟล์ JS หลัก, `git diff --check`, และ local preview ตอบ `HTTP 200` ที่ `http://localhost:4174/?v=design-layout`
- Files: `index.html`, `src/app.js`, `src/styles.css`, `state.md`

### 🗓️ 2026-05-11
- ✅ เพิ่ม `DESIGN.md` จาก preset `figma` ด้วย `npx getdesign@latest add figma`
- ✅ ใช้ไฟล์นี้เป็น design reference สำหรับ UI work ถัดไป เช่น color, typography, radius, spacing, และ interaction style
- Files: `DESIGN.md`, `state.md`

### 🗓️ 2026-05-10
- ✅ Ship: ignore `.omg` tool state directory
- Files: `.gitignore`

### 🗓️ 2026-05-09
- ✅ Ship: free-placement shelf layout, shelf image CSS, placement migration, and `state.md` workflow
- ✅ Deploy ready on `origin/main`
- Files: `AGENTS.md`, `index.html`, `src/export.js`, `src/planogram.js`, `src/products.js`, `src/sheets.js`, `src/styles.css`, `state.md`

### 🗓️ 2026-05-09
- ✅ Ship: เตรียม commit/push งาน free-placement shelf layout, shelf image CSS, placement migration, และ `state.md` workflow
- ✅ Verification ผ่าน: `node --check` ทุกไฟล์ JS, `git diff --check`, และไม่พบ reference `slotsPerShelf`/slot API เก่าใน `index.html`/`src`
- Files: `AGENTS.md`, `index.html`, `src/export.js`, `src/planogram.js`, `src/products.js`, `src/sheets.js`, `src/styles.css`, `state.md`

### 🗓️ 2026-05-09
- ✅ รัน `git merge --ff-only planogram` แล้วได้ `Already up to date.`
- ✅ ปิด Subspace session ของ branch `planogram`, remove worktree `/Users/chibzthawch/DevOps/.subspace/Planogram/planogram`, และลบ local branch `planogram`
- ⚠️ เหลือเฉพาะ branch `main`; ยังมี WIP เดิม 7 ไฟล์บน `main`
- Files: `state.md`

### 🗓️ 2026-05-09
- ✅ เช็ก branch: `main` = `origin/main`; `planogram` เป็น ancestor ของ `main` แล้ว จึงไม่มี commit ที่ต้อง merge เพิ่ม
- ⚠️ ยังมี WIP ใน `AGENTS.md`, `index.html`, `src/export.js`, `src/planogram.js`, `src/products.js`, `src/styles.css`, `state.md`
- Files: `state.md`

### 🗓️ 2026-05-09
- ✅ สร้าง `state.md` เป็นไฟล์สถานะกลางสำหรับบันทึก NOW/LOG หลังจบงาน
- ✅ อัปเดต `AGENTS.md` ให้ต้องอ่าน `state.md` ส่วน NOW ก่อนเริ่มงาน และอัปเดต NOW/LOG หลังจบงาน
- ⚠️ มี WIP เดิมใน `index.html`, `src/export.js`, `src/planogram.js`, `src/products.js`, `src/styles.css` ที่ไม่ได้แตะในงานนี้
- Files: `state.md`, `AGENTS.md`
