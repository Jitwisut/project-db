import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { createSeededDb, queryOnce, readSchema } from '../sql/engine'
import { layoutBooks } from './model'
import * as Q from './queries'

let SQL: SqlJsStatic
beforeAll(async () => { SQL = await initSqlJs() })
const fresh = () => createSeededDb(SQL)
const run = (db: ReturnType<typeof fresh>, query: Q.Query) => { const r = queryOnce(db, query.sql, query.params); if (!r.ok) throw new Error(r.error); return r }

describe('library database', () => {
  it('has 3 related tables with seed data', () => {
    expect(readSchema(fresh()).map(t => [t.name, t.rowCount])).toEqual([['books', 26], ['loans', 14], ['members', 8]])
  })

  it('shelf state lists every book with its current borrower', () => {
    const r = run(fresh(), Q.shelfState())
    expect(r.rows).toHaveLength(26)
    expect(r.rows.filter(row => row[5] !== null)).toHaveLength(10)
  })

  it('search uses LIKE, genre filter and sorting with bound parameters', () => {
    const db = fresh()
    expect(run(db, Q.searchBooks('sql', null, 'id')).rows.map(r => r[1])).toEqual(['Learning SQL'])
    expect(run(db, Q.searchBooks('', 'Technology', 'id')).rows).toHaveLength(6)
    expect(run(db, Q.searchBooks('', null, 'year-desc')).rows[0][1]).toBe('Designing Data-Intensive Applications')
    // user text is data, not SQL: an injection attempt just finds nothing
    expect(run(db, Q.searchBooks("' OR 1=1 --", null, 'id')).rows).toHaveLength(0)
  })

  it('borrow, return, history and active loans stay consistent', () => {
    const db = fresh()
    expect(run(db, Q.borrow(1, 2)).changes).toBe(1)
    const loans = run(db, Q.activeLoans())
    expect(loans.rows).toHaveLength(11)
    const history = run(db, Q.bookHistory(1))
    expect(history.rows[0][4]).toBe(0)
    run(db, Q.returnLoan(Number(history.rows[0][0])))
    expect(run(db, Q.activeLoans()).rows).toHaveLength(10)
  })

  it('members show active loan counts, including members with none (LEFT JOIN)', () => {
    const rows = run(fresh(), Q.members()).rows
    expect(rows).toHaveLength(8)
    expect(rows.find(r => r[1] === 'Worawit')?.[4]).toBe(0)
    expect(rows.find(r => r[1] === 'Pimchanok')?.[4]).toBe(2)
  })

  it('constraints protect the data', () => {
    const db = fresh()
    expect(queryOnce(db, Q.addMember('Test', 'IT', 5).sql, Q.addMember('Test', 'IT', 5).params).ok).toBe(false) // CHECK year_level 1-4
    expect(queryOnce(db, Q.borrow(999, 1).sql, Q.borrow(999, 1).params).ok).toBe(false) // FOREIGN KEY
    run(db, Q.deleteBook(21)) // ON DELETE CASCADE removes its loans
    expect(run(db, Q.bookHistory(21)).rows).toHaveLength(0)
  })

  it('statistics use GROUP BY, ORDER BY … LIMIT and HAVING', () => {
    const db = fresh()
    expect(run(db, Q.genreCounts()).rows).toContainEqual(['Fiction', 6])
    expect(run(db, Q.topBorrowers()).rows).toHaveLength(3)
    expect(run(db, Q.popularBooks()).rows).toEqual([['Designing Data-Intensive Applications', 2]])
  })

  it('adding a book places it on its genre shelf', () => {
    const db = fresh()
    run(db, Q.addBook('Atomic Habits', 'James Clear', 'Science', 2018))
    const books = run(db, Q.shelfState()).rows.map(([id, title, author, genre, year]) => ({ id: Number(id), title: String(title), author: String(author), genre: String(genre), year: Number(year) }))
    const pos = layoutBooks(books)
    expect(pos.size).toBe(27)
    expect(pos.get(27)?.shelf).toBe(1)
  })
})
