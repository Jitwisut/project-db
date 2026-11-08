// SQL ทุกคำสั่งที่แอปใช้ อยู่ในไฟล์นี้ไฟล์เดียว
// ทุกคำสั่งรับค่าจากผู้ใช้ผ่าน ? (parameter binding) ไม่ต่อข้อความเข้าไปใน SQL จึงปลอดภัยจาก SQL injection
// แต่ละฟังก์ชันคืน { label, sql, params } แล้ว db.ts จะเป็นตัวรันจริงและบันทึกลงแผง "SQL ที่ทำงานเบื้องหลัง"

import type { Param } from '../sql/types'

export interface Query { label: string; sql: string; params: Param[] }
const q = (label: string, sql: string, params: Param[] = []): Query => ({ label, sql: sql.trim(), params })

export const GENRES = ['Fiction', 'Science', 'History', 'Technology', 'Art'] as const
export const SORTS = { id: 'id', title: 'title', 'year-desc': 'year DESC', 'year-asc': 'year ASC' } as const
export type Sort = keyof typeof SORTS

/* ---------- ชั้นหนังสือ ---------- */
export const shelfState = () => q('โหลดชั้นหนังสือ', `
SELECT b.id, b.title, b.author, b.genre, b.year, m.name AS borrower, l.due_date
FROM books b
LEFT JOIN loans l ON l.book_id = b.id AND l.returned = 0
LEFT JOIN members m ON m.id = l.member_id
ORDER BY b.id`)

/** ค้นหา + กรองหมวด + เรียงลำดับ (WHERE / LIKE / ORDER BY) */
export function searchBooks(text: string, genre: string | null, sort: Sort) {
  const where = ['(title LIKE ? OR author LIKE ?)'], params: Param[] = [`%${text}%`, `%${text}%`]
  if (genre) { where.push('genre = ?'); params.push(genre) }
  return q('ค้นหาหนังสือ', `
SELECT id, title, author, genre, year
FROM books
WHERE ${where.join(' AND ')}
ORDER BY ${SORTS[sort]}`, params)
}

export const bookDetail = (id: number) => q('ดูข้อมูลหนังสือ', `
SELECT id, title, author, genre, year
FROM books
WHERE id = ?`, [id])

/** ประวัติการยืมของหนังสือ 1 เล่ม (JOIN loans กับ members) */
export const bookHistory = (id: number) => q('ประวัติการยืม', `
SELECT l.id, m.name, l.loan_date, l.due_date, l.returned
FROM loans l
JOIN members m ON m.id = l.member_id
WHERE l.book_id = ?
ORDER BY l.loan_date DESC`, [id])

export const addBook = (title: string, author: string, genre: string, year: number) => q('เพิ่มหนังสือ', `
INSERT INTO books (title, author, genre, year)
VALUES (?, ?, ?, ?)`, [title, author, genre, year])

export const deleteBook = (id: number) => q('ลบหนังสือ', `
DELETE FROM books
WHERE id = ?`, [id])

/* ---------- ยืม / คืน ---------- */
export const borrow = (bookId: number, memberId: number) => q('ยืมหนังสือ', `
INSERT INTO loans (book_id, member_id, loan_date, due_date)
VALUES (?, ?, date('now'), date('now', '+14 days'))`, [bookId, memberId])

export const returnLoan = (loanId: number) => q('คืนหนังสือ', `
UPDATE loans
SET returned = 1
WHERE id = ?`, [loanId])

/** รายการที่ยังไม่คืน พร้อมบอกว่าเกินกำหนดหรือยัง (JOIN 3 ตาราง) */
export const activeLoans = () => q('รายการยืมที่ยังไม่คืน', `
SELECT l.id, b.id AS book_id, b.title, m.name, l.due_date,
       l.due_date < date('now') AS overdue
FROM loans l
JOIN books b ON b.id = l.book_id
JOIN members m ON m.id = l.member_id
WHERE l.returned = 0
ORDER BY l.due_date`)

/* ---------- สมาชิก ---------- */
/** สมาชิกทุกคน + จำนวนเล่มที่ยืมอยู่ (LEFT JOIN + GROUP BY: คนที่ไม่ได้ยืมก็ยังแสดง เป็น 0) */
export const members = () => q('รายชื่อสมาชิก', `
SELECT m.id, m.name, m.faculty, m.year_level, COUNT(l.id) AS borrowing
FROM members m
LEFT JOIN loans l ON l.member_id = m.id AND l.returned = 0
GROUP BY m.id
ORDER BY m.name`)

export const memberBooks = (memberId: number) => q('หนังสือที่สมาชิกยืมอยู่', `
SELECT b.id, b.title, l.due_date
FROM loans l
JOIN books b ON b.id = l.book_id
WHERE l.member_id = ? AND l.returned = 0`, [memberId])

export const addMember = (name: string, faculty: string, year: number) => q('เพิ่มสมาชิก', `
INSERT INTO members (name, faculty, year_level)
VALUES (?, ?, ?)`, [name, faculty, year])

/* ---------- สถิติ ---------- */
export const genreCounts = () => q('จำนวนหนังสือแต่ละหมวด', `
SELECT genre, COUNT(*) AS total
FROM books
GROUP BY genre`)

export const topBorrowers = () => q('สมาชิกที่ยืมบ่อยที่สุด', `
SELECT m.name, COUNT(*) AS loans
FROM loans l
JOIN members m ON m.id = l.member_id
GROUP BY m.id
ORDER BY loans DESC, m.name
LIMIT 3`)

/** หนังสือที่ถูกยืมตั้งแต่ 2 ครั้งขึ้นไป (GROUP BY + HAVING) */
export const popularBooks = () => q('หนังสือยอดนิยม', `
SELECT b.title, COUNT(l.id) AS times
FROM books b
JOIN loans l ON l.book_id = b.id
GROUP BY b.id
HAVING COUNT(l.id) >= 2
ORDER BY times DESC`)
