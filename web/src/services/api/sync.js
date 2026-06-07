import fetchWithAuth from './fetchWithAuth.js'

export const previewImport = (module, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth(`/sync/${module}/preview`, { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}

export const uploadHotline = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/sync/hotline', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}

export const uploadStock = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/sync/stock', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}

export const uploadWorkshop = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/sync/workshop', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}

export const uploadSales = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/sync/sales', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}

export const getSyncLogs = () => fetchWithAuth('/sync/logs')
export const getAuditLogs = () => fetchWithAuth('/sync/audit-logs')
export const getBackups = () => fetchWithAuth('/sync/backups')
export const createBackup = () => fetchWithAuth('/sync/backups', { method: 'POST' })
export const cleanupBackups = (keepLatest = 30) => fetchWithAuth('/sync/backups/cleanup', { method: 'POST', body: { keep_latest: keepLatest } })
export const restoreBackup = (filename) => fetchWithAuth(`/sync/backups/${encodeURIComponent(filename)}/restore`, { method: 'POST', timeout: 300000 })
