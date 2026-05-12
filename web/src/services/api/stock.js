import fetchWithAuth from './fetchWithAuth.js'

export const getStock = (params) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/stock?${query}`)
}

export const getStockByCode = (code) => fetchWithAuth(`/stock/${code}`)
export const getCategories = () => fetchWithAuth('/stock/categories')
export const getStockLocations = () => fetchWithAuth('/stock/locations')
export const getStockByLocation = (location, params = {}) => {
  const query = new URLSearchParams({ ...params, page: params.page || 1, limit: params.limit || 50 }).toString()
  return fetchWithAuth(`/stock/by-location/${encodeURIComponent(location)}?${query}`)
}

