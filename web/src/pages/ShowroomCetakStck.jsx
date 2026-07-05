import { useState, useMemo, useCallback, useEffect } from 'react'
import { Printer, RotateCcw, SlidersHorizontal, CalendarPlus, Eye, EyeOff, Search, Loader2, AlertTriangle } from 'lucide-react'
import { api } from '../services/api'

/**
 * Cetak STCK (Surat Tanda Coba Kendaraan Bermotor) untuk konsumen.
 *
 * Form fisik STCK adalah continuous-form pre-printed milik POLRI: label & garis
 * sudah tercetak di kertas. Aplikasi HANYA mencetak data variabel (overlay) yang
 * harus pas posisinya di atas kertas asli. Karena tidak ada cara mendapatkan posisi
 * mm yang persis dari scan, halaman ini menyediakan KALIBRASI (offset global + posisi
 * per-field) yang disimpan di localStorage, plus preview di layar dengan latar scan
 * form (web/public/stck-form.jpg) supaya bisa disejajarkan dulu sebelum buang kertas.
 *
 * Catatan: posisi field dinyatakan dalam PERSEN terhadap kotak sertifikat (bukan mm),
 * jadi konsisten antara preview (px) dan cetak (mm). offsetX/offsetY (mm) menggeser
 * semua field saat kalibrasi printer.
 */

// Geometri kotak sertifikat di dalam file scan stck-form.jpg (2805 x 1984 px).
// Dipakai agar latar form di preview pas mengisi kotak sertifikat.
const IMG_W = 2805
const IMG_H = 1984
const CERT_X = 504 // px kiri kotak sertifikat
const CERT_Y = 245 // px atas kotak sertifikat
const CERT_W = 2156 // px lebar kotak sertifikat
const CERT_H = 679 // px tinggi kotak sertifikat

const PREVIEW_PX_PER_MM = 3 // skala preview di layar

const STORAGE_KEY = 'stck_cfg_v1'

// Posisi default tiap field dalam % terhadap kotak sertifikat. x = dari kiri, y = dari atas.
const DEFAULT_LAYOUT = [
  { key: 'nomor_registrasi', label: 'Nomor Registrasi', x: 22, y: 36, size: 9, nowrap: true },
  { key: 'nama_penanggung_jawab', label: 'Nama Penanggung Jawab', x: 22, y: 44, size: 9, nowrap: true },
  { key: 'nama_badan_usaha', label: 'Nama Badan Usaha / Lembaga', x: 22, y: 53, size: 9, nowrap: true },
  { key: 'alamat_penanggung_jawab', label: 'Alamat Penanggung Jawab', x: 22, y: 63, size: 9, nowrap: true },
  { key: 'alamat_badan_usaha', label: 'Alamat Badan Usaha / Lembaga', x: 22, y: 76, size: 9, nowrap: true },
  { key: 'nomor_urut_pendaftaran', label: 'Nomor Urut Pendaftaran', x: 22, y: 85, size: 9, nowrap: true },
  { key: 'kode_lokasi', label: 'Kode Lokasi', x: 22, y: 94, size: 9, nowrap: true },
  { key: 'berlaku_tgl', label: 'Berlaku Tgl.', x: 37, y: 95, size: 9, nowrap: true },
  { key: 'sd_tgl', label: 'S.D. Tgl.', x: 52, y: 95, size: 9, nowrap: true },
]

const DEFAULT_CALIBRATION = { offsetX: 0, offsetY: 0, fontScale: 100, formW: 241, formH: 76 }

// Identitas dealer — diisi otomatis, tetap bisa diedit.
// Catatan: alamat dipakai untuk ALAMAT PENANGGUNG JAWAB; ALAMAT BADAN USAHA dikosongkan.
const DEALER_NAME = 'PT. TUNAS DWIPA MATRA'
const DEALER_ADDRESS = 'Jl. Ahmad Yani No.133, Kantor, Kec. Delta Pawan, Kabupaten Ketapang, Kalimantan Barat 78821'

