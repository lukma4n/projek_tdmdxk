import fetchWithAuth from './fetchWithAuth.js'

export const getWorkOrders = (params) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/workshop?${query}`)
}

export const getWorkshopSummary = () => fetchWithAuth('/workshop/summary')
export const getMechanics = () => fetchWithAuth('/workshop/mechanics')
export const getProgramSummary = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/workshop/program-summary${query ? '?' + query : ''}`)
}
export const getMechanicPerformance = (params) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/workshop/mechanics/performance?${query}`)
}
