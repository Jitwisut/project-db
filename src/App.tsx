import { useCallback, useEffect, useMemo, useState } from 'react'
import { highlightSql } from './components/highlight'
import { exec, objects, onLog, resetDatabase, type LogEntry } from './library/db'
import type { ActiveLoan, Book } from './library/model'
import * as Q from './library/queries'
import { EMPTY_VIZ, Shelf3D, type Viz } from './library/Shelf3D'

type View = 'shelf' | 'members' | 'loans' | 'stats'
const VIEWS: { id: View; label: string; no: string; title: string; thai: string }[] = [
  { id: 'shelf', label: 'ชั้นหนังสือ', no: '01', title: 'Browse the shelf.', thai: 'ค้นหาตามชื่อหรือผู้แต่ง กรองตามหมวด แล้วเรียงลำดับ หนังสือที่ตรงจะเลื่อนออกมาจากชั้น คลิกหนังสือเพื่อยืม คืน หรือดูประวัติ' },
  { id: 'members', label: 'สมาชิก', no: '02', title: 'Who reads what.', thai: 'รายชื่อสมาชิกพร้อมจำนวนเล่มที่ยืมอยู่ เลือกสมาชิกเพื่อดูว่าหนังสือเล่มไหนอยู่กับใคร หรือเพิ่มสมาชิกใหม่' },
  { id: 'loans', label: 'ยืม-คืน', no: '03', title: 'Books out in the world.', thai: 'หนังสือที่ยังไม่คืนทั้งหมด เรียงตามวันกำหนดคืน รายการที่เกินกำหนดจะมีเครื่องหมาย ⚠ กดคืนได้จากตรงนี้' },
  { id: 'stats', label: 'สถิติ', no: '04', title: 'Patterns in the library.', thai: 'สรุปข้อมูลด้วย GROUP BY: จำนวนหนังสือแต่ละหมวด (แสดงที่ปลายชั้น) สมาชิกที่ยืมบ่อย และหนังสือยอดนิยม' },
]

interface ShelfRow extends Book { borrower: string | null; due_date: string | null }
interface Member { id: number; name: string; faculty: string; year_level: number; borrowing: number }
interface Loan { id: number; book_id: number; title: string; name: string; due_date: string; overdue: number }
interface History { id: number; name: string; loan_date: string; due_date: string; returned: number }

