import React from 'react'
import ReactDOM from 'react-dom/client'
import { installStaleChunkGuard, recoverFromStaleChunks, markBootSuccess } from '@/lib/staleChunkGuard'
import App from '@/App.jsx'
import '@/index.css'

// Debe instalarse ANTES del primer render: si los chunks están mezclados
// (dos copias de React), el guardián limpia caches/SW y recarga automáticamente.
installStaleChunkGuard()

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
  )
  // Si el render inicial no lanzó, el arranque fue correcto.
  markBootSuccess()
} catch (error) {
  recoverFromStaleChunks('render inicial: ' + (error?.message || 'desconocido'))
}