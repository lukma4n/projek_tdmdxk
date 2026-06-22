import { ArrowLeft, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-hover flex items-center justify-center p-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-hover rounded-full mb-4">
          <AlertCircle className="text-faint" size={32} />
        </div>
        <h1 className="text-4xl font-bold text-text-strong mb-2">404</h1>
        <p className="text-muted mb-6">Halaman tidak ditemukan</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:brightness-110 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <ArrowLeft size={16} />
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  )
}
