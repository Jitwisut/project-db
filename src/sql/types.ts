export type Cell = string | number | null
export type Param = string | number | null

export type QueryResult =
  | { ok: true; columns: string[]; rows: Cell[][]; changes: number; ms: number }
  | { ok: false; error: string; ms: number }

export interface ColumnInfo {
  name: string
  type: string
  notNull: boolean
  pk: boolean
}

export interface TableInfo {
  name: string
  rowCount: number
  columns: ColumnInfo[]
}

/** ข้อความที่หน้าเว็บส่งไปหา Worker และที่ Worker ตอบกลับ */
export type WorkerRequest =
  | { id: number; type: 'query'; sql: string; params: Param[] }
  | { id: number; type: 'reset' }

export type WorkerResponse =
  | { id: number; type: 'query'; result: QueryResult }
  | { id: number; type: 'reset' }
  | { id: number; type: 'fatal'; error: string }
