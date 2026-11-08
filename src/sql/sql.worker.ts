/// <reference lib="webworker" />
// SQLite (sql.js / WebAssembly) ทำงานใน Web Worker แยกจากหน้าเว็บ
// ถ้า query ค้าง ฝั่งหน้าเว็บจะ terminate worker นี้แล้วสร้างใหม่
import initSqlJs, { type Database } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { createSeededDb, queryOnce, readSchema, runSql } from './engine'
import type { WorkerRequest, WorkerResponse } from './types'

const ready = initSqlJs({ locateFile: () => wasmUrl })
let db: Database | null = null

async function freshDb(): Promise<Database> {
  const SQL = await ready
  db?.close()
  db = createSeededDb(SQL)
  return db
}

async function currentDb(): Promise<Database> {
  return db ?? freshDb()
}

const post = (msg: WorkerResponse) => (self as DedicatedWorkerGlobalScope).postMessage(msg)

// ทำทีละคำขอตามลำดับ เพื่อไม่ให้คำขอหนึ่งรีเซ็ตฐานข้อมูลระหว่างที่อีกคำขอกำลังใช้
let queue: Promise<void> = Promise.resolve()
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  queue = queue.then(() => handle(event.data))
}

async function handle(req: WorkerRequest) {
  try {
    if (req.type === 'query') {
      post({ id: req.id, type: 'query', result: queryOnce(await currentDb(), req.sql, req.params) })
    } else if (req.type === 'run') {
      const target = req.fresh ? await freshDb() : await currentDb()
      const outcome = runSql(target, req.sql)
      post({ id: req.id, type: 'run', outcome, schema: readSchema(target) })
    } else if (req.type === 'reset') {
      post({ id: req.id, type: 'reset', schema: readSchema(await freshDb()) })
    } else {
      post({ id: req.id, type: 'schema', schema: readSchema(await currentDb()) })
    }
  } catch (err) {
    post({ id: req.id, type: 'fatal', error: err instanceof Error ? err.message : String(err) })
  }
}
