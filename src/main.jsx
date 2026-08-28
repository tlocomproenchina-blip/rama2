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
  // Esperamos a que el render inicial se estabilice antes de dar por bueno el arranque.
  window.setTimeout(markBootSuccess, 10000)
} catch (error) {
  recoverFromStaleChunks('render inicial: ' + (error?.message || 'desconocido'))
}