export function App() {
  const [view, setView] = useState<View>('shelf')
  const [books, setBooks] = useState<ShelfRow[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [logOpen, setLogOpen] = useState(true)
  const [toast, setToast] = useState<{ text: string; err?: boolean } | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [memberCount, setMemberCount] = useState(0)

  useEffect(() => onLog(e => setLog(l => [e, ...l].slice(0, 8))), [])
  const say = (text: string, err = false) => { setToast({ text, err }); window.setTimeout(() => setToast(t => (t?.text === text ? null : t)), 3200) }

  const refresh = useCallback(async () => {
    setBooks(objects<ShelfRow>(await exec(Q.shelfState(), { log: false })))
    setMemberCount(objects<Member>(await exec(Q.members(), { log: false })).length)
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const loans = useMemo(() => new Map<number, ActiveLoan>(books.filter(b => b.borrower).map(b => [b.id, { book_id: b.id, member: b.borrower!, due_date: b.due_date! }])), [books])
  const [viz, setViz] = useState<Viz>(EMPTY_VIZ)
  const current = VIEWS.find(v => v.id === view)!
  const act = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); await refresh(); if (ok) say(ok) } catch (e) { say((e as Error).message, true) } }

  return <div className="experience">
    <div className="stage"><Shelf3D books={books} loans={loans} viz={viz} selected={selected} onPick={setSelected} /></div>
    <div className="vignette" />

    <header className="topbar">
      <div className="wordmark"><span className="symbol">▤</span>BOOK<span>DB</span><small>LIBRARY DATABASE</small></div>
      <nav aria-label="เมนูหลัก">
        {VIEWS.map(v => <button key={v.id} className={v.id === view ? 'active' : ''} aria-pressed={v.id === view} onClick={() => { setView(v.id); setViz(EMPTY_VIZ) }}>{v.label}</button>)}
      </nav>
      <div className="system"><i /> SQLITE ONLINE
        <button className="ghost" onClick={() => act(async () => { await resetDatabase(); setSelected(null); setViz(EMPTY_VIZ) }, 'รีเซ็ตฐานข้อมูลเป็นข้อมูลตั้งต้นแล้ว')}>↺ RESET DB</button>
      </div>
    </header>

    <section className="heading">
      <div className="eyebrow"><span className="line" /> LIBRARY / {current.no}</div>
      <h1>{current.title}</h1>
      <p>{current.thai}</p>
    </section>

    <aside className="side glass" aria-label={current.label}>
      {view === 'shelf' && <ShelfPanel setViz={setViz} onPick={setSelected} act={act} books={books} />}
      {view === 'members' && <MembersPanel setViz={setViz} act={act} books={books} />}
      {view === 'loans' && <LoansPanel setViz={setViz} onPick={setSelected} act={act} books={books} />}
      {view === 'stats' && <StatsPanel setViz={setViz} books={books} />}
    </aside>

    {selected != null && <BookDrawer id={selected} books={books} act={act} onClose={() => setSelected(null)} />}

    <section className={`sqllog glass${logOpen ? '' : ' closed'}`} aria-label="SQL ที่ทำงานเบื้องหลัง">
      <button className="sqllog-head" onClick={() => setLogOpen(o => !o)} aria-expanded={logOpen}>
        <span><i /> SQL ที่ทำงานเบื้องหลัง</span><span>{logOpen ? '—' : '+'}</span>
      </button>
      {logOpen && <div className="sqllog-body">
        {log.length === 0 && <p className="muted">ใช้งานแอปแล้วคำสั่ง SQL จริงที่ถูกส่งไปยัง SQLite จะแสดงที่นี่</p>}
        {log.map(e => <article key={e.id} className={e.ok ? '' : 'err'}>
          <header><b>{e.label}</b><span>{e.summary} · {e.ms.toFixed(1)} ms</span></header>
          <pre>{highlightSql(e.sql)}</pre>
          {e.params.length > 0 && <div className="params">? = {e.params.map(p => JSON.stringify(p)).join(', ')}</div>}
        </article>)}
      </div>}
    </section>

    {toast && <div className={`toast${toast.err ? ' err' : ''}`} role="status">{toast.err ? 'SQL ERROR · ' : ''}{toast.text}</div>}

    <footer className="statusbar">
      <span><i /> LIBRARY DATABASE <b>/</b> LOCAL SQLITE</span>
      <span className="hint">ลากเพื่อหมุน · scroll เพื่อซูม · คลิกหนังสือเพื่อเปิดข้อมูล</span>
      <span>{books.length} BOOKS · {memberCount} MEMBERS · {loans.size} ON LOAN</span>
    </footer>
  </div>
}

type Act = (fn: () => Promise<unknown>, ok?: string) => Promise<void>

