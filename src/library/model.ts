// ชนิดข้อมูลและการจัดวางหนังสือบนชั้น 3D (หนังสือ 1 เล่ม = 1 แถวในตาราง books)

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
