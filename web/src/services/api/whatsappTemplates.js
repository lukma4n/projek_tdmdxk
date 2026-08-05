import fetchWithAuth from './fetchWithAuth.js'

// Template pesan WhatsApp yang bisa diubah dari UI.
export const getWhatsappTemplates = () => fetchWithAuth('/whatsapp-templates')

export const updateWhatsappTemplate = (key, content) =>
  fetchWithAuth(`/whatsapp-templates/${key}`, { method: 'PUT', body: { content } })

export const resetWhatsappTemplate = (key) =>
  fetchWithAuth(`/whatsapp-templates/${key}/reset`, { method: 'POST', body: {} })

export const getWhatsappTemplateHistory = (key) =>
  fetchWithAuth(`/whatsapp-templates/${key}/history`)

// Validasi + render contoh tanpa menyimpan — aturan validasinya tinggal di
// server supaya tidak terduplikasi (dan tidak bisa berbeda) di frontend.
export const previewWhatsappTemplate = (key, content) =>
  fetchWithAuth(`/whatsapp-templates/${key}/preview`, { method: 'POST', body: { content } })
