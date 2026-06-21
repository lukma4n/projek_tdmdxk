import { create } from 'zustand'

export const useThemeStore = create((set) => ({
  theme: typeof window !== 'undefined' ? (localStorage.getItem('theme') || 'light') : 'light',
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark'
    if (typeof window !== 'undefined') localStorage.setItem('theme', nextTheme)
    return { theme: nextTheme }
  }),
}))
