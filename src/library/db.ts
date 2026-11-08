// ตัวรันคำสั่งจาก queries.ts ผ่าน SQLite ใน Web Worker และเก็บประวัติไว้แสดงในแผง "SQL ที่ทำงานเบื้องหลัง"
import { db } from '../sql/client'
import type { Cell, Param } from '../sql/types'
import type { Query } from './queries'

export interface LogEntry { id: number; label: string; sql: string; params: Param[]; ok: boolean; summary: string; ms: number }
export interface Result { columns: string[]; rows: Cell[][]; changes: number }

let seq = 0
const listeners = new Set<(e: LogEntry) => void>()
export function onLog(fn: (e: LogEntry) => void) { listeners.add(fn); return () => { listeners.delete(fn) } }

export async function exec(query: Query, { log = true } = {}): Promise<Result> {
  const r = await db.query(query.sql, query.params)
  const entry: LogEntry = {
    id: ++seq, label: query.label, sql: query.sql, params: query.params, ok: r.ok, ms: r.ms,
    summary: r.ok ? (r.columns.length ? `${r.rows.length} แถว` : `เปลี่ยนแปลง ${r.changes} แถว`) : r.error,
  }
  if (log) listeners.forEach(fn => fn(entry))
  if (!r.ok) throw new Error(r.error)
  return { columns: r.columns, rows: r.rows, changes: r.changes }
}

/** แปลงผลลัพธ์เป็น object ตามชื่อคอลัมน์ */
export function objects<T>(r: Result): T[] {
  return r.rows.map(row => Object.fromEntries(r.columns.map((c, i) => [c, row[i]])) as T)
}

export const resetDatabase = () => db.reset()
