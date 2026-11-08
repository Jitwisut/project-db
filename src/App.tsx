import { useCallback, useEffect, useState } from 'react'
import { DataTable } from './components/DataTable'
import { SqlEditor } from './components/SqlEditor'
import { CATEGORIES, SNAPSHOT_SQL, planQuery, type ActiveLoan, type Book } from './library/model'
import { EMPTY_VIZ, Shelf3D, type Viz } from './library/Shelf3D'
import { db, TimeoutError } from './sql/client'
import type { RunOutcome, StatementResult, TableInfo } from './sql/types'

type Rows = Extract<StatementResult, { kind: 'rows' }>
const lastRows = (o: RunOutcome) => o.results.filter((r): r is Rows => r.kind === 'rows').at(-1)

async function loadState() {
  const { outcome } = await db.run(SNAPSHOT_SQL)
  const [b, l] = outcome.results.filter((r): r is Rows => r.kind === 'rows')
  const books: Book[] = (b?.rows ?? []).map(([id, title, author, genre, year]) => ({ id: Number(id), title: String(title), author: String(author), genre: String(genre), year: Number(year) }))
  const loans = new Map<number, ActiveLoan>((l?.rows ?? []).map(([book_id, member, due]) => [Number(book_id), { book_id: Number(book_id), member: String(member), due_date: String(due) }]))
  return { books, loans }
}

interface BookInfo { book: Book; borrowed: number; loan?: ActiveLoan }

