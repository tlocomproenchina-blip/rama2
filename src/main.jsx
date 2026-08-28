import { installStaleChunkGuard, recoverFromStaleChunks, markBootSuccess } from '@/lib/staleChunkGuard'

installStaleChunkGuard()

async function prepareRuntime() {
  if (!import.meta.env.DEV || !('serviceWorker' in navigator)) return true

  const registrations = await navigator.serviceWorker.getRegistrations().catch(() => [])
  await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)))

  if ('caches' in window) {
    const keys = await caches.keys().catch(() => [])
    await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)))
  }

  if (navigator.serviceWorker.controller && !sessionStorage.getItem('tlec-dev-worker-cleared')) {
    sessionStorage.setItem('tlec-dev-worker-cleared', '1')
    window.location.reload()
    return false
  }

  return true
}

async function boot() {
  if (!(await prepareRuntime())) return

  try {
    const [{ default: React }, { default: ReactDOM }, { default: App }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('@/App.jsx'),
      import('@/index.css')
    ])

    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App))
    window.setTimeout(markBootSuccess, 10000)
  } catch (error) {
    await recoverFromStaleChunks('arranque: ' + (error?.message || 'desconocido'))
  }
}

boot()