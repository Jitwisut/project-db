import { createRoot } from 'react-dom/client'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/ibm-plex-sans-thai/400.css'
import '@fontsource/ibm-plex-sans-thai/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/geist/400.css'
import '@fontsource/geist/500.css'
import './styles.css'
import { App } from './App'

// ไม่ใช้ StrictMode เพราะในโหมด dev มันจะรัน effect ซ้ำ 2 รอบ ทำให้แผง SQL แสดงคำสั่งซ้ำ
createRoot(document.getElementById('root')!).render(<App />)
