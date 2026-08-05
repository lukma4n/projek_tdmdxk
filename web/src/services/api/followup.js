import fetchWithAuth from './fetchWithAuth.js'

// Pusat follow-up terpadu: KPB + STNK + BPKB dalam satu antrean berurut prioritas.
export const getFollowupQueue = (params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null),
  ).toString()
  return fetchWithAuth(`/followup/queue${query ? `?${query}` : ''}`)
}

export const getFollowupAreas = () => fetchWithAuth('/followup/areas')

export const getFollowupHistory = (kind, key) =>
  fetchWithAuth(`/followup/history/${kind}/${encodeURIComponent(key)}`)

// Bukan pengiriman: pesan dikirim staf sendiri lewat WhatsApp Web setelah draf
// dibuka. Endpoint ini mencatat kontaknya dan memotong jatah harian.
// `kebutuhan` dipakai saat STNK+BPKB satu unit dikirim dalam satu pesan.
export const recordFollowupContact = (kind, key, body = {}) =>
  fetchWithAuth(`/followup/contact/${kind}/${encodeURIComponent(key)}`, { method: 'POST', body })

export const scheduleFollowup = (kind, key, body) =>
  fetchWithAuth(`/followup/schedule/${kind}/${encodeURIComponent(key)}`, { method: 'POST', body })
