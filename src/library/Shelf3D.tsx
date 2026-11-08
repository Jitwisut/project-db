import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Color, Group, MathUtils, MeshStandardMaterial } from 'three'
import { SceneLabel } from '../world/SceneLabel'
import { GENRES, GENRE_COLORS, SHELF_WIDTH, bookSize, layoutBooks, shelfIndex, type ActiveLoan, type Book } from './model'

export interface Viz {
  mode: 'none' | 'rows' | 'group'
  ids: Set<number>
  dimOthers: boolean
  labels: Map<number, string>
  ranks: Map<number, number>
  groups: Map<string, number>
}
export const EMPTY_VIZ: Viz = { mode: 'none', ids: new Set(), dimOthers: false, labels: new Map(), ranks: new Map(), groups: new Map() }

const SHELF_GAP = 1.45
const ACCENT = new Color('#2bb8d6')

interface Props {
  books: Book[]
  loans: Map<number, ActiveLoan>
  viz: Viz
  selected: number | null
  onPick: (id: number | null) => void
}

function BookMesh({ book, x, y, leaving, loan, lit, dim, label, rank, selected, onPick }: {
  book: Book; x: number; y: number; leaving: boolean; loan?: ActiveLoan; lit: boolean; dim: boolean; label?: string; rank?: number; selected: boolean; onPick: (id: number) => void
}) {
  const g = useRef<Group>(null)
  const [hover, setHover] = useState(false)
  const size = useMemo(() => bookSize(book), [book])
  const mat = useMemo(() => new MeshStandardMaterial({ color: (GENRE_COLORS[book.genre] ?? GENRE_COLORS.Other)[size.tone], roughness: .72, transparent: true }), [book.genre, size.tone])
  const stripe = useMemo(() => new MeshStandardMaterial({ color: '#d8c79a', metalness: .6, roughness: .35, transparent: true }), [])

  useEffect(() => { if (g.current) g.current.scale.setScalar(.001) }, [])
  useFrame((_, delta) => {
    const o = g.current; if (!o) return
    const dt = Math.min(delta, .05)
    const out = lit || selected ? .38 : loan ? .2 : 0
    o.position.x = MathUtils.damp(o.position.x, x, 6, dt)
    o.position.y = MathUtils.damp(o.position.y, y + size.h / 2 + .04, 6, dt)
    o.position.z = MathUtils.damp(o.position.z, out, 6, dt)
    o.rotation.z = MathUtils.damp(o.rotation.z, loan && !lit ? -.14 : 0, 6, dt)
    o.scale.setScalar(MathUtils.damp(o.scale.x, leaving ? .001 : hover ? 1.04 : 1, leaving ? 9 : 7, dt))
    const opacity = dim && !lit ? .28 : 1
    mat.opacity = stripe.opacity = MathUtils.damp(mat.opacity, opacity, 6, dt)
    mat.emissive.lerp(lit || selected ? ACCENT : hover ? new Color('#334455') : new Color('#000000'), Math.min(1, dt * 6))
    mat.emissiveIntensity = lit ? .32 : .25
  })

  return <group ref={g} position={[x, y + size.h / 2, 0]}
    onClick={e => { e.stopPropagation(); onPick(book.id) }}
    onPointerOver={e => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' }}
    onPointerOut={() => { setHover(false); document.body.style.cursor = '' }}>
    <mesh material={mat} castShadow receiveShadow><boxGeometry args={[size.w, size.h, size.d]} /></mesh>
    <mesh material={stripe} position={[0, size.h * .32, size.d / 2 + .002]}><boxGeometry args={[size.w * .8, .04, .004]} /></mesh>
    <mesh material={stripe} position={[0, -size.h * .3, size.d / 2 + .002]}><boxGeometry args={[size.w * .8, .025, .004]} /></mesh>
    {(hover || label || rank) && !leaving && <SceneLabel center position={[0, size.h / 2 + .32, size.d / 2]} zIndexRange={[20, 10]}>
      <div className={`book-tag${rank ? ' rank' : ''}${hover ? ' hover' : ''}`}>
        {rank ? <b>#{rank}</b> : null}
        <span>{hover ? book.title : label ?? book.title}</span>
        {hover && <small>{book.author} · {book.year}{loan ? ` · ยืมโดย ${loan.member}` : ''}</small>}
      </div>
    </SceneLabel>}
  </group>
}

function Bookcase({ rows }: { rows: number }) {
  const W = SHELF_WIDTH + .3, H = rows * SHELF_GAP + .2
  const wood = useMemo(() => new MeshStandardMaterial({ color: '#3a2a20', roughness: .82 }), [])
  const woodLight = useMemo(() => new MeshStandardMaterial({ color: '#5a4030', roughness: .75 }), [])
  return <group>
    <mesh material={wood} position={[0, H / 2 - .1, -.42]} receiveShadow><boxGeometry args={[W, H, .06]} /></mesh>
    {[-1, 1].map(s => <mesh key={s} material={woodLight} position={[s * W / 2, H / 2 - .1, 0]} castShadow receiveShadow><boxGeometry args={[.14, H, .9]} /></mesh>)}
    {Array.from({ length: rows + 1 }, (_, i) => <mesh key={i} material={woodLight} position={[0, i * SHELF_GAP - .02, 0]} castShadow receiveShadow><boxGeometry args={[W, .08, .9]} /></mesh>)}
  </group>
}

export function Shelf3D({ books, loans, viz, selected, onPick }: Props) {
  // หนังสือที่ถูกลบจะค่อย ๆ หดหายก่อนเอาออกจากฉาก
  const [leaving, setLeaving] = useState<Book[]>([])
  const prev = useRef<Book[]>(books)
  useEffect(() => {
    const ids = new Set(books.map(b => b.id)), gone = prev.current.filter(b => !ids.has(b.id))
    prev.current = books
    if (!gone.length) return
    setLeaving(l => [...l, ...gone])
    const t = setTimeout(() => setLeaving(l => l.filter(b => !gone.includes(b))), 900)
    return () => clearTimeout(t)
  }, [books])

  const all = useMemo(() => [...books, ...leaving.filter(l => !books.some(b => b.id === l.id))], [books, leaving])
  const pos = useMemo(() => layoutBooks(all), [all])
  const rows = books.some(b => shelfIndex(b.genre) >= GENRES.length) ? GENRES.length + 1 : GENRES.length
  const shelfY = (i: number) => (rows - 1 - i) * SHELF_GAP + .02
  const shelfNames = [...GENRES, 'Other'].slice(0, rows)

  return <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 4.4, 12.5], fov: 40 }} onPointerMissed={() => onPick(null)}>
    <color attach="background" args={['#070b12']} />
    <fog attach="fog" args={['#070b12', 14, 30]} />
    <ambientLight intensity={.35} />
    <hemisphereLight args={['#9fc4ff', '#1a120c', .45]} />
    <directionalLight position={[-5, 9, 8]} intensity={1.6} color="#ffe2bf" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={9} shadow-camera-bottom={-2} />
    <pointLight position={[4.5, 6.5, 3]} intensity={18} distance={14} color="#51e5ff" />
    <group position={[0, 0, 0]}>
      <Bookcase rows={rows} />
      {shelfNames.map((name, i) => <SceneLabel key={name} position={[-SHELF_WIDTH / 2 + .75, shelfY(i) - .06, .5]} center zIndexRange={[5, 1]}>
        <div className="shelf-tag">{name}</div>
      </SceneLabel>)}
      {viz.mode === 'group' && shelfNames.map((name, i) => viz.groups.has(name) && <SceneLabel key={'g' + name} position={[SHELF_WIDTH / 2 + .9, shelfY(i) + .6, 0]} center zIndexRange={[6, 1]}>
        <div className="group-tag"><b>{viz.groups.get(name)}</b><small>เล่ม</small></div>
      </SceneLabel>)}
      {all.map(b => {
        const p = pos.get(b.id); if (!p) return null
        const isLeaving = !books.some(x => x.id === b.id)
        return <BookMesh key={b.id} book={b} x={p.x} y={shelfY(p.shelf)} leaving={isLeaving} loan={loans.get(b.id)}
          lit={viz.ids.has(b.id)} dim={viz.dimOthers} label={viz.labels.get(b.id)} rank={viz.ranks.get(b.id)}
          selected={selected === b.id} onPick={onPick} />
      })}
    </group>
    <gridHelper args={[40, 40, '#16324a', '#0e1c2a']} position={[0, -.07, 0]} />
    <OrbitControls target={[0, 3.4, 0]} enableDamping minDistance={5} maxDistance={20} minAzimuthAngle={-.75} maxAzimuthAngle={.75} minPolarAngle={.6} maxPolarAngle={1.75} />
  </Canvas>
}
