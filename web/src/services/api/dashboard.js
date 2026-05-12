import fetchWithAuth from './fetchWithAuth.js'

export const getDashboard = () => fetchWithAuth('/dashboard/summary')
export const getApprovalNotifications = () => fetchWithAuth('/notifications/approvals')
export const getOpnameNotifications = () => fetchWithAuth('/notifications/opname')
