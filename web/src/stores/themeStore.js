import { create } from 'zustand'

/**
 * Terapkan data attributes ke <html> agar CSS var aktif.
 * Dipanggil di init dan setiap kali state berubah.
 */
function applyTheme(theme, accent, density) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = theme
  root.dataset.accent = accent
  root.dataset.density = density
}

/**
 * Baca nilai dari localStorage dengan fallback.
 * lazy init — dipanggil di dalam store, bukan module scope.
 */
function load(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    return window.localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

function save(key, value) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // quota exceeded — abaikan
  }
}

export const useThemeStore = create((set, get) => {
  // Lazy init — baca dari localStorage saat store dibuat, bukan saat module di-import
  const initialTheme = load('dxk-theme', 'light')
  const initialAccent = load('dxk-accent', 'biru')
  const initialDensity = load('dxk-density', 'default')

  // Terapkan ke root segera
  applyTheme(initialTheme, initialAccent, initialDensity)

  return {
    theme: initialTheme,
    accent: initialAccent,
    density: initialDensity,

    setTheme: (theme) => {
      set({ theme })
      save('dxk-theme', theme)
      applyTheme(theme, get().accent, get().density)
    },

    toggleTheme: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark'
      set({ theme: next })
      save('dxk-theme', next)
      applyTheme(next, get().accent, get().density)
    },

    setAccent: (accent) => {
      set({ accent })
      save('dxk-accent', accent)
      applyTheme(get().theme, accent, get().density)
    },

    setDensity: (density) => {
      set({ density })
      save('dxk-density', density)
      applyTheme(get().theme, get().accent, density)
    },
  }
})
