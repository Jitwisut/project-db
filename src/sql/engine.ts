// แกนประมวลผล SQL: สร้างฐานข้อมูลจาก seed และรันคำสั่งแบบ prepared statement
// เป็น pure function จึงใช้ได้ทั้งใน Web Worker (ตอนรันเว็บ) และใน Vitest (ตอนรันเทสต์)
import type { Database, SqlJsStatic, SqlValue } from 'sql.js'
import { SEED_SQL } from './seed'
import type { Param, QueryResult, TableInfo } from './types'

export function createSeededDb(SQL: SqlJsStatic): Database {
  const db = new SQL.Database()
  db.run(SEED_SQL)
  return db
}

function normalize(v: SqlValue): string | number | null {
  if (v instanceof Uint8Array) return `<BLOB ${v.length} bytes>`
  return v
}

/** อ่านโครงสร้างตารางทั้งหมดในฐานข้อมูล (ชื่อคอลัมน์ ชนิด และจำนวนแถว) */
export function readSchema(db: Database): TableInfo[] {
  const names = db.exec(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
  if (names.length === 0) return []
  return names[0].values.map(([name]) => {
    const table = String(name)
    const quoted = '"' + table.replace(/"/g, '""') + '"'
    const info = db.exec(`PRAGMA table_info(${quoted})`)
    const count = db.exec(`SELECT COUNT(*) FROM ${quoted}`)
    return {
      name: table,
      rowCount: Number(count[0]?.values[0]?.[0] ?? 0),
      columns: (info[0]?.values ?? []).map((c) => ({
        name: String(c[1]),
        type: String(c[2] || ''),
        notNull: c[3] === 1,
        pk: Number(c[5]) > 0,
      })),
    }
  })
}

/** รันคำสั่งเดียวแบบ prepared statement: ค่าจากผู้ใช้ถูกส่งผ่าน ? (bind) ไม่ได้ต่อเข้าไปในข้อความ SQL */
export function queryOnce(db: Database, sql: string, params: Param[] = []): QueryResult {
  const started = performance.now()
  let stmt
  try {
    stmt = db.prepare(sql)
    stmt.bind(params)
    const columns = stmt.getColumnNames(), rows: (string | number | null)[][] = []
    while (stmt.step()) rows.push(stmt.get().map(normalize))
    return { ok: true, columns, rows, changes: columns.length ? 0 : db.getRowsModified(), ms: performance.now() - started }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), ms: performance.now() - started }
  } finally {
    stmt?.free()
  }
}
