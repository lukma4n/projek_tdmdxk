import { logger } from '../utils/logger.js'

export function errorHandler(err, req, res, next) {
  logger.error(req, 'Unhandled error', { error: err.message, stack: err.stack })

  if (err.code === 'P2002') {
    return res.status(409).json({ requestId: req.id, error: 'Data sudah ada' })
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ requestId: req.id, error: 'Data tidak ditemukan' })
  }

  const status = err.status || err.statusCode || 500
  // Expose message only for client errors (4xx) yang memang dimaksud untuk user.
  // Error 5xx tidak boleh expose internal detail ke client.
  const userMessage = status < 500
    ? (err.message || 'Permintaan tidak valid')
    : 'Terjadi kesalahan pada server. Silakan coba lagi.'

  res.status(status).json({
    requestId: req.id,
    error: userMessage,
    ...(process.env.NODE_ENV === 'development' && { debug: err.message, stack: err.stack }),
  })
}
