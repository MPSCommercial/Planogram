# Planogram

> **AI**: อ่านเฉพาะส่วน ⚡ NOW ก่อนเริ่มงานทุกครั้ง — อ่านส่วน 📜 LOG เฉพาะเมื่อผู้ใช้ถามเรื่อง history หรือเมื่อต้อง archive NOW เก่า
> **Human**: อัปเดต NOW ทุกครั้งที่ทำงานเสร็จ แล้ว archive NOW เก่าลง LOG

---

## ⚡ NOW

- **Status**: Added `DESIGN.md` Figma design reference via `npx getdesign@latest add figma`
- **Branch**: main | **Commit**: `HEAD` — docs: add figma design reference
- **Deploy**: ✅ Ready — origin/main
- **Blocker**: None
- **Next**: ใช้ `DESIGN.md` เป็น reference ก่อนปรับ UI รอบถัดไป

---

## 📜 LOG

> ย้าย NOW เก่ามาใส่ที่นี่ทุกครั้งที่อัปเดต — ไม่ต้องลบ

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
