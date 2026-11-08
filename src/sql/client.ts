// ตัวกลางคุยกับ Worker: ส่งคำสั่ง รอผล และตัดการทำงานเมื่อเกินเวลา
import SqlWorker from './sql.worker?worker'
import type { RunOutcome, TableInfo, WorkerRequest, WorkerResponse } from './types'

export const TIMEOUT_MS = 4000

type Pending = { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void; timer: number }

export class TimeoutError extends Error {}

export class SqlClient {
  private worker: Worker
  private seq = 0
  private pending = new Map<number, Pending>()

  constructor() {
    this.worker = this.spawn()
  }

  private spawn(): Worker {
    const w = new SqlWorker()
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const p = this.pending.get(e.data.id)
      if (!p) return
      clearTimeout(p.timer)
      this.pending.delete(e.data.id)
      if (e.data.type === 'fatal') p.reject(new Error(e.data.error))
      else p.resolve(e.data)
    }
    return w
  }

  /** query วนไม่จบ: ฆ่า worker ทิ้งแล้วสร้างใหม่ ฐานข้อมูลจะกลับเป็นข้อมูลตั้งต้น */
  private restart() {
    this.worker.terminate()
    for (const p of this.pending.values()) {
      clearTimeout(p.timer)
      p.reject(new TimeoutError(`หมดเวลา ${TIMEOUT_MS / 1000} วินาที`))
    }
    this.pending.clear()
    this.worker = this.spawn()
  }

  private send(req: WorkerRequest extends infer R ? (R extends unknown ? Omit<R, 'id'> : never) : never): Promise<WorkerResponse> {
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => this.restart(), TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timer })
      this.worker.postMessage({ ...req, id } as WorkerRequest)
    })
  }

  async run(sql: string, fresh = false): Promise<{ outcome: RunOutcome; schema: TableInfo[] }> {
    const res = await this.send({ type: 'run', sql, fresh })
    if (res.type !== 'run') throw new Error('unexpected response')
    return { outcome: res.outcome, schema: res.schema }
  }

  async reset(): Promise<TableInfo[]> {
    const res = await this.send({ type: 'reset' })
    return 'schema' in res ? res.schema : []
  }

  async schema(): Promise<TableInfo[]> {
    const res = await this.send({ type: 'schema' })
    return 'schema' in res ? res.schema : []
  }
}

// worker ตัวเดียวของห้องสมุด ข้อมูลที่แก้ไขจะอยู่จนกว่าจะกด RESET หรือรีเฟรชหน้า
export const db = new SqlClient()
