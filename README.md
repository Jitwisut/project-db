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

## คำสั่ง SQL ที่มีในแอป

| หมวด | ตัวอย่าง | สิ่งที่เห็นบนชั้น |
| --- | --- | --- |
| SELECT | `SELECT title, author FROM books;` | หนังสือในผลลัพธ์สว่างขึ้น |
| WHERE | `... WHERE genre = 'Technology';` | เล่มที่ตรงเลื่อนออกมา เล่มอื่นจางลง |
| ORDER BY | `... ORDER BY year DESC LIMIT 5;` | ตัวเลขลำดับ #1–#5 เหนือหนังสือ |
| JOIN | loans + books + members | ป้ายชื่อคนยืมบนหนังสือที่ถูกยืมอยู่ |
| GROUP BY | `SELECT genre, COUNT(*) ... GROUP BY genre;` | จำนวนเล่มที่ปลายชั้นแต่ละหมวด |
| INSERT | เพิ่มหนังสือใหม่ | หนังสือเล่มใหม่ปรากฏบนชั้น |
| UPDATE | `UPDATE loans SET returned = 1 WHERE id = 2;` | หนังสือที่คืนแล้วกลับเข้าชั้น |
| DELETE | `DELETE FROM books WHERE id = 26;` | หนังสือหายจากชั้น (การยืมถูกลบตาม CASCADE) |

พิมพ์ SQL อื่นเองได้ทุกแบบ ถ้าผลลัพธ์ไม่ใช่หนังสือรายเล่ม (เช่น `COUNT(*)` หรือ `SELECT * FROM members`) จะแสดงเป็นตารางผลลัพธ์อย่างเดียว
กด **RESET DB** เพื่อคืนข้อมูลตั้งต้น

## โครงสร้างโค้ด

- `src/sql/seed.ts` — สร้างตารางและข้อมูลตั้งต้น (CREATE TABLE / INSERT)
- `src/sql/engine.ts`, `sql.worker.ts`, `client.ts` — รัน SQL ด้วย SQLite ใน Web Worker (query ที่ค้างเกิน 4 วินาทีจะถูกหยุดและรีเซ็ต)
- `src/library/model.ts` — ตัวอย่างแต่ละหมวด และ `planQuery` ที่สร้าง "คำสั่งคู่" (FROM/WHERE เดิม แต่คืน `books.id`) เพื่อรู้ว่าจะไฮไลต์หนังสือเล่มไหน
- `src/library/Shelf3D.tsx` — ชั้นหนังสือ 3D (Three.js / React Three Fiber)
- `src/App.tsx` — หน้าจอหลัก: แผงคำสั่ง SQL, ตารางผลลัพธ์, โครงสร้างตาราง