export function App() {
  const [cat, setCat] = useState(CATEGORIES[0])
  const [sql, setSql] = useState(CATEGORIES[0].sql)
  const [books, setBooks] = useState<Book[]>([])
  const [loans, setLoans] = useState<Map<number, ActiveLoan>>(new Map())
  const [viz, setViz] = useState<Viz>(EMPTY_VIZ)
  const [outcome, setOutcome] = useState<RunOutcome | null>(null)
  const [status, setStatus] = useState('กำลังเปิดฐานข้อมูล…')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [schema, setSchema] = useState<TableInfo[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [info, setInfo] = useState<BookInfo | null>(null)

  const refresh = useCallback(async () => {
    const s = await loadState(); setBooks(s.books); setLoans(s.loans); setSchema(await db.schema()); return s
  }, [])

  useEffect(() => { refresh().then(() => setStatus('พร้อมใช้งาน · เลือกหมวดแล้วกด RUN')) }, [refresh])

  const choose = (c: typeof CATEGORIES[number]) => { setCat(c); setSql(c.sql); setViz(EMPTY_VIZ); setOutcome(null); setError(null); setStatus('') }

  const run = useCallback(async (text: string) => {
    if (!text.trim()) return
    setBusy(true); setError(null); setSelected(null)
    const before = { books, loans }
    try {
      const plan = planQuery(text)
      const { outcome: out } = await db.run(text)
      setOutcome(out)
      if (!out.ok) { setError(out.error); setStatus(''); setViz(EMPTY_VIZ); await refresh(); return }
      const after = await refresh()
      const main = lastRows(out), ms = `${out.ms.toFixed(1)} ms`
      if (plan.kind === 'rows' && main) {
        // คำสั่งคู่: FROM/WHERE เดิม แต่คืน id ของหนังสือ เพื่อรู้ว่าจะไฮไลต์เล่มไหน
        const { outcome: comp } = await db.run(plan.companion)
        const ids = comp.ok ? (lastRows(comp)?.rows ?? []).map(r => Number(r[0])) : []
        const labels = new Map<number, string>(), ranks = new Map<number, number>()
        if (ids.length <= 10) ids.forEach((id, i) => {
          const row = main.rows[i]; if (!row) return
          const parts = main.columns.map((c, k) => [c, row[k]] as const).filter(([c]) => c !== 'id').slice(0, 2).map(([, v]) => String(v ?? 'NULL'))
          if (!labels.has(id)) labels.set(id, parts.join(' · '))
        })
        if (plan.ordered) ids.forEach((id, i) => { if (!ranks.has(id)) ranks.set(id, i + 1) })
        setViz({ mode: 'rows', ids: new Set(ids), dimOthers: /\bwhere\b|\blimit\b/i.test(text), labels, ranks, groups: new Map() })
        setStatus(`${main.rows.length} แถว · ${ms} · หนังสือที่เกี่ยวข้องบนชั้น ${new Set(ids).size} เล่ม`)
      } else if (plan.kind === 'group-genre' && main) {
        setViz({ ...EMPTY_VIZ, mode: 'group', groups: new Map(main.rows.map(r => [String(r[0]), Number(r[1])])) })
        setStatus(`${main.rows.length} กลุ่ม · ${ms} · ตัวเลขอยู่ที่ปลายชั้นแต่ละหมวด`)
      } else if (plan.kind === 'change') {
        // เทียบข้อมูลก่อน/หลัง เพื่อไฮไลต์หนังสือที่เปลี่ยนจริง
        const prevIds = new Map(before.books.map(b => [b.id, b])), labels = new Map<number, string>()
        for (const b of after.books) {
          const p = prevIds.get(b.id)
          if (!p) labels.set(b.id, 'เพิ่มใหม่')
          else if (p.title !== b.title || p.genre !== b.genre || p.author !== b.author || p.year !== b.year) labels.set(b.id, 'แก้ไขแล้ว')
          const was = before.loans.get(b.id), now = after.loans.get(b.id)
          if (!!was !== !!now) labels.set(b.id, now ? `ถูกยืมโดย ${now.member}` : 'คืนแล้ว')
        }
        const removed = before.books.filter(b => !after.books.some(a => a.id === b.id)).length
        const changes = out.results.reduce((n, r) => n + (r.kind === 'changes' ? r.changes : 0), 0)
        setViz({ ...EMPTY_VIZ, mode: 'rows', ids: new Set(labels.keys()), labels })
        setStatus(`แก้ไขข้อมูล ${changes} แถว · ${ms}${labels.size ? ` · เปลี่ยนบนชั้น ${labels.size} เล่ม` : ''}${removed ? ` · ลบออกจากชั้น ${removed} เล่ม` : ''}`)
      } else {
        setViz(EMPTY_VIZ)
        setStatus(`${main ? `${main.rows.length} แถว · ` : ''}${ms}${plan.kind === 'none' ? ` · ${plan.reason}` : ''}`)
      }
    } catch (e) {
      setError(e instanceof TimeoutError ? 'คำสั่งใช้เวลานานเกินไปจึงถูกหยุด ฐานข้อมูลถูกรีเซ็ตเป็นข้อมูลตั้งต้น' : String((e as Error).message))
      await refresh()
    } finally { setBusy(false) }
  }, [books, loans, refresh])

  const reset = async () => { await db.reset(); await refresh(); setViz(EMPTY_VIZ); setOutcome(null); setError(null); setSelected(null); setStatus('รีเซ็ตฐานข้อมูลเป็นข้อมูลตั้งต้นแล้ว') }

  // ข้อมูลของหนังสือที่คลิก ดึงจากฐานข้อมูลจริง
  useEffect(() => {
    if (selected == null) { setInfo(null); return }
    let alive = true
    db.run(`SELECT b.id, b.title, b.author, b.genre, b.year, (SELECT COUNT(*) FROM loans WHERE book_id = b.id) FROM books b WHERE b.id = ${Number(selected)};`).then(({ outcome: o }) => {
      const r = lastRows(o)?.rows[0]; if (!alive || !r) return
      setInfo({ book: { id: Number(r[0]), title: String(r[1]), author: String(r[2]), genre: String(r[3]), year: Number(r[4]) }, borrowed: Number(r[5]), loan: loans.get(Number(r[0])) })
    })
    return () => { alive = false }
  }, [selected, loans])

  const result = outcome ? lastRows(outcome) : undefined
  return <div className="app">
    <header className="top">
      <div className="brand"><span className="mark" /> BOOK <i>/</i> DB</div>
      <p>ระบบฐานข้อมูลห้องสมุด · SQLite ทำงานในเบราว์เซอร์ · หนังสือ 1 เล่ม = 1 แถวในตาราง books</p>
    </header>

    <aside className="panel">
      <nav className="tabs" aria-label="หมวดคำสั่ง SQL">
        {CATEGORIES.map(c => <button key={c.id} className={c.id === cat.id ? 'on' : ''} aria-pressed={c.id === cat.id} onClick={() => choose(c)}>{c.label}</button>)}
      </nav>
      <h1>{cat.label}</h1>
      <p className="thai">{cat.thai}</p>
      <SqlEditor value={sql} onChange={setSql} onRun={run} label="SQL" minRows={5} />
      <div className="actions">
        <button className="run" onClick={() => run(sql)} disabled={busy}>▶ RUN</button>
        <button onClick={() => setSql(cat.sql)}>คืนค่าตัวอย่าง</button>
        <button onClick={reset}>RESET DB</button>
        <span className="hint">⌘/Ctrl + Enter</span>
      </div>
      {error ? <div className="error" role="alert"><b>SQL ERROR</b><p>{error}</p></div> : <div className="status" role="status">{status}</div>}
      {result && <div className="result"><DataTable columns={result.columns} rows={result.rows} compact /></div>}
      {outcome?.ok && !result && <div className="status">ไม่มีแถวคืนกลับมา (คำสั่งแก้ไขข้อมูล)</div>}
      <details className="schema">
        <summary>ตารางในฐานข้อมูล ({schema.length})</summary>
        {schema.map(t => <div key={t.name} className="schema-table">
          <b>{t.name}</b> <span>{t.rowCount} แถว</span>
          <ul>{t.columns.map(c => <li key={c.name}><code>{c.name}</code> <span>{c.type}{c.pk ? ' · PK' : ''}{c.notNull ? ' · NOT NULL' : ''}</span></li>)}</ul>
        </div>)}
      </details>
    </aside>

    <main className="stage">
      <Shelf3D books={books} loans={loans} viz={viz} selected={selected} onPick={setSelected} />
      <div className="legend"><span><i className="lit" /> อยู่ในผลลัพธ์</span><span><i className="loan" /> ถูกยืมอยู่ (เอียงออกจากชั้น)</span><span>ลากเพื่อหมุน · scroll เพื่อซูม · คลิกหนังสือเพื่อดูข้อมูล</span></div>
      {info && <div className="info">
        <button className="close" onClick={() => setSelected(null)} aria-label="ปิด">✕</button>
        <small>books · id {info.book.id}</small>
        <h2>{info.book.title}</h2>
        <dl>
          <dt>author</dt><dd>{info.book.author}</dd>
          <dt>genre</dt><dd>{info.book.genre}</dd>
          <dt>year</dt><dd>{info.book.year}</dd>
          <dt>ยืมไปแล้ว</dt><dd>{info.borrowed} ครั้ง</dd>
          <dt>สถานะ</dt><dd>{info.loan ? `ยืมโดย ${info.loan.member} · คืน ${info.loan.due_date}` : 'อยู่บนชั้น'}</dd>
        </dl>
      </div>}
    </main>
  </div>
}
