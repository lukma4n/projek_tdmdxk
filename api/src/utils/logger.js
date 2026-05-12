/**
 * Minimal structured logger that wraps console.
 * Outputs JSON-like structured lines for easier log parsing.
 */
export const logger = {
  _base(level, req, message, extra = {}) {
    const entry = {
      time: new Date().toISOString(),
      level,
      requestId: req?.id || null,
      method: req?.method || null,
      path: req?.path || req?.originalUrl || null,
      message,
      ...extra,
    }
    const line = JSON.stringify(entry)
    if (level === 'error') {
      console.error(line)
    } else if (level === 'warn') {
      console.warn(line)
    } else {
      console.log(line)
    }
  },
  info(req, message, extra) {
    this._base('info', req, message, extra)
  },
  warn(req, message, extra) {
    this._base('warn', req, message, extra)
  },
  error(req, message, extra) {
    this._base('error', req, message, extra)
  },
}
