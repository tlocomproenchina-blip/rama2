import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Cuando se publica una versión nueva, un navegador que tenía la anterior puede pedir
// un módulo que ya no existe y la pantalla queda en blanco. Se recarga una sola vez
// para tomar los archivos vigentes.
window.addEventListener('vite:preloadError', () => {
  try {
    const key = 'chunk_reload_at'
    const last = Number(sessionStorage.getItem(key) || 0)
    if (Date.now() - last < 20000) return
    sessionStorage.setItem(key, String(Date.now()))
  } catch (_) {}
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)