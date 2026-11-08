export type Cell = string | number | null

export type StatementResult =
  | { kind: 'rows'; sql: string; columns: string[]; rows: Cell[][]; truncated: boolean }
  | { kind: 'changes'; sql: string; changes: number }
  | { kind: 'ok'; sql: string }

export type RunOutcome =
  | { ok: true; results: StatementResult[]; ms: number }
  | { ok: false; results: StatementResult[]; error: string; ms: number }

export interface ColumnInfo {
  name: string
  type: string
  notNull: boolean
  pk: boolean
}

export interface TableInfo {
  name: string
  rowCount: number
  columns: ColumnInfo[]
}

export type WorkerRequest =
  | { id: number; type: 'run'; sql: string; fresh: boolean }
  | { id: number; type: 'reset' }
  | { id: number; type: 'schema' }

export type WorkerResponse =
  | { id: number; type: 'run'; outcome: RunOutcome; schema: TableInfo[] }
  | { id: number; type: 'reset' | 'schema'; schema: TableInfo[] }
  | { id: number; type: 'fatal'; error: string }
