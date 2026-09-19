import { pathToFileURL } from 'node:url'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import crypto from 'node:crypto'
import path from 'path'
import dotenv from 'dotenv'
import { connectDB, prisma } from './config/db.js'
import { connectRedis } from './config/redis.js'
import { errorHandler } from './middleware/errorHandler.js'
import { maintenanceGuard } from './middleware/maintenance.js'
import { requestId } from './middleware/requestId.js'
import { releaseStaleImportLocks } from './services/importLockService.js'
import { cleanupStaleUploads } from './services/uploadCleanupService.js'

// Routes
import authRoutes from './routes/authRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import hotlineRoutes from './routes/hotlineRoutes.js'
import stockRoutes from './routes/stockRoutes.js'
import workshopRoutes from './routes/workshopRoutes.js'
import workshopReportRoutes from './routes/workshopReportRoutes.js'
import opnameRoutes from './routes/opnameRoutes.js'
import syncRoutes from './routes/syncRoutes.js'
import customerRoutes from './routes/customerRoutes.js'
import phoneValidationRoutes from './routes/phoneValidationRoutes.js'
import followupRoutes from './routes/followupRoutes.js'
import whatsappTemplateRoutes from './routes/whatsappTemplateRoutes.js'
import userRoutes from './routes/userRoutes.js'
import showroomRoutes from './routes/showroomRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'
import rolePermissionRoutes from './routes/rolePermissionRoutes.js'
import publicRoutes from './routes/publicRoutes.js'
import securityRoutes from './routes/securityRoutes.js'


dotenv.config()

// Validasi environment kritis saat boot. Fail-fast di produksi agar tidak
// pernah jalan dengan secret kosong/lemah; di non-produksi cukup warning.
function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production'
  const problems = []
  const secret = process.env.JWT_SECRET
  // Placeholder publik dari template *.example (tidak sensitif).
  const PLACEHOLDERS = ['your-secret-key-here']
  // Hash SHA-256 dari secret yang pernah bocor & sudah di-scrub dari histori git.
  // Disimpan sebagai hash agar nilai aslinya tak pernah kembali muncul di source.
  const LEAKED_SECRET_HASHES = new Set([
    '63cf0b490fefe668f4ccbdd09eb5a92bbf0ee4b14acc2c2b0e0e2893fe30d137',
  ])
  const isLeaked = secret && LEAKED_SECRET_HASHES.has(crypto.createHash('sha256').update(secret).digest('hex'))

  if (!secret) problems.push('JWT_SECRET belum di-set')
  else if (PLACEHOLDERS.includes(secret) || isLeaked) problems.push('JWT_SECRET memakai nilai default/bocor — ganti dengan `openssl rand -hex 32`')
  else if (secret.length < 32) problems.push('JWT_SECRET terlalu pendek (minimal 32 karakter)')

  if (!process.env.DATABASE_URL) problems.push('DATABASE_URL belum di-set')

  if (problems.length === 0) return
  const msg = ['Konfigurasi environment tidak valid:', ...problems.map((p) => `  - ${p}`)].join('\n')
  if (isProd) {
    console.error(`❌ ${msg}\nServer dihentikan.`)
    process.exit(1)
  } else {
    console.warn(`⚠️  ${msg}`)
  }
}
validateEnv()

const app = express()
const PORT = process.env.PORT || 3001

// Percaya 1 hop reverse proxy (nginx/PM2) agar req.protocol & x-forwarded-proto akurat
app.set('trust proxy', 1)

// Security middleware
app.use(helmet())
app.use(requestId)
app.use(cookieParser())

// Middleware — cors, json, urlencoded harus SEBELUM rate limiter
const defaultOrigins = ['http://localhost:3001', 'http://localhost:5173', 'http://127.0.0.1:3001', 'http://127.0.0.1:5173']
const extraOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean) : []
const allowedOrigins = [...new Set([...defaultOrigins, ...extraOrigins])]
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Rate limiting — ditempatkan SETELAH cors/json/urlencoded
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login, coba lagi dalam 15 menit.' },
})
const importLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak import, coba lagi dalam 15 menit.' },
})
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})
const publicCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan pencarian, coba lagi dalam 15 menit.' },
})
app.use('/api/auth/login', authLimiter)
app.use('/api/sync/', importLimiter)
app.use('/api/public/', publicCheckLimiter)
app.use('/api/', apiLimiter)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use(maintenanceGuard)

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/hotline', hotlineRoutes)
app.use('/api/stock', stockRoutes)
app.use('/api/workshop', workshopRoutes)
app.use('/api/workshop', workshopReportRoutes)
app.use('/api/opname', opnameRoutes)
app.use('/api/sync', syncRoutes)
app.use('/api/users', userRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/phone-validation', phoneValidationRoutes)
app.use('/api/followup', followupRoutes)
app.use('/api/whatsapp-templates', whatsappTemplateRoutes)
app.use('/api/showroom', showroomRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/permissions', rolePermissionRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/security', securityRoutes)


// Serve static files from frontend build in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(process.cwd(), '..', 'web', 'dist')
  app.use(express.static(distPath))
  // Express 5 requires regex for catch-all, not string '*'
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// Error handler
app.use(errorHandler)

// Start server only when this module is run directly (not imported for tests)
async function start() {
  await connectDB()
  await connectRedis()

  const staleLocks = await releaseStaleImportLocks().catch(() => 0)
  if (staleLocks > 0) {
    console.log(`🔓 ${staleLocks} import lock tertinggal dari proses sebelumnya dibersihkan.`)
  }

  const staleUploads = await cleanupStaleUploads().catch(() => ({ deleted: 0, bytes: 0 }))
  if (staleUploads.deleted > 0) {
    const mb = (staleUploads.bytes / 1024 / 1024).toFixed(1)
    console.log(`🧹 ${staleUploads.deleted} file upload tertinggal dibersihkan (${mb} MB).`)
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`)
  })

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`)
    server.close(async () => {
      console.log('HTTP server closed.')
      await prisma.$disconnect()
      console.log('Prisma disconnected.')
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

export { app }

const isMainModule = import.meta.url === pathToFileURL(process.argv[1]).href
const isPm2 = 'pm_id' in process.env
if (isMainModule || isPm2) {
  start().catch(console.error)
}
