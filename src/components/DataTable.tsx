import type { Cell } from '../sql/types'

interface Props {
  columns: string[]
  rows: Cell[][]
  compact?: boolean
  caption?: string
}

function formatCell(v: Cell) {
  if (v === null) return <span className="cell-null">NULL</span>
  if (typeof v === 'number') return Number.isInteger(v) ? v : Number(v.toFixed(6))
  return v
}

export function DataTable({ columns, rows, compact, caption }: Props) {
  const numeric = columns.map((_, i) => rows.length > 0 && rows.every((r) => r[i] === null || typeof r[i] === 'number'))
  return (
    <div className={`table-wrap${compact ? ' compact' : ''}`}>
      <table className="data-table">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            <th className="rownum" scope="col">#</th>
            {columns.map((c, i) => (
              <th key={i} scope="col" className={numeric[i] ? 'num' : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} style={{ animationDelay: `${Math.min(ri, 12) * 28}ms` }}>
              <td className="rownum">{ri + 1}</td>
              {r.map((v, ci) => (
                <td key={ci} className={numeric[ci] ? 'num' : undefined}>
                  {formatCell(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty-rows">ไม่มีแถวที่ตรงเงื่อนไข (0 แถว)</p>}
    </div>
  )
}
