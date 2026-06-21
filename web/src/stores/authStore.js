import { create } from 'zustand'
import { logout as apiLogout } from '../services/api/auth.js'

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  permissions: {},
  permissionsLoaded: false,
  permissionsError: null,
  login: (userData) => set({ user: userData, isAuthenticated: true }),
  logout: async () => {
    try {
      await apiLogout()
    } catch {
      // ignore
    }
    set({ user: null, isAuthenticated: false, permissions: {}, permissionsLoaded: false, permissionsError: null })
    window.location.href = '/login'
  },
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setPermissions: (permissions) => set({ permissions, permissionsLoaded: true, permissionsError: null }),
  fetchPermissions: async () => {
    // Hindari fetch ulang jika sudah berhasil dimuat
    if (get().permissionsLoaded && !get().permissionsError) return
    try {
      const res = await fetch('/api/permissions', { credentials: 'include' })
      if (res.status === 401) {
        // Session expired — logout
        get().logout()
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      set({ permissions: data, permissionsLoaded: true, permissionsError: null })
    } catch (err) {
      // Catat error, tapi JANGAN set permissionsLoaded=true agar App tetap
      // menampilkan loading dan bisa retry, bukan memberi akses kosong.
      console.error('[authStore] fetchPermissions failed:', err.message)
      set({ permissionsError: err.message })
    }
  },
  retryPermissions: () => {
    set({ permissionsLoaded: false, permissionsError: null })
  },
}))
