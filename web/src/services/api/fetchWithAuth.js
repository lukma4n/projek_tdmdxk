export const API_BASE = import.meta.env.VITE_API_URL || '/api'

async function fetchWithAuth(endpoint, options = {}) {
  const config = {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  }

  if (options.body && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body)
  }

  const timeout = options.timeout || 30000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  config.signal = controller.signal

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config)
    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 401) {
        // Deteksi sesi ditendang (login di perangkat lain / di-reset) untuk pesan jelas
        try {
          const body = await response.clone().json()
          if (body?.error === 'SESSION_SUPERSEDED') {
            sessionStorage.setItem('logoutReason', 'superseded')
          }
        } catch { /* abaikan */ }
        // Only redirect if not already on /login to avoid infinite reload loop
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
        return Promise.reject(new Error('Unauthorized'))
      }

      const error = await response.json().catch(() => ({ error: 'Network error' }))
      let message = error.error || `HTTP ${response.status}`
      // Error 5xx sengaja disamarkan backend, jadi tempelkan requestId supaya
      // kejadiannya bisa dilacak ke baris log server (lihat errorHandler.js).
      if (response.status >= 500 && error.requestId) {
        message += ` (ref: ${String(error.requestId).slice(0, 8)})`
      }
      throw new Error(message)
    }

    if (config.responseType === 'blob') {
      return response.blob()
    }

    return response.json()
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new Error('Request timeout - server terlalu lama merespon', { cause: err })
    }
    throw err
  }
}

export default fetchWithAuth
