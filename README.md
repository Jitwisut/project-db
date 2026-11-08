# Book DB — ระบบฐานข้อมูลห้องสมุด

เว็บแอประบบห้องสมุดที่ใช้ฐานข้อมูล SQLite จริง (sql.js / WebAssembly ทำงานในเบราว์เซอร์)
หนังสือแต่ละเล่มบนชั้น 3D คือหนึ่งแถวในตาราง `books` เมื่อรัน SQL ชั้นหนังสือจะเปลี่ยนตามผลลัพธ์จริง

## วิธีรัน

ต้องมี [Node.js](https://nodejs.org) (เวอร์ชัน 20 ขึ้นไป)

```bash
npm install
npm run dev
```

เบราว์เซอร์จะเปิดหน้าเว็บให้อัตโนมัติ (ปกติคือ http://localhost:5173) กด `Ctrl + C` ใน Terminal เพื่อหยุด

```bash
npm test        # รันชุดทดสอบฐานข้อมูล
npm run build   # สร้างไฟล์สำหรับ deploy ในโฟลเดอร์ dist/
```

## ฐานข้อมูล (3 ตาราง)

| ตาราง | คอลัมน์ | หมายเหตุ |
| --- | --- | --- |
| `members` | id, name, faculty, year_level | สมาชิกห้องสมุด 8 คน · `year_level` ต้องอยู่ระหว่าง 1–4 (CHECK) |
| `books` | id, title, author, genre, year | หนังสือ 26 เล่ม 5 หมวด (ชั้นละหนึ่งหมวด) |
| `loans` | id, book_id, member_id, loan_date, due_date, returned | การยืม 14 รายการ · `book_id` → `books.id`, `member_id` → `members.id` (FOREIGN KEY, ON DELETE CASCADE) |

ความสัมพันธ์: สมาชิก 1 คนยืมได้หลายครั้ง และหนังสือ 1 เล่มถูกยืมได้หลายครั้ง → `loans` เป็นตารางกลางที่เชื่อม `members` กับ `books`

## การใช้งาน

ใช้งานเหมือนระบบห้องสมุดจริง ไม่ต้องพิมพ์ SQL เอง ทุกครั้งที่กดปุ่ม แอปจะส่ง SQL จริงไปที่ SQLite
และแสดงคำสั่งนั้นในแผง **"SQL ที่ทำงานเบื้องหลัง"** (มุมขวาล่าง) พร้อมค่าที่ส่งผ่าน `?`

| เมนู | ทำอะไรได้ | SQL ที่ใช้ |
| --- | --- | --- |
| ชั้นหนังสือ | ค้นหาชื่อ/ผู้แต่ง, กรองหมวด, เรียงลำดับ, เพิ่มหนังสือ | `WHERE … LIKE ?`, `WHERE genre = ?`, `ORDER BY`, `INSERT INTO books` |
| คลิกหนังสือ | ดูข้อมูลและประวัติการยืม, ยืม, คืน, ลบ | `JOIN loans/members`, `INSERT INTO loans`, `UPDATE loans`, `DELETE FROM books` |
| สมาชิก | รายชื่อพร้อมจำนวนเล่มที่ยืมอยู่, ดูหนังสือที่แต่ละคนยืม, เพิ่มสมาชิก | `LEFT JOIN … GROUP BY`, `INSERT INTO members` |
| ยืม-คืน | รายการที่ยังไม่คืน เรียงตามวันกำหนดคืน, แจ้งเตือนเกินกำหนด, กดคืน | `JOIN` 3 ตาราง, `date('now')`, `UPDATE loans` |
| สถิติ | จำนวนหนังสือแต่ละหมวด, คนที่ยืมบ่อย, หนังสือยอดนิยม | `GROUP BY`, `ORDER BY … LIMIT 3`, `HAVING` |

ชั้นหนังสือ 3D จะเปลี่ยนตามข้อมูล: เล่มที่ค้นเจอเลื่อนออกมา เล่มที่ถูกยืมเอียงออกจากชั้น เพิ่ม/ลบหนังสือแล้วชั้นอัปเดตทันที
ทุกคำสั่งใช้ prepared statement (`?`) ค่าที่ผู้ใช้พิมพ์จึงเป็นแค่ข้อมูล ไม่ถูกตีความเป็น SQL (กัน SQL injection)
กด **RESET DB** เพื่อคืนข้อมูลตั้งต้น

## โครงสร้างโค้ด

- `src/sql/seed.ts` — สร้างตารางและข้อมูลตั้งต้น (CREATE TABLE / INSERT)
- `src/library/queries.ts` — **SQL ทุกคำสั่งของแอปอยู่ในไฟล์นี้** (ค้นหา ยืม คืน สถิติ ฯลฯ)
- `src/library/db.ts` — ตัวรันคำสั่งและบันทึกลงแผง "SQL ที่ทำงานเบื้องหลัง"
- `src/sql/engine.ts`, `sql.worker.ts`, `client.ts` — รัน SQL ด้วย SQLite ใน Web Worker แบบ prepared statement
- `src/library/Shelf3D.tsx` — ชั้นหนังสือ 3D (Three.js / React Three Fiber)
- `src/App.tsx` — หน้าจอหลัก: เมนูชั้นหนังสือ / สมาชิก / ยืม-คืน / สถิติ และการ์ดหนังสือ
