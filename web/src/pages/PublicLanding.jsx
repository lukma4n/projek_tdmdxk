import { Link } from 'react-router-dom'
import { FileSearch, ShieldCheck, ArrowRight, Bike } from 'lucide-react'

export default function PublicLanding() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      {/* Brand bar */}
      <header className="border-b border-border bg-panel">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white shadow-sm shadow-accent/30">
            <Bike size={22} />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-text-strong">TDM KETAPANG</h1>
            <p className="text-[11px] font-semibold text-muted">DXK Operation System</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-text-strong sm:text-4xl">
            Selamat Datang
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted sm:text-base">
            Silakan pilih layanan. Konsumen dapat memeriksa status pengurusan dokumen STNK &amp; BPKB,
            staf dapat masuk ke area kerja.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Pintu 1 — Konsumen */}
          <Link
            to="/cek"
            className="group flex flex-col rounded-3xl border border-border bg-panel p-7 shadow-sm transition hover:border-accent hover:shadow-lg"
          >
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <FileSearch size={28} />
            </div>
            <h3 className="text-lg font-bold text-text-strong">Cek Dokumen Saya</h3>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">
              Lacak status STNK, plat nomor, dan BPKB motor Honda Anda secara real-time. Cukup Nomor
              Mesin dan Nomor HP yang terdaftar.
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
              Mulai Cek
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          {/* Pintu 2 — Karyawan */}
          <Link
            to="/login"
            className="group flex flex-col rounded-3xl border border-border bg-panel p-7 shadow-sm transition hover:border-accent hover:shadow-lg"
          >
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-hover text-muted">
              <ShieldCheck size={28} />
            </div>
            <h3 className="text-lg font-bold text-text-strong">Area Karyawan</h3>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">
              Masuk ke sistem operasional bengkel &amp; showroom. Khusus staf TDM Ketapang yang memiliki
              akun.
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-text-strong">
              Masuk
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-panel py-5 text-center text-xs font-semibold text-faint">
        © {new Date().getFullYear()} TDM Ketapang — Honda Authorized Dealer
      </footer>
    </div>
  )
}
