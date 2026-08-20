# Planogram Builder

เครื่องมือเว็บแบบ Lightweight สำหรับออกแบบ shelf layout ของ Modern Trade ในรูปแบบ Multiple-Segment Planogram โดยไม่มีการใช้ framework และไม่มี build step — สามารถเปิดใช้งานผ่าน static file (`index.html`) ได้ทันที

![Planogram Builder](https://img.shields.io/badge/status-active-brightgreen) ![HTML/CSS/JS](https://img.shields.io/badge/stack-HTML%2FCSS%2FJS-blue)

## Features

- **Multi-Segment Planogram Canvas** — ออกแบบชั้นวางสินค้าแบบต่อกันหลายตู้ (Segment/Bay)
- **Free-Placement Layout** — วางสินค้าได้อิสระโดยตรงบนชั้นวาง ขยับตำแหน่ง ย้ายสินค้า และจัดเรียงหน้ากว้าง (Facing) ได้อิสระ (ไม่จำกัดระบบ Slot)
- **Independent Segment Widths** — ปรับตั้งค่าความกว้างของแต่ละ Segment (Bay) แยกกันได้อย่างอิสระ
- **Independent Shelf Heights** — ปรับระดับความสูงของแผ่นชั้นวางแต่ละช่องแยกกันได้อย่างอิสระในแต่ละ Segment (รองรับการลากปรับความสูงบน Canvas หรือพิมพ์ cm ต่อชั้น)
- **Three.js WebGL 3D View** — สลับดูมุมมอง 3D เสมือนจริง สามารถหมุน ซูม และแพนกล้องเพื่อทำ Visual QA ได้รอบทิศทาง
- **Product Orientation & Rotation** — กำหนดทิศทางการหันด้านสินค้า (Front / Side / Top) และการหมุนภาพสินค้าได้ 90 องศา เพื่อความสมจริงในการจัดเรียง
- **Stacking Support** — วางสินค้าซ้อนขึ้นไปในแนวตั้ง (Stack) ได้ตามความสูงช่องชั้น
- **BOM & Placement Report** — ระบบแสดงตารางสรุปสินค้า (BOM) และตารางแสดงตำแหน่งจัดวางอย่างละเอียด พร้อมคำนวณอัตราใช้สอยพื้นที่ (Utilization %) และส่งออกข้อมูลเป็น CSV (Excel Thai encoding)
- **Shelf Templates** — บันทึกและเรียกใช้งานเทมเพลตมาตรฐานของชั้นวาง (5 รูปแบบพื้นฐาน และสามารถบันทึกเทมเพลตใหม่เพิ่มเติมได้)
- **Product Library** — ดึงข้อมูล SKU จาก Google Sheets หรือสร้าง แก้ไข ลบสินค้าได้เองบนเว็บ
- **Persistence** — บันทึกข้อมูลการจัดวางโดยอัตโนมัติผ่าน `localStorage` พร้อมปุ่มสำหรับ Export/Import ไฟล์ข้อมูล `.json` เพื่อย้ายเครื่องหรือแชร์ไฟล์

## Getting Started

```bash
# Clone the repo
git clone https://github.com/MPSCommercial/Planogram.git
cd Planogram

# Serve locally (any static server works, e.g. python, local web server, live server)
python3 -m http.server 4174

# Open in browser
open http://localhost:4174
```

## Project Structure

```
index.html          # Main Application UI & Markup (จุดเข้าใช้งานหลัก)
planogram_tool.html # Static single-file Planogram Builder prototype (สำหรับทดสอบเดี่ยว)
src/
  app.js            # ไฟล์เริ่มต้นระบบ จัดการ event binding และ logic การลากวาง
  planogram.js      # เอนจิ้นการเรนเดอร์ Canvas 2D และการคำนวณตำแหน่งสินค้า
  planogram3d.js    # เอนจิ้นเรนเดอร์ 3D WebGL (Three.js) และจัดการแสง/เงา
  products.js       # จัดการ Product CRUD, คลังสินค้า และระบบค้นหา
  sheets.js         # ส่วนเชื่อมต่อดึงข้อมูลสินค้าจาก Google Sheets CSV
  templates.js      # เทมเพลตของแผ่นชั้นวางและตัวจัดการ localStorage
  export.js         # ระบบจัดการ Export ภาพ PNG และจัดทำตาราง BOM / CSV / JSON
  utils.js          # ฟังก์ชันช่วยเหลือ เช่น การคำนวณขนาดตาม Orientation
  styles.css        # สไตล์ชีททั้งหมด ปรับแต่งหน้าจอ Figma-like UI
```

## Product Pack Shots

ลำดับที่เว็บเลือกรูป: `Image URL` ใน Sheet → ไฟล์ใน `assets/products/` ตั้งชื่อตามรหัส ODOO
(`A10018.png`, `A10018-side.png`, `A10018-top.png` ตามด้านที่หัน) → บล็อกสีตามหมวดหมู่

ลิงก์ใน Sheet ต้องเป็น **ข้อความลิงก์ธรรมดา** ไม่ใช่สูตร `=IMAGE(...)` เพราะ CSV export
อ่านค่าจากสูตรไม่ได้ ลิงก์แชร์ Drive (`.../file/d/<id>/view`) ใช้ได้เลย ระบบแปลงให้เอง
แต่ไฟล์ต้องตั้งสิทธิ์เป็น "ทุกคนที่มีลิงก์" ไม่งั้นรูปจะไม่ขึ้น

แปลงรูปถ่ายมือถือเป็นแพ็คช็อต (ลบพื้นหลัง + ดัดมุมที่ก้ม/เงยให้ตรง + ย่อขนาด):

```bash
swiftc -O tools/cutout.swift -o tools/cutout        # ครั้งแรกครั้งเดียว (เร็วขึ้นมาก)
python3 tools/packshot.py -o assets/products --map names.csv ~/Photos/*.jpg
python3 tools/packshot.py --selftest                # ตรวจว่าตัวดัดมุมยังทำงานถูก
```

`names.csv` = `ชื่อไฟล์รูป,ODOO[,Width_cm,Height_cm]` เช่น `IMG_7340.jpeg,A10018,12.5,8`
ถ้าใส่ขนาดจาก Sheet มาด้วย ภาพที่ดัดแล้วจะได้สัดส่วนกว้าง:สูงตรงตามของจริง

สินค้าที่ไม่ใช่ผิวหน้าแบน (แผ่นรองเก้าอี้ ขาแขวนจอ ล้อ) ตัวดัดมุมจะข้ามให้อัตโนมัติ
แล้วรายงานว่า `trim only` — ตัวนั้นครอปกับลบพื้นหลังอย่างเดียว

## Google Sheets Sync

ดึงข้อมูลสินค้าได้จาก Google Sheets ที่เปิดสิทธิ์แชร์ (View-Only) โดยระบบจะอ่านค่าผ่าน CSV export 

คอลัมน์ใน Google Sheets ที่ระบบต้องการ:

| Column | Description |
|---|---|
| `ODOO` | รหัสสินค้า (Stable ID) |
| `Product Name` | ชื่อสินค้า |
| `Category` | หมวดหมู่สินค้า |
| `Sub Category` | ยี่ห้อ / แบรนด์สินค้า |
| `Image URL` | ลิงก์ภาพสินค้า (Pack Shot) — วางลิงก์แชร์ Google Drive ได้เลย ระบบแปลงเป็นลิงก์ภาพตรงให้เอง |
| `Width_cm` | ความกว้าง |
| `Height_cm` | ความสูง |
| `Depth_cm` | ความลึก |
| `Facing Default` | จำนวน Facing เริ่มต้น |
| `Price` | ราคาต่อชิ้น (ไม่บังคับ — ใส่แล้วเว็บคำนวณมูลค่าต่อ ตร.ม. ให้) |

*หมายเหตุ: ในปัจจุบันระบบจะฟิลเตอร์โหลดเฉพาะสินค้าที่มีหมวดหมู่ `Category = Accessories` (ประมาณ 80 SKUs)*

อัปเดตข้อมูลได้ทุกเมื่อผ่านปุ่ม **Sync Sheet** ในแถบ Product Library

## Shelf Configuration

| Setting | Default | Description |
|---|---|---|
| Segments | 3 | จำนวนตู้ย่อย (Bay) |
| Shelves per segment | 6 | จำนวนชั้นวางต่อหนึ่งตู้ |
| Width | 360 cm | ความกว้างสะสมรวมของทุก Segment |
| Height | 220 cm | ความสูงของโครงตู้ทั้งหมด |
| Depth | 48 cm | ความลึกของฐานชั้นวาง |
| Shelf Thickness | 3 cm | ความหนาของแผ่นชั้นวาง |
| Side Panels | True | แสดงแผ่นปิดด้านซ้ายและขวาสุดของตู้ |
| Back Panel | True | แสดงแผ่นหลังตู้ (สีตามที่ระบุในแผงควบคุม) |
| Segment Dividers | True | แสดงแผ่นกั้นแนวตั้งกั้นระหว่าง Segment |

## Data Persistence

ข้อมูลจะเก็บใน `localStorage` อัตโนมัติ หากต้องการย้ายไปทำงานเครื่องอื่นหรือ Backup ข้อมูล ให้คลิกปุ่ม **Export JSON** เพื่อดาวน์โหลดไฟล์เก็บไว้ และใช้ **Import JSON** เพื่อนำข้อมูลกลับมาทำงานต่อ

## Deployment

โปรเจกต์นี้ได้รับการ Deploy ไว้บน Surge.sh ที่ลิงก์:
[http://planogram-mpsynergy.surge.sh](http://planogram-mpsynergy.surge.sh)

หากต้องการ Deploy อัปเดตไปยัง Surge ใหม่อีกครั้ง:
1. ล็อกอินเข้าใช้งานบัญชี Surge บน Terminal
2. รันคำสั่งต่อไปนี้จาก root directory:
   ```bash
   npx surge . planogram-mpsynergy.surge.sh
   ```

## License

MIT