/* ---------- 01 ชั้นหนังสือ: ค้นหา กรอง เรียง เพิ่ม ---------- */
function ShelfPanel({ setViz, onPick, act, books }: { setViz: (v: Viz) => void; onPick: (id: number) => void; act: Act; books: ShelfRow[] }) {
  const [text, setText] = useState(''), [genre, setGenre] = useState<string | null>(null), [sort, setSort] = useState<Q.Sort>('id')
  const [results, setResults] = useState<Book[]>([])
  const [adding, setAdding] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(async () => {
      const rows = objects<Book>(await exec(Q.searchBooks(text, genre, sort)))
      setResults(rows)
      const filtered = text.trim() !== '' || genre !== null
      const ranks = new Map<number, number>(); if (sort !== 'id' && rows.length <= 12) rows.forEach((b, i) => ranks.set(b.id, i + 1))
      setViz({ ...EMPTY_VIZ, mode: 'rows', ids: filtered ? new Set(rows.map(b => b.id)) : new Set(), dimOthers: filtered, ranks })
    }, 220)
    return () => window.clearTimeout(t)
  }, [text, genre, sort, books.length, setViz])

  return <>
    <label className="field"><span>ค้นหา (ชื่อหนังสือ / ผู้แต่ง)</span>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="เช่น sql, orwell" /></label>
    <div className="chips" role="group" aria-label="หมวด">
      <button className={genre === null ? 'on' : ''} onClick={() => setGenre(null)}>ทั้งหมด</button>
      {Q.GENRES.map(g => <button key={g} className={genre === g ? 'on' : ''} onClick={() => setGenre(g)}>{g}</button>)}
    </div>
    <label className="field inline"><span>เรียงตาม</span>
      <select value={sort} onChange={e => setSort(e.target.value as Q.Sort)}>
        <option value="id">ลำดับที่เพิ่ม</option><option value="title">ชื่อ A–Z</option>
        <option value="year-desc">ปีใหม่ → เก่า</option><option value="year-asc">ปีเก่า → ใหม่</option>
      </select></label>
    <div className="section-label">{results.length} เล่ม</div>
    <ul className="list">
      {results.map(b => <li key={b.id}><button onClick={() => onPick(b.id)}>
        <span className="no">{String(b.id).padStart(2, '0')}</span><span className="main">{b.title}<small>{b.author} · {b.year}</small></span><span className="tag">{b.genre}</span>
      </button></li>)}
    </ul>
    <button className="ghost wide" onClick={() => setAdding(a => !a)}>{adding ? '× ยกเลิก' : '+ เพิ่มหนังสือ'}</button>
    {adding && <AddBookForm onSubmit={async (t, a, g, y) => { await act(() => exec(Q.addBook(t, a, g, y)), `เพิ่ม "${t}" ลงชั้น ${g} แล้ว`); setAdding(false) }} />}
  </>
}
function AddBookForm({ onSubmit }: { onSubmit: (t: string, a: string, g: string, y: number) => void }) {
  const [t, setT] = useState(''), [a, setA] = useState(''), [g, setG] = useState<string>('Science'), [y, setY] = useState('2024')
  return <form className="form" onSubmit={e => { e.preventDefault(); if (t.trim() && a.trim()) onSubmit(t.trim(), a.trim(), g, Number(y)) }}>
    <input placeholder="ชื่อหนังสือ" value={t} onChange={e => setT(e.target.value)} required />
    <input placeholder="ผู้แต่ง" value={a} onChange={e => setA(e.target.value)} required />
    <div className="row"><select value={g} onChange={e => setG(e.target.value)}>{Q.GENRES.map(x => <option key={x}>{x}</option>)}</select>
      <input type="number" value={y} onChange={e => setY(e.target.value)} min={1} max={2100} /></div>
    <button className="primary">INSERT INTO books</button>
  </form>
}

