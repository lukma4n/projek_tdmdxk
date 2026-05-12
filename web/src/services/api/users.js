import fetchWithAuth from './fetchWithAuth.js'

export const getUsers = () => fetchWithAuth('/users')
export const getUser = (id) => fetchWithAuth(`/users/${id}`)
export const createUser = (data) => fetchWithAuth('/users', { method: 'POST', body: data })
export const updateUser = (id, data) => fetchWithAuth(`/users/${id}`, { method: 'PATCH', body: data })
export const deleteUser = (id) => fetchWithAuth(`/users/${id}`, { method: 'DELETE' })
export const resetPassword = (id, password) => fetchWithAuth(`/users/${id}/reset-password`, { method: 'PATCH', body: { password } })
