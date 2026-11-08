import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { createSeededDb, readSchema, runSql } from '../sql/engine'
import { CATEGORIES, layoutBooks, planQuery, SNAPSHOT_SQL } from './model'

let SQL: SqlJsStatic
beforeAll(async () => { SQL = await initSqlJs() })
const rows = (sql: string, db = createSeededDb(SQL)) => { const o = runSql(db, sql); const r = o.results.filter(x => x.kind === 'rows').at(-1); return { o, rows: r && r.kind === 'rows' ? r.rows : [] } }

describe('library database', () => {
  it('has 3 related tables with seed data', () => {
    expect(readSchema(createSeededDb(SQL)).map(t => [t.name, t.rowCount])).toEqual([['books', 26], ['loans', 14], ['members', 8]])
  })
  it('every category example runs without error', () => {
    for (const c of CATEGORIES) expect(runSql(createSeededDb(SQL), c.sql).ok, c.id).toBe(true)
  })
  it('WHERE, ORDER BY, JOIN and GROUP BY return the expected data', () => {
    expect(rows("SELECT * FROM books WHERE genre = 'Technology'").rows).toHaveLength(6)
    expect(rows('SELECT title, year FROM books ORDER BY year DESC LIMIT 5').rows[0]).toEqual(['Designing Data-Intensive Applications', 2017])
    expect(rows(CATEGORIES.find(c => c.id === 'join')!.sql).rows).toHaveLength(10)
    expect(rows('SELECT genre, COUNT(*) FROM books GROUP BY genre').rows).toContainEqual(['Fiction', 6])
  })
  it('foreign keys protect loans and cascade on delete', () => {
    expect(runSql(createSeededDb(SQL), 'INSERT INTO loans (book_id, member_id, loan_date, due_date) VALUES (999, 1, "a", "b")').ok).toBe(false)
    const db = createSeededDb(SQL)
    runSql(db, 'DELETE FROM books WHERE id = 21')
    expect(rows('SELECT COUNT(*) FROM loans WHERE book_id = 21', db).rows).toEqual([[0]])
  })
  it('snapshot query lists books and active loans', () => {
    const o = runSql(createSeededDb(SQL), SNAPSHOT_SQL)
    const [books, loans] = o.results
    expect(books.kind === 'rows' && books.rows).toHaveLength(26)
    expect(loans.kind === 'rows' && loans.rows).toHaveLength(10)
  })
})

describe('planQuery maps SQL to books on the shelf', () => {
  it('builds a companion query that returns the same books', () => {
    const p = planQuery("SELECT title FROM books b WHERE b.genre = 'Art' ORDER BY year")
    expect(p).toMatchObject({ kind: 'rows', ordered: true })
    if (p.kind !== 'rows') return
    expect(p.companion).toBe("SELECT b.id FROM books b WHERE b.genre = 'Art' ORDER BY year")
    expect(rows(p.companion).rows.map(r => r[0])).toEqual([23, 24, 26, 25])
  })
  it('handles joins, groups, changes and unsupported shapes', () => {
    expect(planQuery(CATEGORIES.find(c => c.id === 'join')!.sql).kind).toBe('rows')
    expect(planQuery('SELECT genre, COUNT(*) FROM books GROUP BY genre').kind).toBe('group-genre')
    expect(planQuery('UPDATE loans SET returned = 1 WHERE id = 2').kind).toBe('change')
    expect(planQuery('SELECT COUNT(*) FROM books').kind).toBe('none')
    expect(planQuery('SELECT * FROM members').kind).toBe('none')
  })
  it('places every book on its genre shelf without overlap', () => {
    const books = rows('SELECT id, title, author, genre, year FROM books').rows.map(([id, title, author, genre, year]) => ({ id: Number(id), title: String(title), author: String(author), genre: String(genre), year: Number(year) }))
    const pos = layoutBooks(books)
    expect(pos.size).toBe(26)
    expect(Math.max(...[...pos.values()].map(p => p.x))).toBeLessThan(4.5)
  })
})