/* ---------- 02 สมาชิก ---------- */
function MembersPanel({ setViz, act, books }: { setViz: (v: Viz) => void; act: Act; books: ShelfRow[] }) {
  const [list, setList] = useState<Member[]>([]), [sel, setSel] = useState<number | null>(null), [adding, setAdding] = useState(false)
  useEffect(() => { exec(Q.members()).then(r => setList(objects<Member>(r))) }, [books])
  useEffect(() => {
    if (sel == null) { setViz(EMPTY_VIZ); return }
    exec(Q.memberBooks(sel)).then(r => {
      const rows = objects<{ id: number; title: string; due_date: string }>(r)
      setViz({ ...EMPTY_VIZ, mode: 'rows', ids: new Set(rows.map(x => x.id)), dimOthers: true, labels: new Map(rows.map(x => [x.id, `คืน ${x.due_date}`])) })
    })
  }, [sel, books, setViz])
  return <>
    <div className="section-label">{list.length} คน · คลิกเพื่อดูหนังสือที่ยืมอยู่บนชั้น</div>
    <ul className="list">
      {list.map(m => <li key={m.id}><button className={sel === m.id ? 'on' : ''} onClick={() => setSel(sel === m.id ? null : m.id)}>
        <span className="no">{String(m.id).padStart(2, '0')}</span><span className="main">{m.name}<small>{m.faculty} · ปี {m.year_level}</small></span>
        <span className={`count${m.borrowing ? ' hot' : ''}`}>{m.borrowing} เล่ม</span>
      </button></li>)}
    </ul>
    <button className="ghost wide" onClick={() => setAdding(a => !a)}>{adding ? '× ยกเลิก' : '+ เพิ่มสมาชิก'}</button>
    {adding && <AddMemberForm onSubmit={async (n, f, y) => { await act(() => exec(Q.addMember(n, f, y)), `เพิ่มสมาชิก ${n} แล้ว`); setAdding(false) }} />}
  </>
}
function AddMemberForm({ onSubmit }: { onSubmit: (n: string, f: string, y: number) => void }) {
  const [n, setN] = useState(''), [f, setF] = useState('IT'), [y, setY] = useState('1')
  return <form className="form" onSubmit={e => { e.preventDefault(); if (n.trim()) onSubmit(n.trim(), f.trim(), Number(y)) }}>
    <input placeholder="ชื่อ" value={n} onChange={e => setN(e.target.value)} required />
    <div className="row"><input placeholder="คณะ" value={f} onChange={e => setF(e.target.value)} required />
      <input type="number" value={y} onChange={e => setY(e.target.value)} title="ชั้นปี (1–4)" /></div>
    <p className="note">ชั้นปีต้องอยู่ระหว่าง 1–4 (CHECK constraint) ลองใส่ 5 ดูได้</p>
    <button className="primary">INSERT INTO members</button>
  </form>
}

/* ---------- 03 ยืม-คืน ---------- */
function LoansPanel({ setViz, onPick, act, books }: { setViz: (v: Viz) => void; onPick: (id: number) => void; act: Act; books: ShelfRow[] }) {
  const [list, setList] = useState<Loan[]>([])
  useEffect(() => {
    exec(Q.activeLoans()).then(r => {
      const rows = objects<Loan>(r); setList(rows)
      setViz({ ...EMPTY_VIZ, mode: 'rows', ids: new Set(rows.map(l => l.book_id)), dimOthers: true, labels: new Map(rows.map(l => [l.book_id, `${l.overdue ? '⚠ ' : ''}${l.name}`])) })
    })
  }, [books, setViz])
  const overdue = list.filter(l => l.overdue).length
  return <>
    <div className="section-label">{list.length} รายการยังไม่คืน · <span className="warn">{overdue} เกินกำหนด</span></div>
    <ul className="list">
      {list.map(l => <li key={l.id}><div className={`loan${l.overdue ? ' late' : ''}`}>
        <button className="main link" onClick={() => onPick(l.book_id)}>{l.title}<small>{l.name} · คืน {l.due_date}{l.overdue ? ' · เกินกำหนด' : ''}</small></button>
        <button className="ghost" onClick={() => act(() => exec(Q.returnLoan(l.id)), `คืน "${l.title}" แล้ว`)}>คืน</button>
      </div></li>)}
    </ul>
  </>
}

