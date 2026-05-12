import { create } from 'zustand'

const savedTheme = localStorage.getItem('theme') || 'light'

export const useThemeStore = create((set) => ({
  theme: savedTheme,
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', nextTheme)
    return { theme: nextTheme }
  }),
}))
