import React from 'react'
import ReactDOM from 'react-dom/client'
import { installStaleChunkGuard, recoverFromStaleChunks, markBootSuccess } from '@/lib/staleChunkGuard'
import App from '@/App.jsx'
import '@/index.css'

// Chequeo proactivo ANTES de renderizar: si React o ReactDOM vienen de chunks
// stale (dos copias), React.useState puede ser null o no funcionar. Detectamos
// esto antes de que la app explote y forzamos la recuperación inmediatamente.
function reactChunksAreStale() {
  try {
    if (!React || typeof React !== 'object') return true;
    if (typeof React.useState !== 'function') return true;
    if (typeof React.createElement !== 'function') return true;
    // Verificar que ReactDOM esté en la misma copia: si createRoot no existe,
    // es porque ReactDOM viene de otra optimización.
    if (!ReactDOM || typeof ReactDOM.createRoot !== 'function') return true;
    return false;
  } catch (_) {
    return true;
  }
}

// Debe instalarse ANTES del primer render: si un Service Worker de una visita
// anterior está controlando la página, se limpia y recarga antes de renderizar
// (evita dos copias de React por chunks de Vite cacheados). Si los chunks están
// mezclados, el guardián también detecta el error y recarga.
installStaleChunkGuard().then(() => {
  if (reactChunksAreStale()) {
    recoverFromStaleChunks('pre-render: React/ReactDOM inconsistentes');
    return; // No renderizar: la página se va a recargar
  }
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