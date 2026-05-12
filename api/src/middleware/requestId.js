import { randomUUID } from 'node:crypto'

/**
 * Attach a unique request ID to every incoming request.
 * Makes structured logging and debugging much easier.
 */
export function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || randomUUID()
  req.id = id
  res.setHeader('X-Request-Id', id)
  next()
}
