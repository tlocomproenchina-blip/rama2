import React from 'react'
import ReactDOM from 'react-dom/client'
import { installStaleChunkGuard, recoverFromStaleChunks, markBootSuccess } from '@/lib/staleChunkGuard'
import App from '@/App.jsx'
import '@/index.css'

// Debe instalarse ANTES del primer render: si un Service Worker de una visita
// anterior está controlando la página, se limpia y recarga antes de renderizar
// (evita dos copias de React por chunks de Vite cacheados). Si los chunks están
// mezclados, el guardián también detecta el error y recarga.
installStaleChunkGuard().then(() => {
  try {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <App />
    )
    // Esperamos a que el render inicial se estabilice antes de dar por bueno el arranque.
    window.setTimeout(markBootSuccess, 10000)
  } catch (error) {
    recoverFromStaleChunks('render inicial: ' + (error?.message || 'desconocido'))
  }
})