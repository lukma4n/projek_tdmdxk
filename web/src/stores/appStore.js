import { create } from 'zustand'

export const useAppStore = create((set) => ({
  lastSync: null,
  alerts: {
    critical: [],
    attention: [],
  },
  setLastSync: (date) => set({ lastSync: date }),
  setAlerts: (alerts) => set({ alerts }),
}))
