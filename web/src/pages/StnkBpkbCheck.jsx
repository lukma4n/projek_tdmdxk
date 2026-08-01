import { useState, useRef, useEffect } from 'react'
import { useThemeStore } from '../stores/themeStore'
import {
  Search,
  Check,
  Loader2,
  Compass,
  FileText,
  CheckCircle2,
  Award,
  ShieldAlert,
  Sun,
  Moon,
  Calendar,
  Clock,
  ArrowRight,
  Lock,
  Camera,
  Upload,
  RefreshCw,
  AlertCircle,
  User,
  Info,
  Copy,
  MessageCircle,
  Send,
  Truck,
  MapPin,
  Home,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { selfCheckUrl } from '../config/selfCheck'

const API_BASE = import.meta.env.VITE_API_URL || '/api'
// Nomor WhatsApp dealer untuk request pengambilan dokumen (format internasional, mis. 6281...).
const DEALER_WA = (import.meta.env.VITE_DEALER_WA_PHONE || '').replace(/\D/g, '')

// Tanggal hari ini (lokal) dalam format YYYY-MM-DD untuk atribut min pada input date.
function todayLocalStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Gabungkan tanggal + jam terpilih menjadi string ramah-baca untuk preferred_time.
// Contoh: "Senin, 24 Jun 2026 pukul 09:30". Salah satu boleh kosong (opsional).
function formatPreferredTime(dateStr, timeStr) {
  const parts = []
  if (dateStr) {
    const d = new Date(`${dateStr}T00:00:00`)
    if (!Number.isNaN(d.getTime())) {
      parts.push(
        new Intl.DateTimeFormat('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(d)
      )
    }
  }
  if (timeStr) parts.push(`pukul ${timeStr}`)
  return parts.join(' ')
}

export default function StnkBpkbCheck() {
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'

  const [searchParams] = useSearchParams()
  // Prefill dari URL (mis. dari QR/link WA: /cek?engine_number=...)
  const [engineNumber, setEngineNumber] = useState(() => (searchParams.get('engine_number') || '').toUpperCase())
  const [phone, setPhone] = useState(() => searchParams.get('phone') || '')
  const [chassis, setChassis] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)
  // FASE 2: form permintaan ambil dokumen
  const [pickupPhone, setPickupPhone] = useState(() => searchParams.get('phone') || '')
  const [pickupDate, setPickupDate] = useState('')
  const [pickupHour, setPickupHour] = useState('')
  const [pickupNotes, setPickupNotes] = useState('')
  // Pengiriman via ekspedisi: AMBIL_SENDIRI (default) atau EKSPEDISI.
  const [deliveryMethod, setDeliveryMethod] = useState('AMBIL_SENDIRI')
  const [shippingAddress, setShippingAddress] = useState('')
  const [pickupSubmitting, setPickupSubmitting] = useState(false)
  const [pickupSuccess, setPickupSuccess] = useState(null)
  const [pickupError, setPickupError] = useState('')
  // FASE 2: lampiran foto KTP (wajib)
  const [ktpFile, setKtpFile] = useState(null)
  const [ktpPreview, setKtpPreview] = useState('')
  // Kamera in-app (getUserMedia) — berfungsi di laptop (webcam) & mobile.
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [capturedBlob, setCapturedBlob] = useState(null)
  const [capturedUrl, setCapturedUrl] = useState('')
  const videoRef = useRef(null)

  // Mulai/stop stream kamera saat modal kamera terbuka (dan belum ada hasil tangkapan).
  useEffect(() => {
    if (!cameraOpen || capturedBlob) return
    let cancelled = false
    let stream
    if (!navigator.mediaDevices?.getUserMedia) {
      void Promise.resolve().then(() => {
        if (!cancelled) setCameraError('Browser tidak mendukung akses kamera. Gunakan Pilih File.')
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
          setCameraError('Akses kamera ditolak. Izinkan kamera di pengaturan browser, atau gunakan Pilih File.')
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setCameraError('Kamera tidak ditemukan. Gunakan Pilih File untuk mengunggah dari penyimpanan.')
        } else {
          setCameraError('Tidak dapat membuka kamera. Coba gunakan Pilih File.')
        }
      })
    return () => {
      cancelled = true
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  }, [cameraOpen, capturedBlob])

  const openCamera = () => {
    setCameraError('')
    setCapturedBlob(null)
    setCapturedUrl('')
    setCameraOpen(true)
  }

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

  const useCapturedPhoto = () => {
    if (!capturedBlob) return
    const file = new File([capturedBlob], `ktp-${Date.now()}.jpg`, { type: 'image/jpeg' })
    setKtpFile(file)
    setKtpPreview(capturedUrl) // pakai URL yang sudah dibuat
    setCapturedBlob(null)
    setCameraOpen(false)
  }

  const retakePhoto = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    setCapturedBlob(null)
    setCapturedUrl('')
  }

  const closeCamera = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    setCapturedBlob(null)
    setCapturedUrl('')
    setCameraOpen(false)
  }

  const handleCopyLink = async () => {
    const link = selfCheckUrl(engineNumber)
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard tak tersedia (mis. non-HTTPS) — abaikan diam-diam
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!engineNumber || (!phone && !chassis)) {
      setError('Isi Nomor Mesin, lalu Nomor HP atau 4 digit terakhir Nomor Rangka')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const queryParams = new URLSearchParams({ engine_number: engineNumber.trim() })
      if (phone.trim()) queryParams.set('phone', phone.trim())
      if (chassis.trim()) queryParams.set('chassis', chassis.trim())
      const res = await fetch(`${API_BASE}/public/stnk-bpkb/check?${queryParams.toString()}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan sistem')
      }

      setResult(data)
    } catch (err) {
      setError(err.message || 'Data tidak ditemukan. Silakan periksa kembali Nomor Mesin dan Nomor HP Anda.')
    } finally {
      setLoading(false)
    }
  }

  // FASE 2: kirim permintaan ambil dokumen ke server (pakai pickup_token dari /check)
  const handleRequestPickup = async (e) => {
    e.preventDefault()
    if (!result?.pickup_token) {
      setPickupError('Sesi permintaan telah berakhir. Silakan periksa ulang status dokumen Anda.')
      return
    }
    if (!ktpFile) {
      setPickupError('Foto KTP wajib dilampirkan. Unggah foto KTP pemilik (JPG/PNG, maks 10MB).')
      return
    }
    if (deliveryMethod === 'EKSPEDISI' && !shippingAddress.trim()) {
      setPickupError('Alamat pengiriman wajib diisi untuk pengiriman via ekspedisi.')
      return
    }
    setPickupSubmitting(true)
    setPickupError('')
    setPickupSuccess(null)
    try {
      const formData = new FormData()
      formData.append('engine_number', result.engine_number)
      formData.append('pickup_token', result.pickup_token)
      formData.append('consumer_phone', pickupPhone.trim())
      formData.append('delivery_method', deliveryMethod)
      if (deliveryMethod === 'EKSPEDISI') {
        formData.append('shipping_address', shippingAddress.trim())
      } else {
        formData.append('preferred_time', formatPreferredTime(pickupDate, pickupHour))
      }
      formData.append('notes', pickupNotes.trim())
      formData.append('ktp_photo', ktpFile)

      const res = await fetch(`${API_BASE}/public/stnk-bpkb/request-pickup`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim permintaan')
      setPickupSuccess(data.message || 'Permintaan berhasil dikirim.')
      setKtpFile(null)
      setKtpPreview('')
      setPickupDate('')
      setPickupHour('')
      setShippingAddress('')
    } catch (err) {
      setPickupError(err.message || 'Gagal mengirim permintaan. Coba lagi atau hubungi dealer.')
    } finally {
      setPickupSubmitting(false)
    }
  }

  // FASE 2: pilih & validasi foto KTP (client-side: tipe + ukuran)
  const handleKtpChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset agar bisa pilih file yang sama lagi
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setPickupError('Foto KTP harus berformat JPG atau PNG.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setPickupError('Ukuran foto KTP melebihi 10MB.')
      return
    }
    setPickupError('')
    setKtpFile(file)
    setKtpPreview(URL.createObjectURL(file))
  }

  return (
    <div className="min-h-screen font-sans transition-colors duration-300 bg-bg text-text">
      {/* Header */}
      <nav className="border-b transition-colors duration-300 border-border bg-panel/80 sticky top-0 z-50 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white font-bold shadow-md shadow-accent/30">
              DXK
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-text-strong">TDM KETAPANG</h1>
              <p className="text-[10px] text-muted font-semibold">Self Check STNK & BPKB</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border transition-all duration-300 border-border bg-panel text-muted hover:bg-hover"
              title={isDark ? 'Tema Terang' : 'Tema Gelap'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl transition text-muted bg-hover hover:bg-hover"
            >
              Area Karyawan <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Banner Hero */}
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-text-strong">
            Lacak Status STNK & BPKB Anda
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm sm:text-base text-muted">
            Masukkan Nomor Mesin motor Honda Anda dan Nomor HP yang terdaftar untuk memantau pengurusan dokumen secara real-time.
          </p>
        </div>

        {/* Form Search Card */}
        <div className="mb-10 p-6 rounded-3xl border shadow-xl border-border bg-panel">
          <form onSubmit={handleSearch} className="grid gap-5 md:grid-cols-2 md:items-end">
            <div>
              <label htmlFor="engine" className="mb-2 block text-xs font-bold uppercase tracking-wider text-accent">
                Nomor Mesin
              </label>
              <input
                id="engine"
                type="text"
                value={engineNumber}
                onChange={(e) => setEngineNumber(e.target.value)}
                placeholder="Contoh: JBK1E1234567"
                autoFocus={!engineNumber}
                className="w-full rounded-xl border px-4 py-3.5 text-sm transition-all duration-300 focus:outline-none border-border bg-hover text-text focus:border-accent focus:ring-4 focus:ring-accent/10"
              />
            </div>
            <div>
              <label htmlFor="phone" className="mb-2 block text-xs font-bold uppercase tracking-wider text-accent">
                Nomor Handphone Terdaftar
              </label>
              <input
                id="phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Contoh: 081234567..."
                autoFocus={!!engineNumber}
                className="w-full rounded-xl border px-4 py-3.5 text-sm transition-all duration-300 focus:outline-none border-border bg-hover text-text focus:border-accent focus:ring-4 focus:ring-accent/10"
              />
            </div>
            <div className="md:col-span-2">
              <div className="my-1 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-faint">
                <span className="h-px flex-1 bg-border" /> atau <span className="h-px flex-1 bg-border" />
              </div>
              <label htmlFor="chassis" className="mb-2 block text-xs font-bold uppercase tracking-wider text-accent">
                4 Digit Terakhir Nomor Rangka
              </label>
              <input
                id="chassis"
                type="text"
                value={chassis}
                onChange={(e) => setChassis(e.target.value)}
                placeholder="Contoh: 1234"
                maxLength={6}
                className="w-full rounded-xl border px-4 py-3.5 text-sm transition-all duration-300 focus:outline-none border-border bg-hover text-text focus:border-accent focus:ring-4 focus:ring-accent/10"
              />
              <p className="mt-1.5 text-[11px] text-muted">Pakai ini jika Nomor HP Anda sudah berganti dari saat pembelian.</p>
            </div>
            <div className="md:col-span-2 mt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold text-white transition-all shadow-md bg-accent hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Mencari Data Dokumen...
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    Periksa Status Pengurusan
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Privacy Disclaimer */}
          <div className="mt-4 flex gap-2.5 rounded-xl p-3 text-xs leading-relaxed bg-hover text-muted">
            <Lock size={16} className="shrink-0 text-accent" />
            <p>
              <strong>Kebijakan Privasi:</strong> Data pribadi Anda disamarkan demi keamanan. Nomor Mesin dan Nomor Handphone harus sesuai dengan data transaksi saat pembelian unit di TDM Ketapang.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-10 flex gap-3 rounded-xl border border-danger/20 bg-danger-soft p-4 text-danger">
            <AlertCircle size={20} className="shrink-0" />
            <div className="text-sm">
              <p className="font-bold">Pencarian Gagal</p>
              <p className="mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Result Area */}
        {result && (
          <div className="space-y-8 animate-fadeIn">
            {/* Toolbar: bagikan link cek (engine ter-prefill) */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-panel px-3.5 py-2 text-xs font-semibold text-muted transition hover:bg-hover hover:text-text-strong"
              >
                {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
                {copied ? 'Link Tersalin' : 'Salin Link Cek'}
              </button>
            </div>

            {/* Info Unit */}
            <div className="rounded-3xl border p-6 shadow-lg border-border bg-panel">
              <div className="flex items-center gap-2.5 pb-4 border-b border-dashed border-border">
                <User size={18} className="text-accent" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-faint">Informasi Pembelian</h3>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-muted">Nama Pemilik (STNK)</p>
                  <p className="font-bold text-base mt-0.5 text-text-strong">{result.stnk_name || '-'}</p>
                </div>
                <div>
                  <p className="text-muted">Seri Motor</p>
                  <p className="font-bold text-base mt-0.5 text-text-strong">{result.series || '-'}</p>
                </div>
                <div>
                  <p className="text-muted">Nomor Mesin / Rangka</p>
                  <p className="font-mono font-medium mt-0.5 text-text">{result.engine_number} / {result.chassis_number || '-'}</p>
                </div>
                <div>
                  <p className="text-muted">Nomor Polisi</p>
                  <p className="font-bold text-base mt-0.5 text-accent">{result.no_polisi || 'Belum Terbit'}</p>
                </div>
                <div>
                  <p className="text-muted">Dealer Cabang</p>
                  <p className="font-semibold mt-0.5 text-text">{result.branch_name || 'TDM KETAPANG'}</p>
                </div>
              </div>
            </div>

            {/* Status pengiriman via ekspedisi (kalau ada) */}
            {result.shipments && result.shipments.length > 0 && (
              <div className="rounded-3xl border border-accent/20 bg-accent/10 p-6 shadow-md shadow-accent/5">
                <div className="flex items-center gap-2.5">
                  <Truck size={20} className="text-accent" />
                  <h4 className="font-bold text-accent text-base">Status Pengiriman</h4>
                </div>
                <ul className="mt-3 space-y-3">
                  {result.shipments.map((s) => (
                    <li key={s.document_type} className="flex items-start gap-3 rounded-2xl border border-border bg-panel p-3.5">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                        {s.status === 'selesai' ? <CheckCircle2 size={16} /> : <Truck size={16} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-text-strong">{s.document_label}</p>
                        <p className="text-xs font-semibold text-accent">
                          {s.status === 'tersedia' && 'Menunggu diserahkan ke ekspedisi'}
                          {s.status === 'dikirim_ekspedisi' && 'Sedang dikirim'}
                          {s.status === 'selesai' && 'Sudah diterima'}
                        </p>
                        {s.tracking_number && (
                          <p className="mt-1 text-xs text-muted">
                            Resi: <span className="font-mono font-semibold text-text">{s.tracking_number}</span>
                            {s.courier_name && <> · {s.courier_name}</>}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Status Penjemputan / Callout Banner — BPKB leasing tidak diambil konsumen */}
            {((result.stnk.is_done && !result.stnk.is_delivered) || (result.bpkb.is_done && !result.bpkb.is_delivered && result.bpkb.for_consumer)) && (
              <div className="flex gap-4 rounded-3xl border border-accent/20 bg-accent/10 p-6 shadow-md shadow-accent/5">
                <Info size={24} className="shrink-0 text-accent mt-1" />
                <div>
                  <h4 className="font-bold text-accent text-base">Dokumen Siap Diambil!</h4>
                  <p className="text-sm mt-1 leading-relaxed text-muted">
                    Silakan mengunjungi dealer <strong>TDM Ketapang</strong> untuk mengambil dokumen Anda yang telah terbit:
                  </p>
                  <ul className="mt-3 space-y-2 text-sm font-semibold">
                    {result.stnk.is_done && !result.stnk.is_delivered && (
                      <li className="flex items-center gap-2 text-text">
                        <div className="h-2 w-2 rounded-full bg-accent" />
                        STNK & Plat Nomor (Lokasi: {result.stnk.lokasi || 'Kassa/Frontdesk'})
                      </li>
                    )}
                    {result.bpkb.is_done && !result.bpkb.is_delivered && result.bpkb.for_consumer && (
                      <li className="flex items-center gap-2 text-text">
                        <div className="h-2 w-2 rounded-full bg-accent" />
                        BPKB (Lokasi: {result.bpkb.lokasi || 'Admin BPKB'})
                      </li>
                    )}
                  </ul>
                  <p className="text-xs mt-4 text-muted">
                    * Catatan: Harap membawa KTP asli pemilik sesuai nama STNK dan nota serah terima atau Sales Order asli.
                  </p>
                  {DEALER_WA && (
                    <button
                      type="button"
                      onClick={() => {
                        // Daftar dokumen yang BENAR-BENAR siap diambil konsumen (real dari sistem).
                        // BPKB hanya jika cash (for_consumer); leasing diserahkan ke finance company.
                        const docs = [
                          result.stnk?.is_done && !result.stnk?.is_delivered ? 'STNK' : null,
                          result.plat?.is_done && !result.plat?.is_delivered ? 'Plat Nomor' : null,
                          result.bpkb?.is_done && !result.bpkb?.is_delivered && result.bpkb?.for_consumer ? 'BPKB' : null,
                        ].filter(Boolean)
                        const docList = docs.length ? docs.join(', ') : 'dokumen'
                        const msg = [
                          'Halo TDM Ketapang,',
                          `Saya ingin mengambil dokumen: ${docList}.`,
                          `No Mesin: ${result.engine_number || '-'}`,
                          `Nama (STNK): ${result.stnk_name || '-'}`,
                          'Apakah sudah bisa saya ambil?',
                          'Terima kasih.',
                        ].join('\n')
                        window.open(`https://wa.me/${DEALER_WA}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
                      }}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-green-700"
                    >
                      <MessageCircle size={16} />
                      Request via WhatsApp
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* FASE 2: Form permintaan ambil dokumen — tampil bila ada dokumen eligible */}
            {result.pickup_eligible && !pickupSuccess && (
              <div className="rounded-3xl border border-accent/30 bg-accent/5 p-6 shadow-lg">
                <div className="flex items-center gap-2.5 pb-4 border-b border-dashed border-border">
                  <Send size={18} className="text-accent" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-faint">Ajukan Permintaan Ambil Dokumen</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Dokumen siap diambil: <strong className="text-text-strong">{result.pickup_docs.join(', ')}</strong>.
                  Isi data di bawah agar staf kami dapat menghubungi Anda untuk penjadwalan pengambilan.
                </p>
                <form onSubmit={handleRequestPickup} className="mt-4 grid gap-4">
                  <div>
                    <label htmlFor="pickup-phone" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-accent">
                      Nomor Handphone (untuk dihubungi)
                    </label>
                    <input
                      id="pickup-phone"
                      type="tel"
                      value={pickupPhone}
                      onChange={(e) => setPickupPhone(e.target.value)}
                      placeholder="Contoh: 081234567..."
                      required
                      className="w-full rounded-xl border px-4 py-3 text-sm transition-all focus:outline-none border-border bg-hover text-text focus:border-accent focus:ring-4 focus:ring-accent/10"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-accent">
                      Cara Pengambilan
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setDeliveryMethod('AMBIL_SENDIRI')}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3.5 text-sm font-bold transition-all ${
                          deliveryMethod === 'AMBIL_SENDIRI'
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-border bg-hover text-muted hover:border-accent/40'
                        }`}
                      >
                        <Home size={18} /> Ambil Sendiri
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryMethod('EKSPEDISI')}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3.5 text-sm font-bold transition-all ${
                          deliveryMethod === 'EKSPEDISI'
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-border bg-hover text-muted hover:border-accent/40'
                        }`}
                      >
                        <Truck size={18} /> Kirim via Ekspedisi
                      </button>
                    </div>
                  </div>

                  {deliveryMethod === 'AMBIL_SENDIRI' ? (
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-accent">
                        Waktu Preferensi Pengambilan (opsional)
                      </label>
                      <p className="mb-2 text-[11px] text-muted">
                        Pilih tanggal & perkiraan jam. Jam operasional pengambilan 08.00–17.00.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <Calendar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                          <input
                            id="pickup-date"
                            type="date"
                            value={pickupDate}
                            min={todayLocalStr()}
                            onChange={(e) => setPickupDate(e.target.value)}
                            className="w-full rounded-xl border border-border bg-hover px-4 py-3 pl-9 text-sm transition-all focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 text-text"
                          />
                        </div>
                        <div className="relative">
                          <Clock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                          <input
                            id="pickup-hour"
                            type="time"
                            value={pickupHour}
                            min="08:00"
                            max="17:00"
                            onChange={(e) => setPickupHour(e.target.value)}
                            className="w-full rounded-xl border border-border bg-hover px-4 py-3 pl-9 text-sm transition-all focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 text-text"
                          />
                        </div>
                      </div>
                      {(pickupDate || pickupHour) && (
                        <p className="mt-2 text-[11px] font-semibold text-accent">
                          {formatPreferredTime(pickupDate, pickupHour)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="pickup-address" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-accent">
                        Alamat Pengiriman *
                      </label>
                      <p className="mb-2 text-[11px] text-muted">
                        Dealer akan memesan ekspedisi ke alamat ini. Isi selengkap mungkin (jalan, RT/RW, kelurahan, kecamatan, kota).
                      </p>
                      <div className="relative">
                        <MapPin size={16} className="pointer-events-none absolute left-3 top-3.5 text-muted" />
                        <textarea
                          id="pickup-address"
                          value={shippingAddress}
                          onChange={(e) => setShippingAddress(e.target.value)}
                          placeholder="Contoh: Jl. Merdeka No. 12, RT 03/RW 01, Kel. Sukajadi, Kec. Delta Pawan, Ketapang"
                          required
                          rows={3}
                          maxLength={500}
                          className="w-full rounded-xl border px-4 py-3 pl-9 text-sm transition-all focus:outline-none border-border bg-hover text-text focus:border-accent focus:ring-4 focus:ring-accent/10"
                        />
                      </div>
                    </div>
                  )}
                  <div>
                    <label htmlFor="pickup-notes" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-accent">
                      Catatan (opsional)
                    </label>
                    <textarea
                      id="pickup-notes"
                      value={pickupNotes}
                      onChange={(e) => setPickupNotes(e.target.value)}
                      placeholder="Contoh: akan diwakilkan oleh keluarga, bawa fotokopi KTP pemilik"
                      maxLength={500}
                      rows={2}
                      className="w-full rounded-xl border px-4 py-3 text-sm transition-all focus:outline-none border-border bg-hover text-text focus:border-accent focus:ring-4 focus:ring-accent/10"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-accent">
                      Foto KTP Pemilik (wajib)
                    </label>
                    <p className="mb-2 text-[11px] text-muted">JPG/PNG, maks 10MB. Bawa juga KTP asli saat pengambilan.</p>
                    {ktpFile ? (
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm font-semibold text-accent">
                        <span className="truncate">{ktpFile.name}</span>
                        <button
                          type="button"
                          onClick={() => { setKtpFile(null); setKtpPreview('') }}
                          className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-danger hover:bg-danger/10"
                        >
                          Ganti
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={openCamera}
                          className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent-soft px-3 py-3.5 text-sm font-bold text-accent transition hover:brightness-105 active:scale-[0.98]"
                        >
                          <Camera size={18} />
                          Ambil Foto
                        </button>
                        <label
                          htmlFor="pickup-ktp-file"
                          className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-hover px-3 py-3.5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                        >
                          <Upload size={18} />
                          Pilih File
                        </label>
                        {/* Pilih File: dari galeri/penyimpanan */}
                        <input
                          id="pickup-ktp-file"
                          type="file"
                          accept="image/jpeg,image/png,image/jpg"
                          onChange={handleKtpChange}
                          className="hidden"
                        />
                      </div>
                    )}
                    {ktpPreview && (
                      <img
                        src={ktpPreview}
                        alt="Pratinjau KTP"
                        className="mt-3 max-h-40 w-auto rounded-xl border border-border object-contain"
                      />
                    )}
                  </div>
                  {pickupError && (
                    <div className="flex gap-2 rounded-xl border border-danger/20 bg-danger-soft p-3 text-xs text-danger">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{pickupError}</span>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={pickupSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition-all shadow-md bg-accent hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {pickupSubmitting ? (
                      <><Loader2 size={18} className="animate-spin" /> Mengirim Permintaan...</>
                    ) : (
                      <><Send size={18} /> Kirim Permintaan Ambil Dokumen</>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Konfirmasi sukses permintaan pickup */}
            {pickupSuccess && (
              <div className="flex gap-4 rounded-3xl border border-success/30 bg-success/10 p-6 shadow-md">
                <CheckCircle2 size={24} className="shrink-0 text-success mt-1" />
                <div>
                  <h4 className="font-bold text-success text-base">Permintaan Terkirim</h4>
                  <p className="text-sm mt-1 leading-relaxed text-muted">{pickupSuccess}</p>
                  <p className="text-xs mt-3 text-muted">
                    Dokumen yang diminta: <strong className="text-text-strong">{result.pickup_docs.join(', ')}</strong> • No. Mesin {result.engine_number}
                  </p>
                </div>
              </div>
            )}

            {/* Stepper Timeline */}
            <div className="rounded-3xl border p-6 shadow-lg border-border bg-panel">
              <div className="flex items-center gap-2.5 pb-4 border-b border-dashed border-border mb-6">
                <Compass size={18} className="text-accent" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-faint">Timeline Pengurusan</h3>
              </div>

              {/* Steps Layout */}
              <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-[11px] sm:before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-hover">
                {/* 1. Faktur */}
                <TimelineStep
                  title="Permohonan Faktur"
                  description={
                    result.faktur.is_done
                      ? `Faktur selesai diterbitkan (No. ${result.faktur.no_faktur})`
                      : result.faktur.tgl_mohon
                      ? 'Sedang diajukan ke Main Dealer'
                      : 'Menunggu proses pengajuan'
                  }
                  date={result.faktur.tgl_terima || result.faktur.tgl_mohon}
                  isDone={result.faktur.is_done}
                  isActive={!result.faktur.is_done}
                  icon={<FileText size={16} />}
                />

                {/* 2. STNK */}
                <TimelineStep
                  title="Pengurusan STNK"
                  description={
                    result.stnk.is_delivered
                      ? 'STNK telah diserahkan ke Konsumen'
                      : result.stnk.is_done
                      ? `STNK telah selesai dicetak (No. ${result.stnk.no_stnk})`
                      : result.stnk.tgl_proses
                      ? 'Sedang diproses pendaftaran di Samsat'
                      : 'Menunggu proses pengajuan Samsat'
                  }
                  date={result.stnk.tgl_penyerahan || result.stnk.tgl_selesai || result.stnk.tgl_proses}
                  isDone={result.stnk.is_done}
                  isActive={result.faktur.is_done && !result.stnk.is_done}
                  icon={<Compass size={16} />}
                />

                {/* 3. Plat Nomor */}
                <TimelineStep
                  title="Plat Nomor (TNKB)"
                  description={
                    result.plat.is_delivered
                      ? 'Plat nomor telah diserahkan ke Konsumen'
                      : result.plat.is_done
                      ? `Plat nomor selesai dicetak (${result.no_polisi || ''})`
                      : 'Sedang dicetak oleh Samsat'
                  }
                  date={result.plat.tgl_penyerahan || result.plat.tgl_selesai}
                  isDone={result.plat.is_done}
                  isActive={result.stnk.is_done && !result.plat.is_done}
                  icon={<Award size={16} />}
                />

                {/* 4. BPKB */}
                <TimelineStep
                  title="Penerbitan BPKB"
                  description={
                    !result.bpkb.for_consumer
                      ? `BPKB atas pembiayaan leasing (${result.bpkb.finance_company}). Diserahkan cabang ke pihak leasing — tidak diambil konsumen.`
                      : result.bpkb.is_delivered
                      ? `BPKB diserahkan kepada ${result.bpkb.penerima || 'Konsumen'}`
                      : result.bpkb.is_done
                      ? `BPKB telah selesai diterbitkan (No. ${result.bpkb.no_bpkb})`
                      : 'Sedang diproses pendaftaran di Polda'
                  }
                  date={result.bpkb.tgl_penyerahan || result.bpkb.tgl_selesai}
                  isDone={result.bpkb.is_done}
                  isActive={result.faktur.is_done && !result.bpkb.is_done}
                  icon={<ShieldAlert size={16} />}
                />

                {/* 5. Serah Terima */}
                <TimelineStep
                  title="Selesai / Serah Terima"
                  description={
                    result.stnk.is_delivered && result.bpkb.is_delivered
                      ? 'Seluruh berkas dokumen (STNK, Plat & BPKB) telah lengkap diserahkan'
                      : result.stnk.is_delivered
                      ? 'STNK & Plat telah diserahkan. BPKB masih diproses.'
                      : 'Menunggu dokumen diserahkan kepada konsumen'
                  }
                  date={result.stnk.tgl_penyerahan && result.bpkb.tgl_penyerahan ? result.bpkb.tgl_penyerahan : null}
                  isDone={result.stnk.is_delivered && result.bpkb.is_delivered}
                  isActive={(result.stnk.is_done || result.bpkb.is_done) && !(result.stnk.is_delivered && result.bpkb.is_delivered)}
                  icon={<CheckCircle2 size={16} />}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-20 py-8 border-t transition-colors duration-300 border-border bg-panel text-muted text-center text-xs font-semibold">
        <div className="mx-auto max-w-6xl px-4">
          <p>© {new Date().getFullYear()} TDM Ketapang - Honda Authorized Dealer.</p>
          <p className="mt-1">DXK Operation System v1.0 • All Rights Reserved.</p>
        </div>
      </footer>

      {/* Modal kamera in-app (getUserMedia) untuk foto KTP langsung */}
      {cameraOpen && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black/90">
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <span className="text-sm font-bold">Ambil Foto KTP</span>
            <button
              type="button"
              onClick={closeCamera}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
            >
              Tutup
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            {cameraError ? (
              <div className="max-w-sm px-6 text-center text-white">
                <AlertCircle size={36} className="mx-auto mb-3 text-danger" />
                <p className="text-sm">{cameraError}</p>
                <button
                  type="button"
                  onClick={closeCamera}
                  className="mt-4 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25"
                >
                  Kembali
                </button>
              </div>
            ) : capturedBlob ? (
              <img src={capturedUrl} alt="Hasil tangkapan" className="max-h-full max-w-full object-contain" />
            ) : (
              <video ref={videoRef} playsInline muted className="max-h-full max-w-full object-contain" />
            )}
          </div>
          {!cameraError && (
            <div className="flex items-center justify-center gap-4 px-4 py-5">
              {capturedBlob ? (
                <>
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/25"
                  >
                    <RefreshCw size={18} /> Ulangi
                  </button>
                  <button
                    type="button"
                    onClick={useCapturedPhoto}
                    className="flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white hover:brightness-110"
                  >
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
      )}
    </div>
  )
}

function TimelineStep({ title, description, date, isDone, isActive, icon }) {
  const formatDateLocal = (dateStr) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const formattedDate = formatDateLocal(date)

  let nodeColorClass
  let bgClass
  let textTitleClass

  if (isDone) {
    nodeColorClass = 'bg-accent text-white shadow-accent/30'
    bgClass = 'bg-panel border-border'
    textTitleClass = 'text-text-strong'
  } else if (isActive) {
    nodeColorClass = 'bg-accent text-white animate-pulse shadow-accent/20'
    bgClass = 'bg-accent-soft/50 border-accent/20'
    textTitleClass = 'text-accent font-bold'
  } else {
    nodeColorClass = 'bg-hover text-faint'
    bgClass = 'opacity-60'
    textTitleClass = 'text-muted'
  }

  return (
    <div className="relative group transition-all duration-300">
      {/* Icon Node */}
      <div className={`absolute -left-6 sm:-left-8 top-1 flex h-[24px] w-[24px] sm:h-[32px] sm:w-[32px] items-center justify-center rounded-full border-4 border-panel text-xs font-semibold shadow-md transition-all duration-300 ${nodeColorClass} z-10`}>
        {isDone ? <Check size={14} className="sm:h-4 sm:w-4" /> : icon}
      </div>

      {/* Content Box */}
      <div className={`rounded-xl border p-4 shadow-sm transition-all duration-300 ${bgClass}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <h4 className={`text-sm font-bold tracking-tight ${textTitleClass}`}>{title}</h4>
          {formattedDate && (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Calendar size={12} className="shrink-0 text-faint" />
              <span>{formattedDate}</span>
            </div>
          )}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{description}</p>
      </div>
    </div>
  )
}
