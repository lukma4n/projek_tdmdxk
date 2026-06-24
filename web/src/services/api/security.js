import fetchWithAuth from './fetchWithAuth.js'

export const getLoginLogs = (params = {}) => {
  const qs = new URLSearchParams()
  if (params.event) qs.set('event', params.event)
  if (params.username) qs.set('username', params.username)
  if (params.limit) qs.set('limit', params.limit)
  const suffix = qs.toString() ? `?${qs}` : ''
  return fetchWithAuth(`/security/login-logs${suffix}`)
}

export const getActiveSessions = () => fetchWithAuth('/security/active-sessions')

export const resetUserSession = (id) =>
  fetchWithAuth(`/security/users/${id}/reset-session`, { method: 'POST' })
