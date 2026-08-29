import { useRef, useState, useEffect, useCallback } from 'react'
import { Eraser } from 'lucide-react'

/**
 * Kotak tanda tangan berbasis canvas.
 *
 * Pointer event dipakai supaya satu jalur kode melayani sentuhan dan mouse --
 * petugas menandatangani di tablet, lalu perangkat yang sama diberikan kepada
 * konsumen.
 */
export default function SignaturePad({ label, onChange, disabled = false }) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const isEmptyRef = useRef(true)
  const onChangeRef = useRef(onChange)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Canvas diskalakan ke devicePixelRatio supaya garisnya tidak buram di layar
  // beresolusi tinggi. Ukuran backing store diikat ke ResizeObserver, bukan
  // hanya diukur sekali di mount -- komponen ini dirender di dalam modal yang
  // bisa masih beranimasi/menata layout ulang setelah mount, jadi rect awal
  // bisa nol atau basi.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const ratio = window.devicePixelRatio || 1
    let lastWidth = 0
    let lastHeight = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const width = Math.round(rect.width * ratio)
      const height = Math.round(rect.height * ratio)
      if (width === 0 || height === 0) return
      if (width === lastWidth && height === lastHeight) return
      lastWidth = width
      lastHeight = height

      // Mengubah canvas.width/height mengosongkan bitmap-nya. Daripada
      // membiarkan kanvas kosong sementara parent masih memegang Blob lama,
      // kita reset state komponen secara konsisten: tanda tangan sebelum
      // resize sudah tidak terlihat, jadi jangan dianggap masih berlaku.
      canvas.width = width
      canvas.height = height
      ctx.scale(ratio, ratio)
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#111827'

      drawingRef.current = false
      isEmptyRef.current = true
      setIsEmpty(true)
      onChangeRef.current?.(null)
    }

    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    return () => observer.disconnect()
  }, [])

  const pointFrom = (event) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const emit = useCallback(() => {
    canvasRef.current.toBlob((blob) => onChange?.(blob), 'image/png')
  }, [onChange])

  const handleDown = (event) => {
    if (disabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const { x, y } = pointFrom(event)
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(x, y)
    drawingRef.current = true
  }

  const handleMove = (event) => {
    if (!drawingRef.current) return
    const { x, y } = pointFrom(event)
    const ctx = canvasRef.current.getContext('2d')
    ctx.lineTo(x, y)
    ctx.stroke()
    if (isEmptyRef.current) {
      isEmptyRef.current = false
      setIsEmpty(false)
    }
  }

  const handleUp = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    // Ketuk/klik tanpa menyeret tidak pernah menggambar apa pun -- jangan
    // kirim Blob kosong yang bisa dianggap parent sebagai tanda tangan sah.
    if (!isEmptyRef.current) emit()
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    isEmptyRef.current = true
    setIsEmpty(true)
    onChange?.(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-sm font-semibold text-text">{label}</label>
        {!isEmpty && (
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-danger transition-colors"
          >
            <Eraser className="w-3.5 h-3.5" />
            Hapus
          </button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        aria-label={label}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
        className={`w-full h-36 rounded-lg border-2 border-dashed bg-white touch-none ${
          isEmpty ? 'border-border' : 'border-accent'
        } ${disabled ? 'opacity-50' : 'cursor-crosshair'}`}
      />
      {isEmpty && (
        <p className="mt-1 text-xs text-muted">Tanda tangan di kotak ini</p>
      )}
    </div>
  )
}