/* ---------- 04 สถิติ ---------- */
function StatsPanel({ setViz, books }: { setViz: (v: Viz) => void; books: ShelfRow[] }) {
  const [genres, setGenres] = useState<{ genre: string; total: number }[]>([])
  const [top, setTop] = useState<{ name: string; loans: number }[]>([])
  const [popular, setPopular] = useState<{ title: string; times: number }[]>([])
  useEffect(() => {
    (async () => {
      const g = objects<{ genre: string; total: number }>(await exec(Q.genreCounts()))
      setGenres(g); setViz({ ...EMPTY_VIZ, mode: 'group', groups: new Map(g.map(x => [x.genre, x.total])) })
      setTop(objects(await exec(Q.topBorrowers())))
      setPopular(objects(await exec(Q.popularBooks())))
    })()
  }, [books, setViz])
  const max = Math.max(1, ...genres.map(g => g.total))
  return <>
    <div className="section-label">หนังสือแต่ละหมวด · GROUP BY genre</div>
    {genres.map(g => <div key={g.genre} className="bar"><span>{g.genre}</span><i style={{ width: `${(g.total / max) * 100}%` }} /><b>{g.total}</b></div>)}
    <div className="section-label">ยืมบ่อยที่สุด · ORDER BY … LIMIT 3</div>
    <ol className="rank">{top.map(t => <li key={t.name}>{t.name}<b>{t.loans} ครั้ง</b></li>)}</ol>
    <div className="section-label">ยืม ≥ 2 ครั้ง · HAVING</div>
    <ol className="rank">{popular.map(p => <li key={p.title}>{p.title}<b>{p.times} ครั้ง</b></li>)}</ol>
  </>
}

/* ---------- การ์ดหนังสือ: ดูข้อมูล ยืม คืน ลบ ---------- */
function BookDrawer({ id, books, act, onClose }: { id: number; books: ShelfRow[]; act: Act; onClose: () => void }) {
  const [book, setBook] = useState<Book | null>(null), [history, setHistory] = useState<History[]>([])
  const [members, setMembers] = useState<Member[]>([]), [who, setWho] = useState<number | ''>('')
  useEffect(() => {
    (async () => {
      const b = objects<Book>(await exec(Q.bookDetail(id)))[0]; setBook(b ?? null)
      if (!b) return
      setHistory(objects<History>(await exec(Q.bookHistory(id))))
      setMembers(objects<Member>(await exec(Q.members(), { log: false })))
    })()
  }, [id, books])
  if (!book) return null
  const open = history.find(h => !h.returned)
  return <aside className="drawer glass" aria-label="ข้อมูลหนังสือ">
    <header><span>BOOKS · ID {book.id}</span><button className="x" onClick={onClose} aria-label="ปิด">✕</button></header>
    <h2>{book.title}</h2>
    <dl><dt>ผู้แต่ง</dt><dd>{book.author}</dd><dt>หมวด</dt><dd>{book.genre}</dd><dt>ปี</dt><dd>{book.year}</dd>
      <dt>สถานะ</dt><dd>{open ? <span className="warn">ยืมโดย {open.name} · คืน {open.due_date}</span> : 'อยู่บนชั้น'}</dd></dl>
    {open
      ? <button className="primary wide" onClick={() => act(() => exec(Q.returnLoan(open.id)), `คืน "${book.title}" แล้ว`)}>คืนหนังสือ · UPDATE loans</button>
      : <form className="borrow" onSubmit={e => { e.preventDefault(); if (who !== '') act(() => exec(Q.borrow(book.id, who)), `ยืม "${book.title}" แล้ว · คืนภายใน 14 วัน`) }}>
          <select value={who} onChange={e => setWho(e.target.value ? Number(e.target.value) : '')} required>
            <option value="">เลือกสมาชิกที่ยืม…</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button className="primary">ยืม · INSERT INTO loans</button>
        </form>}
    <div className="section-label">ประวัติการยืม ({history.length})</div>
    <ul className="history">{history.map(h => <li key={h.id}><span>{h.name}</span><small>{h.loan_date} → {h.due_date}</small><b className={h.returned ? '' : 'warn'}>{h.returned ? 'คืนแล้ว' : 'ยังไม่คืน'}</b></li>)}
      {history.length === 0 && <li className="muted">ยังไม่เคยถูกยืม</li>}</ul>
    <button className="danger" onClick={() => { if (window.confirm(`ลบ "${book.title}" ออกจากฐานข้อมูล? (ประวัติการยืมจะถูกลบด้วย ON DELETE CASCADE)`)) { onClose(); act(() => exec(Q.deleteBook(book.id)), `ลบ "${book.title}" แล้ว`) } }}>ลบหนังสือ · DELETE</button>
  </aside>
}
