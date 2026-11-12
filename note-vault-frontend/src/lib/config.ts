const isLocalhost =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname)

// Replace YOUR-BACKEND or set VITE_API_BASE_URL on Vercel; no trailing slash.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (isLocalhost
    ? 'http://localhost:5000/api'
    : 'https://YOUR-BACKEND.vercel.app/api')
