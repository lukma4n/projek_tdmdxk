import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import path from 'path'
import dotenv from 'dotenv'
import { connectDB, prisma } from './config/db.js'
import { connectRedis } from './config/redis.js'
import { errorHandler } from './middleware/errorHandler.js'
import { maintenanceGuard } from './middleware/maintenance.js'
import { requestId } from './middleware/requestId.js'

// Routes
import authRoutes from './routes/authRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import hotlineRoutes from './routes/hotlineRoutes.js'
import stockRoutes from './routes/stockRoutes.js'
import workshopRoutes from './routes/workshopRoutes.js'
import opnameRoutes from './routes/opnameRoutes.js'
import syncRoutes from './routes/syncRoutes.js'
import customerRoutes from './routes/customerRoutes.js'
import userRoutes from './routes/userRoutes.js'
import showroomRoutes from './routes/showroomRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Security middleware
app.use(helmet())
app.use(requestId)
app.use(cookieParser())

// Rate limiting
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
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})
app.use('/api/auth/login', authLimiter)
app.use('/api/sync/', importLimiter)
app.use('/api/', apiLimiter)

// Middleware
const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
  'http://172.20.10.9:3001',
  'http://172.20.10.9:5173',
]
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
app.use('/api/opname', opnameRoutes)
app.use('/api/sync', syncRoutes)
app.use('/api/users', userRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/showroom', showroomRoutes)
app.use('/api/notifications', notificationRoutes)

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

const isMainModule = import.meta.url === new URL(process.argv[1], import.meta.url).href
if (isMainModule) {
  start().catch(console.error)
}
