// ตัวกลางคุยกับ Worker: ส่งคำสั่ง รอผล และตัดการทำงานเมื่อเกินเวลา
import SqlWorker from './sql.worker?worker'
import type { Param, QueryResult, WorkerRequest, WorkerResponse } from './types'

export const TIMEOUT_MS = 4000

type Pending = { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void; timer: number }
type Request = WorkerRequest extends infer R ? (R extends unknown ? Omit<R, 'id'> : never) : never

export class TimeoutError extends Error {}

class SqlClient {
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

  /** คำสั่งค้าง: ปิด Worker แล้วสร้างใหม่ ฐานข้อมูลจะกลับเป็นข้อมูลตั้งต้น */
  private restart() {
    this.worker.terminate()
    for (const p of this.pending.values()) {
      clearTimeout(p.timer)
      p.reject(new TimeoutError(`หมดเวลา ${TIMEOUT_MS / 1000} วินาที`))
    }
    this.pending.clear()
    this.worker = this.spawn()
  }

  private send(req: Request): Promise<WorkerResponse> {
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => this.restart(), TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timer })
      this.worker.postMessage({ ...req, id } as WorkerRequest)
    })
  }

  /** รัน SQL 1 คำสั่ง ค่าใน params จะถูกผูกเข้ากับเครื่องหมาย ? ตามลำดับ */
  async query(sql: string, params: Param[] = []): Promise<QueryResult> {
    const res = await this.send({ type: 'query', sql, params })
    if (res.type !== 'query') throw new Error('unexpected response')
    return res.result
  }

  /** ล้างฐานข้อมูลแล้วสร้างใหม่จากข้อมูลตั้งต้น (seed.ts) */
  async reset(): Promise<void> {
    await this.send({ type: 'reset' })
  }
}

export const db = new SqlClient()
