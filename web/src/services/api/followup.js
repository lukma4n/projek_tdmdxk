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

// `kebutuhan` dipakai saat STNK+BPKB satu unit dikirim dalam satu pesan.
export const sendFollowupWhatsapp = (kind, key, body = {}) =>
  fetchWithAuth(`/followup/send/${kind}/${encodeURIComponent(key)}`, { method: 'POST', body })

export const scheduleFollowup = (kind, key, body) =>
  fetchWithAuth(`/followup/schedule/${kind}/${encodeURIComponent(key)}`, { method: 'POST', body })
