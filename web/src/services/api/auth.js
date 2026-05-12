import fetchWithAuth from './fetchWithAuth.js'

export const login = (credentials) => fetchWithAuth('/auth/login', { method: 'POST', body: credentials })
export const logout = () => fetchWithAuth('/auth/logout', { method: 'POST' })
export const me = () => fetchWithAuth('/auth/me')
