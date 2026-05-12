import { create } from 'zustand'
import { logout as apiLogout } from '../services/api/auth.js'

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  login: (userData) => set({ user: userData, isAuthenticated: true }),
  logout: async () => {
    try {
      await apiLogout()
    } catch {
      // ignore network errors during logout
    }
    set({ user: null, isAuthenticated: false })
    window.location.href = '/login'
  },
  setUser: (user) => set({ user, isAuthenticated: !!user }),
}))