const DEFAULT_VALUES = {
  nomor_registrasi: '',
  nama_penanggung_jawab: '',
  nama_badan_usaha: DEALER_NAME,
  alamat_penanggung_jawab: DEALER_ADDRESS,
  alamat_badan_usaha: '',
  nomor_urut_pendaftaran: '',
  kode_lokasi: '',
  berlaku_tgl: '',
  sd_tgl: '',
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ISO datetime (so_date dari API) -> "27 Jun 2026" untuk tabel
function formatTglSO(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ISO datetime -> yyyy-mm-dd (untuk <input type=date>), pakai bagian tanggal LOKAL (hindari toISOString)
function toDateInput(value) {
  if (!value) return ''
  const d = new Date(value)
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

// yyyy-mm-dd -> dd-mm-yyyy (parse manual, hindari toISOString/timezone)
function formatTglID(value) {
  if (!value) return ''
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}-${m}-${y}`
}

// Tambah n hari ke yyyy-mm-dd, balikkan yyyy-mm-dd (timezone-safe pakai metode lokal)
function addDays(value, n) {
  if (!value) return ''
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { calibration: { ...DEFAULT_CALIBRATION }, layout: DEFAULT_LAYOUT.map((f) => ({ ...f })) }
    const parsed = JSON.parse(raw)
    const calibration = { ...DEFAULT_CALIBRATION, ...(parsed.calibration || {}) }
    // gabungkan layout tersimpan dgn default (jaga2 ada field baru)
    const savedByKey = Object.fromEntries((parsed.layout || []).map((f) => [f.key, f]))
    const layout = DEFAULT_LAYOUT.map((f) => ({ ...f, ...(savedByKey[f.key] || {}) }))
    return { calibration, layout }
  } catch {
    return { calibration: { ...DEFAULT_CALIBRATION }, layout: DEFAULT_LAYOUT.map((f) => ({ ...f })) }
  }
}

export default function ShowroomCetakStck() {
  const [values, setValues] = useState(DEFAULT_VALUES)
  const initial = useMemo(() => loadConfig(), [])
  const [calibration, setCalibration] = useState(initial.calibration)
  const [layout, setLayout] = useState(initial.layout)
  const [showCalib, setShowCalib] = useState(false)
  const [showBg, setShowBg] = useState(true)

  // ---- Pencarian data penjualan (sumber: tabel customers) ----
  const [period, setPeriod] = useState('today')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loadingRows, setLoadingRows] = useState(false)
  const [rowsError, setRowsError] = useState('')

  useEffect(() => {
    let active = true
    const handle = setTimeout(async () => {
      try {
        setLoadingRows(true)
        setRowsError('')
        const res = await api.getStckSalesLookup({ period, search: search.trim() })
        if (active) setRows(res.items || [])
      } catch (err) {
        if (active) setRowsError(err.message || 'Gagal memuat data penjualan')
      } finally {
        if (active) setLoadingRows(false)
      }
    }, 300) // debounce ketikan search
    return () => {
      active = false
      clearTimeout(handle)
    }
  }, [period, search])

  const handlePick = (row) => {
    const berlaku = toDateInput(row.so_date) // tgl pembelian
    setValues((v) => ({
      ...v,
      nomor_registrasi: row.no_engine || '',
      nama_penanggung_jawab: row.customer_name || '',
      alamat_penanggung_jawab: DEALER_ADDRESS,
      nama_badan_usaha: DEALER_NAME,
      alamat_badan_usaha: '',
      berlaku_tgl: berlaku,
      sd_tgl: berlaku ? addDays(berlaku, 14) : '', // berlaku s.d. 14 hari ke depan
    }))
  }

  const persist = useCallback((nextCalib, nextLayout) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ calibration: nextCalib, layout: nextLayout }))
    } catch {
      /* abaikan quota error */
    }
  }, [])

  const updateValue = (key, val) => setValues((v) => ({ ...v, [key]: val }))

  const updateCalib = (key, val) => {
    const next = { ...calibration, [key]: val }
    setCalibration(next)
    persist(next, layout)
  }

  const updateLayout = (key, prop, val) => {
    const next = layout.map((f) => (f.key === key ? { ...f, [prop]: val } : f))
    setLayout(next)
    persist(calibration, next)
  }

  const resetCalib = () => {
    const cal = { ...DEFAULT_CALIBRATION }
    const lay = DEFAULT_LAYOUT.map((f) => ({ ...f }))
    setCalibration(cal)
    setLayout(lay)
    persist(cal, lay)
  }

  const fillSdTgl = () => {
    if (!values.berlaku_tgl) return
    updateValue('sd_tgl', addDays(values.berlaku_tgl, 14)) // 14 hari ke depan dari tgl berlaku
  }

  // nilai yang ditampilkan/dicetak per field (tanggal diformat, semua HURUF KAPITAL)
  const renderValue = (key) => {
    if (key === 'berlaku_tgl' || key === 'sd_tgl') return formatTglID(values[key])
    return (values[key] || '').toUpperCase()
  }

  // ---- Geometri latar form (CSS background) untuk preview & mode uji ----
  const bg = useMemo(() => {
    const sx = IMG_W / CERT_W // skala lebar
    const sy = IMG_H / CERT_H // skala tinggi
    const px = CERT_X / CERT_W // offset kiri (fraksi lebar form)
    const py = CERT_Y / CERT_H // offset atas (fraksi tinggi form)
    return { sx, sy, px, py }
  }, [])

  const handlePrint = (withBackground) => {
    const { formW, formH, offsetX, offsetY, fontScale } = calibration
    const fieldsHtml = layout
      .map((f) => {
        const text = renderValue(f.key)
        if (!text) return ''
        const fs = ((f.size || 9) * fontScale) / 100
        const ws = f.nowrap ? 'white-space:nowrap;' : ''
        return `<div style="position:absolute;left:calc(${f.x}% + ${offsetX}mm);top:calc(${f.y}% + ${offsetY}mm);font-size:${fs}pt;${ws}transform:translateY(-100%);">${escapeHtml(
          text,
        )}</div>`
      })
      .join('')

    const bgStyle = withBackground
      ? `background-image:url('/stck-form.jpg');background-repeat:no-repeat;` +
        `background-size:${(bg.sx * formW).toFixed(2)}mm ${(bg.sy * formH).toFixed(2)}mm;` +
        `background-position:-${(bg.px * formW).toFixed(2)}mm -${(bg.py * formH).toFixed(2)}mm;`
      : ''

    const html = `<!DOCTYPE html><html><head><title>Cetak STCK</title>
      <style>
        @page { size: ${formW}mm ${formH}mm; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; }
        .form { position: relative; width: ${formW}mm; height: ${formH}mm;
          font-family: Arial, Helvetica, sans-serif; color: #000; ${bgStyle} }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style></head>
      <body><div class="form">${fieldsHtml}</div>
      <script>window.onload=function(){setTimeout(function(){window.print();window.close();},250);};</script>
      </body></html>`

    const w = window.open('', '_blank')
    if (!w) {
      alert('Popup diblokir browser. Izinkan popup untuk mencetak.')
      return
    }
    w.document.write(html)
    w.document.close()
  }

  // ---- Preview di layar ----
  const previewW = calibration.formW * PREVIEW_PX_PER_MM
  const previewH = calibration.formH * PREVIEW_PX_PER_MM
  const offsetXpx = calibration.offsetX * PREVIEW_PX_PER_MM
  const offsetYpx = calibration.offsetY * PREVIEW_PX_PER_MM

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Cetak STCK Konsumen</h1>
        <p className="mt-1 text-sm text-slate-500">
          Surat Tanda Coba Kendaraan Bermotor — cetak overlay ke kertas STCK asli. Isi data, sejajarkan di
          preview, lalu cetak. Atur posisi lewat panel kalibrasi bila belum pas di kertas.
        </p>
      </div>

      {/* ---------- Tarik dari Data Penjualan ---------- */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600">Tarik dari Data Penjualan</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
            {[
              { v: 'today', l: 'Hari Ini' },
              { v: 'yesterday', l: 'Kemarin' },
              { v: 'all', l: 'Semua' },
            ].map((p) => (
              <button
                key={p.v}
                type="button"
                onClick={() => setPeriod(p.v)}
                className={`px-3 py-1.5 text-xs font-semibold transition ${
                  period === p.v ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p.l}
              </button>
            ))}
          </div>
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari no mesin / nama / no SO..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-slate-200">
          {loadingRows ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" /> Memuat...
            </div>
          ) : rowsError ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-red-500">
              <AlertTriangle size={16} /> {rowsError}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              Tidak ada data penjualan{search ? ' untuk pencarian ini' : ' pada periode ini'}.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Tgl SO</th>
                  <th className="px-3 py-2 font-medium">Nama</th>
                  <th className="px-3 py-2 font-medium">No Mesin</th>
                  <th className="px-3 py-2 font-medium">No Rangka</th>
                  <th className="px-3 py-2 font-medium">Type / Model</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{formatTglSO(row.so_date)}</td>
                    <td className="px-3 py-2 font-medium text-slate-700">{row.customer_name || '-'}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-600">{row.no_engine || '-'}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-600">{row.no_frame || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {[row.type, row.model].filter(Boolean).join(' / ') || '-'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handlePick(row)}
                        className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Pilih
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Pilih unit untuk mengisi Nomor Registrasi (no mesin) &amp; Nama Penanggung Jawab (konsumen) otomatis. Nama
          Badan Usaha &amp; Alamat Penanggung Jawab terisi PT TDM; Alamat Badan Usaha dikosongkan. Semua tetap bisa
          diedit di bawah.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* ---------- Form input ---------- */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-600">Data STCK</h2>
          <div className="space-y-3">
            {[
              { key: 'nomor_registrasi', label: 'Nomor Registrasi' },
              { key: 'nama_penanggung_jawab', label: 'Nama Penanggung Jawab' },
              { key: 'nama_badan_usaha', label: 'Nama Badan Usaha / Lembaga Penelitian' },
              { key: 'alamat_penanggung_jawab', label: 'Alamat Penanggung Jawab' },
              { key: 'alamat_badan_usaha', label: 'Alamat Badan Usaha / Lembaga Penelitian' },
              { key: 'nomor_urut_pendaftaran', label: 'Nomor Urut Pendaftaran' },
              { key: 'kode_lokasi', label: 'Kode Lokasi' },
            ].map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-slate-600">{f.label}</label>
                <input
                  type="text"
                  value={values[f.key]}
                  onChange={(e) => updateValue(f.key, e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Berlaku Tgl.</label>
                <input
                  type="date"
                  value={values.berlaku_tgl}
                  onChange={(e) => updateValue('berlaku_tgl', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">S.D. Tgl.</label>
                <input
                  type="date"
                  value={values.sd_tgl}
                  onChange={(e) => updateValue('sd_tgl', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={fillSdTgl}
              disabled={!values.berlaku_tgl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <CalendarPlus size={14} /> Isi S.D. otomatis (+14 hari)
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => handlePrint(false)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Printer size={16} /> Cetak ke kertas STCK
            </button>
            <button
              type="button"
              onClick={() => handlePrint(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              title="Cetak data + gambar form di kertas kosong untuk uji posisi"
            >
              <Printer size={16} /> Cetak uji (dengan latar form)
            </button>
          </div>
        </div>

        {/* ---------- Preview ---------- */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">Preview</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowBg((s) => !s)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {showBg ? <EyeOff size={14} /> : <Eye size={14} />} {showBg ? 'Sembunyikan' : 'Tampilkan'} latar
              </button>
              <button
                type="button"
                onClick={() => setShowCalib((s) => !s)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <SlidersHorizontal size={14} /> Kalibrasi
              </button>
            </div>
          </div>

          <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-3">
            <div
              className="relative mx-auto bg-white shadow"
              style={{
                width: `${previewW}px`,
                height: `${previewH}px`,
                backgroundImage: showBg ? "url('/stck-form.jpg')" : 'none',
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${bg.sx * previewW}px ${bg.sy * previewH}px`,
                backgroundPosition: `-${bg.px * previewW}px -${bg.py * previewH}px`,
              }}
            >
              {layout.map((f) => {
                const text = renderValue(f.key)
                if (!text) return null
                return (
                  <div
                    key={f.key}
                    className="absolute font-sans text-black"
                    style={{
                      left: `${(f.x / 100) * previewW + offsetXpx}px`,
                      top: `${(f.y / 100) * previewH + offsetYpx}px`,
                      fontSize: `${((f.size || 9) * calibration.fontScale) / 100 * PREVIEW_PX_PER_MM * 0.353}px`,
                      whiteSpace: f.nowrap ? 'nowrap' : 'normal',
                      transform: 'translateY(-100%)',
                    }}
                  >
                    {text}
                  </div>
                )
              })}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Latar form hanya panduan di layar &amp; mode &quot;cetak uji&quot;. Pada &quot;Cetak ke kertas STCK&quot;
            hanya data yang dicetak.
          </p>

          {/* ---------- Panel kalibrasi ---------- */}
          {showCalib && (
            <div className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Kalibrasi (tersimpan otomatis)</h3>
                <button
                  type="button"
                  onClick={resetCalib}
                  className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { key: 'offsetX', label: 'Geser X (mm)', step: 0.5 },
                  { key: 'offsetY', label: 'Geser Y (mm)', step: 0.5 },
                  { key: 'fontScale', label: 'Skala font (%)', step: 5 },
                  { key: 'formW', label: 'Lebar form (mm)', step: 1 },
                  { key: 'formH', label: 'Tinggi form (mm)', step: 1 },
                ].map((c) => (
                  <div key={c.key}>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500">{c.label}</label>
                    <input
                      type="number"
                      step={c.step}
                      value={calibration[c.key]}
                      onChange={(e) => updateCalib(c.key, Number(e.target.value))}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div>
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Posisi per field (%)</h4>
                <div className="space-y-1.5">
                  {layout.map((f) => (
                    <div key={f.key} className="flex items-center gap-2">
                      <span className="w-40 shrink-0 truncate text-[11px] text-slate-600" title={f.label}>
                        {f.label}
                      </span>
                      <label className="text-[10px] text-slate-400">X</label>
                      <input
                        type="number"
                        step={0.5}
                        value={f.x}
                        onChange={(e) => updateLayout(f.key, 'x', Number(e.target.value))}
                        className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                      />
                      <label className="text-[10px] text-slate-400">Y</label>
                      <input
                        type="number"
                        step={0.5}
                        value={f.y}
                        onChange={(e) => updateLayout(f.key, 'y', Number(e.target.value))}
                        className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                      />
                      <label className="text-[10px] text-slate-400">pt</label>
                      <input
                        type="number"
                        step={0.5}
                        value={f.size}
                        onChange={(e) => updateLayout(f.key, 'size', Number(e.target.value))}
                        className="w-14 rounded border border-slate-300 px-1.5 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
