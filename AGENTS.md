# AGENTS.md

## Project

Planogram web app สำหรับออกแบบ shelf layout ของ Modern Trade

เป้าหมายหลักคือทำเครื่องมือที่ใช้สร้าง multiple-segment planogram ได้จริง:

- กำหนดสเปค shelf / gondola ได้
- ใส่รูปภาพสินค้าได้
- วางสินค้าเป็น block ตาม facing ได้
- แสดง planogram canvas ขนาดใหญ่และอ่านง่าย
- export เป็นภาพได้

## Working Style

- ตอบภาษาไทยเป็นหลัก
- สั้น กระชับ ตรงประเด็น
- เริ่มจาก solution ก่อน
- ถ้า request ชัดเจน ให้ลงมือแก้ไฟล์จริง ไม่ต้องถามซ้ำ
- ตรวจ state จริงของไฟล์ก่อนสรุป
- ก่อนเริ่มงานทุกครั้งให้อ่าน `state.md` เฉพาะส่วน `## ⚡ NOW`
- อ่าน `state.md` ส่วน `## 📜 LOG` เฉพาะเมื่อผู้ใช้ถาม history หรือจำเป็นต้อง archive NOW เก่า
- หลังจบงานให้อัปเดต `state.md` ส่วน NOW ให้ตรงกับสถานะล่าสุด และย้าย NOW เก่าลง LOG ก่อนแทนที่
- อย่าเดาโครงสร้างโปรเจกต์ถ้ายังไม่ได้ดูไฟล์
- ถ้ามี assumption ให้บอกสั้น ๆ

## Frontend Direction

- Minimal 2026 design language
- Clean layout
- Strong hierarchy
- Generous spacing
- Calm, modern, production-oriented visual
- Avoid clutter, noisy UI, outdated styles
- Planogram canvas ต้องเด่นกว่าส่วน control
- Controls ควร compact และไม่กินพื้นที่ canvas

## Planogram UI Direction

อ้างอิงภาพแนว multiple-segment planogram:

- มี top navigation / toolbar แบบ compact
- มี title เช่น `Multiple Segment Planogram`
- canvas ใหญ่เต็มพื้นที่หลัก
- แสดง gondola หลาย segment ต่อกัน
- แต่ละ segment มีหลาย shelf
- มี vertical divider ระหว่าง segment
- back panel สีเทาเข้มหรือดำเทา
- shelf surface สีขาว/เทาอ่อน
- สินค้าแสดงเป็นรูป pack shot จริง
- fallback เป็นกล่องสีได้เมื่อไม่มีรูป

## Code Preferences

- Clean, modular, readable code
- ใช้ naming ที่อ่านง่าย
- Keep components/functions simple
- Avoid unnecessary complexity
- Preserve existing behavior unless asked to change
- ถ้าไฟล์เริ่มใหญ่ ให้แนะนำแยกไฟล์อย่างเป็นระบบ

## Current Files

- `state.md`
  Working status/log หลักของ repo; อ่าน NOW ก่อนเริ่มงานและอัปเดตหลังจบงาน

- `AGENTS.md`
  คำแนะนำการทำงานของ coding assistant ใน repo นี้

- `planogram_tool.html`  
  Static single-file Planogram Builder prototype

- `PLANOGRAM_REQUIREMENTS.md`  
  Requirement/spec brief สำหรับ version ที่อยากได้ตาม reference

## Current Priority

พัฒนา `planogram_tool.html` ให้เข้าใกล้ requirement ใน `PLANOGRAM_REQUIREMENTS.md`

Priority:

1. Multiple segment canvas
2. Shelf spec controls
3. Product image upload
4. Drag/drop placement
5. Facing support
6. Export PNG
7. Clean, readable UI
