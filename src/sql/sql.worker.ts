/// <reference lib="webworker" />
// SQLite (sql.js / WebAssembly) ทำงานใน Web Worker แยกจากหน้าเว็บ หน้าเว็บจึงไม่ค้างระหว่างรัน SQL
// ถ้าคำสั่งค้างนานเกินไป ฝั่งหน้าเว็บ (client.ts) จะปิด Worker นี้แล้วสร้างใหม่
import initSqlJs, { type Database } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { createSeededDb, queryOnce } from './engine'
import type { WorkerRequest, WorkerResponse } from './types'

const ready = initSqlJs({ locateFile: () => wasmUrl })
let db: Database | null = null

async function freshDb(): Promise<Database> {
  const SQL = await ready
  db?.close()
  db = createSeededDb(SQL)
  return db
}

const post = (msg: WorkerResponse) => (self as DedicatedWorkerGlobalScope).postMessage(msg)

// ทำทีละคำขอตามลำดับ
let queue: Promise<void> = Promise.resolve()
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  queue = queue.then(() => handle(event.data))
}

async function handle(req: WorkerRequest) {
  try {
    if (req.type === 'query') post({ id: req.id, type: 'query', result: queryOnce(db ?? (await freshDb()), req.sql, req.params) })
    else { await freshDb(); post({ id: req.id, type: 'reset' }) }
  } catch (err) {
    post({ id: req.id, type: 'fatal', error: err instanceof Error ? err.message : String(err) })
  }
}
