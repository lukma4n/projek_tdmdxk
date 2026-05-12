import fetchWithAuth from './fetchWithAuth.js'

export const getOpnameSessions = () => fetchWithAuth('/opname')
export const createOpnameSession = (data) => fetchWithAuth('/opname', { method: 'POST', body: data })
export const getOpnameItems = (id) => fetchWithAuth(`/opname/${id}/items`)
export const getOpnameReport = (id) => fetchWithAuth(`/opname/${id}/report`)
export const addOpnameItem = (id, data) => fetchWithAuth(`/opname/${id}/items`, { method: 'POST', body: data })
export const updateOpnameItem = (sessionId, itemId, qty_physical) => fetchWithAuth(`/opname/${sessionId}/items/${itemId}`, { method: 'PATCH', body: { qty_physical } })
export const deleteOpnameItem = (sessionId, itemId) => fetchWithAuth(`/opname/${sessionId}/items/${itemId}`, { method: 'DELETE' })
export const completeOpnameSession = (id) => fetchWithAuth(`/opname/${id}/complete`, { method: 'PATCH' })
export const approveOpnameKabeng = (id) => fetchWithAuth(`/opname/${id}/approve-kabeng`, { method: 'PATCH' })
export const sendOpnameToKacab = (id) => fetchWithAuth(`/opname/${id}/send-kacab`, { method: 'PATCH' })
export const approveOpnameKacab = (id) => fetchWithAuth(`/opname/${id}/approve-kacab`, { method: 'PATCH' })
export const rejectOpnameApproval = (id, reason) => fetchWithAuth(`/opname/${id}/reject`, { method: 'PATCH', body: { reason } })
export const markOpnameBasoPrinted = (id) => fetchWithAuth(`/opname/${id}/baso-print`, { method: 'PATCH' })
export const uploadOpnameBaso = (id, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth(`/opname/${id}/baso-upload`, { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}
export const deleteOpnameSession = (id) => fetchWithAuth(`/opname/${id}`, { method: 'DELETE' })
