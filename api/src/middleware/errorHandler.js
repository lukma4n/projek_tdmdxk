import { logger } from '../utils/logger.js'

export function errorHandler(err, req, res, next) {
  logger.error(req, 'Unhandled error', { error: err.message, stack: err.stack })

  if (err.code === 'P2002') {
    return res.status(409).json({ requestId: req.id, error: 'Data sudah ada' })
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ requestId: req.id, error: 'Data tidak ditemukan' })
  }

  res.status(err.status || err.statusCode || 500).json({
    requestId: req.id,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
}
