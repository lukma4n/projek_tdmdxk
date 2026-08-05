import fetchWithAuth from './fetchWithAuth.js'

export const getCustomers = (params) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/customers?${query}`)
}

export const getCustomerSummary = () => fetchWithAuth('/customers/summary')
export const getCustomerAlerts = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/customers/alerts?${query}`)
}

export const getCustomerModels = () => fetchWithAuth('/customers/models')
export const getCustomerFollowups = (id) => fetchWithAuth(`/customers/${id}/followups`)
export const createCustomerFollowup = (id, data) => fetchWithAuth(`/customers/${id}/followups`, { method: 'POST', body: data })
// Kirim pengingat KPB via gateway WhatsApp; pesan disusun server.
export const sendCustomerFollowupWhatsapp = (id, data) => fetchWithAuth(`/customers/${id}/followups/whatsapp`, { method: 'POST', body: data })

export const uploadSales = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/sync/sales', { method: 'POST', body: formData, headers: {} })
}
