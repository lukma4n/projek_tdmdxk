import { getMaintenanceState, isMaintenanceActive } from '../services/maintenanceService.js'

export function maintenanceGuard(req, res, next) {
  if (!isMaintenanceActive()) return next()

  if (req.path === '/health') return next()

  const state = getMaintenanceState()
  return res.status(503).json({
    error: 'Sistem sedang maintenance. Coba lagi beberapa saat.',
    maintenance: state,
  })
}
