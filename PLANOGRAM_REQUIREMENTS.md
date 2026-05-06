# Planogram Builder Requirements

## Goal

สร้าง web app สำหรับทำ Planogram แบบ multiple segment คล้ายหน้าจอตัวอย่าง โดยผู้ใช้สามารถกำหนดสเปคเชลฟ์ ใส่รูปสินค้า และจัดวางสินค้าในแต่ละช่องของชั้นวางได้แบบ visual

## Reference Direction

ต้องการหน้าตาและการใช้งานใกล้เคียงภาพตัวอย่าง:

- มี toolbar ด้านบนสำหรับเลือก module หรือ mode
- มีชื่อ view กลางหน้า เช่น `Multiple Segment Planogram`
- พื้นที่หลักเป็น planogram canvas ขนาดใหญ่
- แสดง gondola / shelf หลาย segment วางเรียงซ้ายไปขวา
- แต่ละ segment มีหลายชั้น
- มี back panel สีเทาเข้ม
- ชั้นวางเป็นแถบสีขาว/เทาอ่อน
- สินค้าแสดงเป็นรูปภาพ pack shot จริง
- สินค้าสามารถวางซ้อนเป็น block ตาม facing ได้
- หน้าจอต้องเน้นการดู planogram ชัด ๆ ไม่ใช่ dashboard หนัก ๆ

## Main Layout

### Top Navigation

ควรมีแถบด้านบนแบบ compact:

- ปุ่ม `Cancel`
- tab หรือ segmented navigation:
  - `Inventory Monitoring Header`
  - `Contract`
  - `Planogram`
  - `Inventory Monitoring Line`
  - `Report`
- tab ที่ active คือ `Planogram`
- ปุ่ม icon ด้านขวา เช่น camera/export และ more menu

### Page Header

ใต้ navigation มีชื่อ view:

```text
Multiple Segment Planogram
```

ควรมี dropdown indicator เพื่อรองรับการเลือก planogram view อื่นในอนาคต

### Main Canvas

พื้นที่ canvas ต้องเป็นส่วนสำคัญที่สุดของหน้า:

- อยู่กลางหน้า
- พื้นหลัง page สีเทาอ่อน
- planogram กว้างเต็มพื้นที่ที่มี
- scroll ได้เมื่อ planogram ใหญ่เกิน viewport
- รองรับหลาย segment ต่อกัน เช่น 3 bay / 4 bay
- มี vertical divider ระหว่าง segment

## Shelf / Gondola Specification

ผู้ใช้ต้องกำหนดสเปค shelf ได้:

- `Planogram Name`
- `Number of Segments`
- `Shelves per Segment`
- `Slots per Shelf`
- `Overall Width`
- `Overall Height`
- `Shelf Width`
- `Shelf Height`
- `Shelf Depth`
- `Gap Between Shelves`
- `Base Height`
- `Back Panel`
- `Side Panel`
- `Segment Divider`
- `Shelf Color`
- `Back Panel Color`

ค่าเริ่มต้นที่เหมาะสม:

```text
Number of Segments: 3
Shelves per Segment: 7
Slots per Shelf: 12
Overall Width: 360 cm
Overall Height: 220 cm
Shelf Depth: 48 cm
Gap Between Shelves: 28 cm
Back Panel Color: #4a4a4a
Shelf Color: #f4f4f0
```

## Product Data

สินค้าแต่ละตัวควรมีข้อมูล:

- `SKU ID`
- `Product Name`
- `Brand`
- `Category`
- `Segment`
- `Shelf`
- `Position`
- `Facing`
- `Width`
- `Height`
- `Depth`
- `Pack Color`
- `Product Image`

## Product Image

ต้องรองรับการใส่รูปสินค้า:

- Upload รูปจากเครื่อง
- รองรับ PNG, JPG, WEBP
- รูปควรแสดงแบบ `object-fit: contain`
- ควรรองรับ transparent PNG เพื่อให้ pack shot ดูสมจริง
- หากไม่มีรูป ให้แสดง fallback เป็นกล่องสีพร้อมชื่อสินค้า

## Placement Behavior

การวางสินค้าควรรองรับ:

- click เพื่อเลือกสินค้า
- click slot เพื่อวางสินค้า
- drag and drop สินค้าลง shelf
- facing มากกว่า 1 ให้กินหลายช่องต่อกัน
- ลบสินค้าจาก slot ได้
- ย้ายตำแหน่งสินค้าได้
- แสดง highlight เมื่อ drag เหนือพื้นที่ที่วางได้
- กันการวางเกินจำนวนช่องของ shelf

## Visual Requirements

ลักษณะ visual ควรใกล้ภาพตัวอย่าง:

- ใช้ back panel สีเทาเข้ม
- shelf surface สีขาว/เทาอ่อน
- side panel และ divider เป็นเทาเข้ม
- สินค้าแสดงเป็น block แน่น ๆ บนแต่ละชั้น
- spacing ระหว่าง shelf ต้องพอดี อ่านสินค้าได้
- segment ต้องแบ่งชัดเจน
- canvas ต้องดูเหมือน planogram จริงมากกว่า card/dashboard

## UI Priority

ลำดับความสำคัญของ UI:

1. Planogram canvas ชัดและใหญ่
2. การแบ่ง segment อ่านง่าย
3. สินค้าพร้อมรูปต้องเห็นชัด
4. เครื่องมือกำหนด shelf อยู่ด้านข้างหรือ drawer
5. controls ต้อง compact ไม่กินพื้นที่ canvas

## Suggested Screens

### Builder Screen

หน้าหลักสำหรับจัด planogram:

- top navigation
- planogram title dropdown
- large multiple segment canvas
- right or left settings panel
- product library
- export controls

### Product Library

หน้าหรือ panel สำหรับจัดการสินค้า:

- add product
- upload image
- edit SKU detail
- category filter
- search product

### Shelf Settings

panel สำหรับกำหนดสเปค:

- segment count
- shelf count
- shelf size
- color/back panel
- preview update

## Export

ควร export ได้:

- PNG
- JPG
- PDF ในอนาคต

Export ต้องรวม:

- planogram title
- full multiple segment shelf
- product image placement
- timestamp หรือ version optional

## Data Persistence

ควรรองรับอย่างน้อย:

- save state ใน localStorage
- import/export JSON

โครงสร้าง JSON ควรมี:

```json
{
  "planogram": {
    "name": "Multiple Segment Planogram",
    "segments": 3,
    "shelvesPerSegment": 7,
    "slotsPerShelf": 12
  },
  "products": [],
  "placements": []
}
```

## Technical Direction

เริ่มจาก static HTML/CSS/JavaScript ได้ เพราะเปิดใช้งานง่าย

ถ้าขยายต่อ แนะนำแยกเป็น:

```text
index.html
src/
  styles.css
  app.js
  planogram.js
  products.js
  export.js
```

ถ้าจะทำเป็น production app ควรใช้:

- React หรือ Vue
- component แยก `PlanogramCanvas`, `Segment`, `ShelfRow`, `ProductBlock`
- state management แบบ simple store
- image upload เก็บเป็น base64 หรือ object URL ใน local ก่อน

## Acceptance Criteria

งานถือว่าใช้ได้เมื่อ:

- ผู้ใช้กำหนดจำนวน segment ได้
- ผู้ใช้กำหนดจำนวน shelf และ slot ได้
- canvas แสดง multiple segment planogram ได้ชัดเจน
- ใส่รูปสินค้าและวางลง shelf ได้
- facing ทำให้สินค้ากินหลายช่องได้
- ลบ/แก้ตำแหน่งสินค้าได้
- export PNG ได้
- layout ใกล้เคียง reference: top bar + title + large planogram canvas

