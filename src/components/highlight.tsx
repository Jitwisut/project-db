import type { ReactNode } from 'react'

const KEYWORDS = new Set(
  `select from where and or not in between like is null as order by asc desc limit offset insert into values
  update set delete create table drop if exists primary key integer int text float real char varchar blob
  group having join inner left right outer full cross on distinct union all with recursive case when then else end
  pragma unique default check references foreign alter add column rename index view begin commit rollback
  autoincrement collate nocase glob escape exists`
    .split(/\s+/)
    .filter(Boolean),
)

const FUNCTIONS = new Set(
  'count sum avg min max round coalesce ifnull typeof length upper lower substr trim abs replace instr date time datetime strftime printf nullif total group_concat random'.split(
    ' ',
  ),
)

const TOKEN =
  /(--[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|('(?:[^']|'')*'?)|("(?:[^"]|"")*"?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([\s\S])/g

/** แปลงข้อความ SQL เป็น span ที่ระบายสีตามชนิดคำ */
export function highlightSql(sql: string): ReactNode[] {
  const out: ReactNode[] = []
  let m: RegExpExecArray | null
  let i = 0
  TOKEN.lastIndex = 0
  while ((m = TOKEN.exec(sql))) {
    const [text, comment, str, quoted, num, word, space] = m
    let cls: string | null = null
    if (comment) cls = 'tk-comment'
    else if (str) cls = 'tk-string'
    else if (quoted) cls = 'tk-ident'
    else if (num) cls = 'tk-number'
    else if (word) {
      const lower = word.toLowerCase()
      if (KEYWORDS.has(lower)) cls = 'tk-keyword'
      else if (FUNCTIONS.has(lower) && sql[TOKEN.lastIndex] === '(') cls = 'tk-fn'
    } else if (space) cls = null
    else if ('(),;'.includes(text)) cls = 'tk-punct'
    else cls = 'tk-op'
    out.push(cls ? <span key={i++} className={cls}>{text}</span> : text)
  }
  return out
}
