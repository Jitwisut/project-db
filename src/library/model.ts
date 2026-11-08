// ตัวกลางระหว่าง SQL กับชั้นหนังสือ 3D
// - CATEGORIES: ตัวอย่างคำสั่งแต่ละหมวด พร้อมคำอธิบายภาษาไทย
// - planQuery: ดูรูปแบบ SQL แล้วสร้าง "คำสั่งคู่" (companion) ที่ใช้ FROM/WHERE เดิม แต่คืน id ของหนังสือ
//   ฉาก 3D จะไฮไลต์เฉพาะหนังสือที่ SQLite คืนมาจริงเท่านั้น ไม่มีการเดา

export interface Book { id: number; title: string; author: string; genre: string; year: number }
export interface ActiveLoan { book_id: number; member: string; due_date: string }

export const GENRES = ['Fiction', 'Science', 'History', 'Technology', 'Art'] as const
export const GENRE_COLORS: Record<string, string[]> = {
  Fiction: ['#8e4a3a', '#a85b44', '#6f3a30', '#b9705a'],
  Science: ['#2f5d6e', '#3d7488', '#264b5a', '#4b8aa0'],
  History: ['#7a6236', '#927743', '#5e4b2a', '#a88c55'],
  Technology: ['#3c4f7a', '#4a6194', '#2f3f62', '#5d74aa'],
  Art: ['#6b4a74', '#80598b', '#56395e', '#97709f'],
  Other: ['#556070', '#677386', '#465060', '#7a8597'],
}

/** สถานะของห้องสมุดที่ฉาก 3D ต้องใช้ ดึงจากฐานข้อมูลหลังรันทุกคำสั่ง */
export const SNAPSHOT_SQL = `SELECT id, title, author, genre, year FROM books ORDER BY genre, id;
SELECT l.book_id, m.name, l.due_date FROM loans l JOIN members m ON m.id = l.member_id WHERE l.returned = 0;`

export interface Category { id: string; label: string; thai: string; sql: string }
export const CATEGORIES: Category[] = [
  {
    id: 'select', label: 'SELECT', sql: 'SELECT title, author\nFROM books;',
    thai: 'เลือกคอลัมน์ที่ต้องการจากตาราง books หนังสือทุกเล่มที่อยู่ในผลลัพธ์จะสว่างขึ้นบนชั้น',
  },
  {
    id: 'where', label: 'WHERE', sql: "SELECT *\nFROM books\nWHERE genre = 'Technology';",
    thai: 'กรองเฉพาะแถวที่ตรงเงื่อนไข หนังสือที่ตรงจะเลื่อนออกมาจากชั้นและสว่าง ที่ไม่ตรงจะจางลง',
  },
  {
    id: 'order', label: 'ORDER BY', sql: 'SELECT title, year\nFROM books\nORDER BY year DESC\nLIMIT 5;',
    thai: 'เรียงลำดับผลลัพธ์ แล้วใช้ LIMIT เอาแค่ 5 เล่มแรก ตัวเลขลำดับจะลอยอยู่เหนือหนังสือแต่ละเล่ม',
  },
  {
    id: 'join', label: 'JOIN', sql: 'SELECT members.name, books.title, loans.due_date\nFROM loans\nJOIN books ON loans.book_id = books.id\nJOIN members ON loans.member_id = members.id\nWHERE loans.returned = 0;',
    thai: 'รวมข้อมูลจาก 3 ตาราง: การยืม (loans) + หนังสือ (books) + สมาชิก (members) หนังสือที่ถูกยืมอยู่จะมีป้ายบอกชื่อคนยืม',
  },
  {
    id: 'group', label: 'GROUP BY', sql: 'SELECT genre, COUNT(*) AS total\nFROM books\nGROUP BY genre;',
    thai: 'จัดกลุ่มหนังสือตามหมวด แล้วนับจำนวนในแต่ละกลุ่ม ตัวเลขจะแสดงที่ปลายชั้นของหมวดนั้น',
  },
  {
    id: 'insert', label: 'INSERT', sql: "INSERT INTO books (title, author, genre, year)\nVALUES ('Atomic Habits', 'James Clear', 'Science', 2018);",
    thai: 'เพิ่มหนังสือเล่มใหม่ลงตาราง หนังสือจะปรากฏบนชั้นตามหมวดที่ระบุ',
  },
  {
    id: 'update', label: 'UPDATE', sql: 'UPDATE loans\nSET returned = 1\nWHERE id = 2;',
    thai: 'แก้ไขข้อมูลที่มีอยู่ ตัวอย่างนี้คือคืนหนังสือ (loan id 2) หนังสือจะกลับเข้าชั้นตามเดิม',
  },
  {
    id: 'delete', label: 'DELETE', sql: 'DELETE FROM books\nWHERE id = 26;',
    thai: 'ลบแถวออกจากตาราง หนังสือเล่มนั้นจะหายไปจากชั้น (การยืมของเล่มนั้นจะถูกลบตาม ON DELETE CASCADE)',
  },
]

