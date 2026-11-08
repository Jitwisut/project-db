import { useRef, type KeyboardEvent } from 'react'
import { highlightSql } from './highlight'

interface Props {
  value: string
  onChange: (v: string) => void
  /** ส่ง SQL ที่จะรัน: ข้อความที่เลือกไว้ หรือทั้งหมดถ้าไม่ได้เลือก */
  onRun: (sql: string) => void
  label: string
  minRows?: number
}

export function SqlEditor({ value, onChange, onRun, label, minRows = 4 }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      const selected = ta.value.slice(ta.selectionStart, ta.selectionEnd)
      onRun(selected.trim() ? selected : ta.value)
      return
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      const { selectionStart: s, selectionEnd: end } = ta
      const next = ta.value.slice(0, s) + '  ' + ta.value.slice(end)
      onChange(next)
      requestAnimationFrame(() => ta.setSelectionRange(s + 2, s + 2))
    }
  }

  return (
    <div className="editor" style={{ minHeight: `calc(${minRows} * 1.7em + 2.2rem)` }}>
      <pre className="editor-layer" aria-hidden="true">
        {highlightSql(value)}
        {'\n'}
      </pre>
      <textarea
        ref={ref}
        className="editor-input"
        value={value}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
      />
    </div>
  )
}
