import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useFrame, useThree } from '@react-three/fiber'
import { Group, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three'

// ป้าย HTML ที่ลอยตามตำแหน่งในฉาก 3D (ทำงานแบบเดียวกับ <Html> ของ drei ในโหมดที่โปรเจกต์นี้ใช้)
// ต่างจาก drei ตรงที่ unmount React root แบบเลื่อนออกไป (microtask) และให้แต่ละ root มี container ของตัวเอง
// drei unmount ทันทีระหว่างที่ React กำลัง commit ทำให้ console ขึ้น
// "Attempted to synchronously unmount a root while React was already rendering"

interface Props {
  children: ReactNode
  position: [number, number, number]
  center?: boolean
  distanceFactor?: number
  zIndexRange?: [number, number]
  style?: CSSProperties
  /** ขนาดสูงสุดตอนกล้องเข้าใกล้ (กันป้ายใหญ่จนบังวัตถุ) */
  maxScale?: number
}

const objectPos = new Vector3()
const cameraPos = new Vector3()
const cameraDir = new Vector3()
const toObject = new Vector3()

export function SceneLabel({ children, position, center, distanceFactor, zIndexRange = [16777271, 0], style, maxScale = 1.15 }: Props) {
  const group = useRef<Group>(null)
  const { gl, camera, size, events } = useThree()
  const [el] = useState(() => document.createElement('div'))
  const root = useRef<Root | null>(null)
  const last = useRef({ transform: '', zIndex: '', visible: true })
  const target = (events.connected ?? gl.domElement.parentNode) as HTMLElement | null

  useLayoutEffect(() => {
    if (!target) return
    const container = document.createElement('div')
    container.style.display = 'contents'
    el.appendChild(container)
    el.style.cssText = 'position:absolute;top:0;left:0;transform-origin:0 0;'
    target.appendChild(el)
    const current = (root.current = createRoot(container))
    last.current = { transform: '', zIndex: '', visible: true }
    return () => {
      target.removeChild(el)
      el.removeChild(container)
      root.current = null
      queueMicrotask(() => current.unmount())
    }
  }, [el, target])

  useLayoutEffect(() => {
    root.current?.render(
      <div style={{ position: 'absolute', transform: center ? 'translate3d(-50%,-50%,0)' : 'none', ...style }}>{children}</div>,
    )
  })

  useFrame(() => {
    const g = group.current
    if (!g) return
    camera.updateMatrixWorld()
    g.updateWorldMatrix(true, false)
    objectPos.setFromMatrixPosition(g.matrixWorld)
    cameraPos.setFromMatrixPosition(camera.matrixWorld)
    const dist = objectPos.distanceTo(cameraPos)
    const visible = toObject.subVectors(objectPos, cameraPos).angleTo(camera.getWorldDirection(cameraDir)) <= Math.PI / 2

    objectPos.project(camera)
    const x = (objectPos.x + 1) * (size.width / 2)
    const y = (1 - objectPos.y) * (size.height / 2)
    let scale = 1
    if (distanceFactor !== undefined) {
      if (camera instanceof OrthographicCamera) scale = camera.zoom * distanceFactor
      else if (camera instanceof PerspectiveCamera) scale = distanceFactor / (2 * Math.tan((camera.fov * Math.PI) / 360) * dist)
    }
    scale = Math.min(scale, maxScale)
    let zIndex = ''
    if (camera instanceof PerspectiveCamera || camera instanceof OrthographicCamera) {
      const a = (zIndexRange[1] - zIndexRange[0]) / (camera.far - camera.near)
      zIndex = String(Math.round(a * dist + zIndexRange[1] - a * camera.far))
    }

    const transform = `translate3d(${x}px,${y}px,0) scale(${scale})`
    const prev = last.current
    if (prev.transform !== transform) el.style.transform = prev.transform = transform
    if (prev.zIndex !== zIndex) el.style.zIndex = prev.zIndex = zIndex
    if (prev.visible !== visible) {
      prev.visible = visible
      el.style.display = visible ? 'block' : 'none'
    }
  })

  return <group ref={group} position={position} />
}