export type Plan =
  | { kind: 'rows'; companion: string; ordered: boolean }
  | { kind: 'group-genre'; }
  | { kind: 'change' }
  | { kind: 'none'; reason: string }

const KEYWORDS = /^(where|join|inner|left|on|group|order|limit|as)$/i

export function cleanSql(sql: string) {
  return sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim().replace(/;\s*$/, '')
}

/** ดูรูปแบบ SQL แล้วบอกว่าจะแสดงบนชั้นหนังสือได้อย่างไร */
export function planQuery(sql: string): Plan {
  const s = cleanSql(sql)
  if (!s) return { kind: 'none', reason: 'ไม่มีคำสั่ง' }
  if (s.replace(/'(?:[^']|'')*'/g, '').includes(';')) return { kind: 'change' }
  if (/^(insert|update|delete|replace|create|drop|alter)\b/i.test(s)) return { kind: 'change' }
  const m = s.match(/^select\s+(distinct\s+)?(.+?)\s+(from\s+.+)$/i)
  if (!m) return { kind: 'none', reason: 'แสดงเป็นตารางผลลัพธ์อย่างเดียว' }
  const [, distinct, list, rest] = m
  if (/\bgroup\s+by\b/i.test(rest)) {
    if (/^from\s+books\b/i.test(rest) && /group\s+by\s+(books\.)?genre\b/i.test(rest) && /\bgenre\b/i.test(list)) return { kind: 'group-genre' }
    return { kind: 'none', reason: 'ผลจาก GROUP BY ไม่ได้เป็นหนังสือรายเล่ม จึงแสดงเป็นตาราง' }
  }
  if (distinct || /\b(count|sum|avg|min|max)\s*\(/i.test(list)) return { kind: 'none', reason: 'ผลรวม/ค่าสรุปไม่ได้เป็นหนังสือรายเล่ม จึงแสดงเป็นตาราง' }
  // หาว่าตาราง books อยู่ใน FROM/JOIN หรือไม่ (รองรับชื่อย่อ เช่น books b)
  const fromPart = rest.split(/\b(?:where|group|order|limit)\b/i)[0]
  const bm = fromPart.match(/\bbooks\b(?:\s+(?:as\s+)?(\w+))?/i)
  if (!bm) return { kind: 'none', reason: 'คำสั่งนี้ไม่ได้อ่านตาราง books จึงแสดงเป็นตาราง' }
  const ref = bm[1] && !KEYWORDS.test(bm[1]) ? bm[1] : 'books'
  return { kind: 'rows', companion: `SELECT ${ref}.id ${rest}`, ordered: /\border\s+by\b/i.test(rest) }
}

/** วางหนังสือบนชั้น: ชั้นละหนึ่งหมวด เรียงตาม id */
export const SHELF_WIDTH = 5.6
export function bookSize(b: Book) {
  let h = 0; for (const c of b.title) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return { w: 0.3 + (h % 7) * 0.03, h: 0.95 + ((h >> 3) % 6) * 0.06, d: 0.62 + ((h >> 6) % 4) * 0.04, tone: (h >> 9) % 4 }
}
export function shelfIndex(genre: string) { const i = (GENRES as readonly string[]).indexOf(genre); return i < 0 ? GENRES.length : i }
export function layoutBooks(books: Book[]) {
  const pos = new Map<number, { x: number; shelf: number }>()
  const cursor = new Map<number, number>()
  for (const b of [...books].sort((a, c) => a.id - c.id)) {
    const shelf = shelfIndex(b.genre), { w } = bookSize(b), x = cursor.get(shelf) ?? -SHELF_WIDTH / 2 + 0.25
    pos.set(b.id, { x: x + w / 2, shelf }); cursor.set(shelf, x + w + 0.03)
  }
  return pos
}
