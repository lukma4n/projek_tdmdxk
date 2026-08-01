import { useState, useRef, useEffect } from 'react'
import { AlertCircle, Check, RefreshCw, X } from 'lucide-react'

/**
 * Modal kamera in-app (getUserMedia) — berfungsi di laptop (webcam) & mobile.
 * Diangkat dari pola yang sudah teruji di StnkBpkbCheck.jsx (foto KTP), supaya
 * dipakai ulang di tempat lain tanpa duplikasi ~90 baris logic stream/capture.
 *
 * Butuh HTTPS di produksi (localhost tetap jalan di dev) -- keterbatasan
 * getUserMedia browser, bukan bug aplikasi.
 */
export default function CameraCapture({ open, title = 'Ambil Foto', onCapture, onClose }) {
  const [error, setError] = useState('')
  const [capturedBlob, setCapturedBlob] = useState(null)
  const [capturedUrl, setCapturedUrl] = useState('')
  const videoRef = useRef(null)

  useEffect(() => {
    if (!open || capturedBlob) return
    let cancelled = false
    let stream
    if (!navigator.mediaDevices?.getUserMedia) {
      void Promise.resolve().then(() => {
        if (!cancelled) setError('Browser tidak mendukung akses kamera. Gunakan Upload File.')
      })
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          videoRef.current.play().catch(() => {})
        }
      })
      .catch((err) => {
        if (cancelled) return
        const name = err?.name
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setError('Akses kamera ditolak. Izinkan kamera di pengaturan browser, atau gunakan Upload File.')
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setError('Kamera tidak ditemukan. Gunakan Upload File untuk mengunggah dari penyimpanan.')
        } else {
          setError('Tidak dapat membuka kamera. Coba gunakan Upload File.')
        }
      })
    return () => {
      cancelled = true
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  }, [open, capturedBlob])

  if (!open) return null

  const captureFrame = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        setCapturedBlob(blob)
        setCapturedUrl(URL.createObjectURL(blob))
      },
      'image/jpeg',
      0.9
    )
  }

  const retake = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    setCapturedBlob(null)
    setCapturedUrl('')
  }

  const useCaptured = () => {
    if (!capturedBlob) return
    const file = new File([capturedBlob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
    onCapture(file, capturedUrl)
    setCapturedBlob(null)
    setCapturedUrl('')
  }

  const close = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    setCapturedBlob(null)
    setCapturedUrl('')
    setError('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/90">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-bold">{title}</span>
        <button type="button" onClick={close} className="rounded-lg p-1.5 text-white/80 hover:bg-white/10" aria-label="Tutup">
          <X size={20} />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {error ? (
          <div className="max-w-sm px-6 text-center text-white">
            <AlertCircle size={36} className="mx-auto mb-3 text-danger" />
            <p className="text-sm">{error}</p>
            <button type="button" onClick={close} className="mt-4 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25">
              Kembali
            </button>
          </div>
        ) : capturedBlob ? (
          <img src={capturedUrl} alt="Hasil tangkapan" className="max-h-full max-w-full object-contain" />
        ) : (
          <video ref={videoRef} playsInline muted className="max-h-full max-w-full object-contain" />
        )}
      </div>
      {!error && (
        <div className="flex items-center justify-center gap-4 px-4 py-5">
          {capturedBlob ? (
            <>
              <button type="button" onClick={retake} className="flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/25">
                <RefreshCw size={18} /> Ulangi
              </button>
              <button type="button" onClick={useCaptured} className="flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white hover:brightness-110">
                <Check size={18} /> Gunakan Foto
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={captureFrame}
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 transition active:scale-95"
              aria-label="Ambil foto"
            >
              <span className="h-11 w-11 rounded-full bg-white" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
