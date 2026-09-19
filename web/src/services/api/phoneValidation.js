import fetchWithAuth from './fetchWithAuth.js'

export const getInvalidPhones = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')),
  ).toString()
  return fetchWithAuth(`/phone-validation${query ? `?${query}` : ''}`)
}
