import fetchWithAuth from './fetchWithAuth.js'

export const getHotlines = (params) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/hotline?${query}`)
}

export const getHotline = (id) => fetchWithAuth(`/hotline/${id}`)
export const updateHotlineState = (id, state) => fetchWithAuth(`/hotline/${id}/state`, { method: 'PATCH', body: { state } })
