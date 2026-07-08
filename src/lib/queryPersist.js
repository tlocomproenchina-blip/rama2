// Persistencia ligera del caché de datos en localStorage.
// Al abrir la app (incluso sin conexión) se restauran los últimos datos cargados,
// y cuando hay conexión se refrescan automáticamente en segundo plano.
const STORAGE_KEY = 'tlec-query-cache-v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas
const MAX_ENTRIES = 80;
const MAX_ENTRY_SIZE = 200 * 1024; // no guardar respuestas gigantes (~200KB c/u)

export function setupQueryPersistence(queryClient) {
  if (typeof window === 'undefined') return;

  // 1) Restaurar datos guardados
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const now = Date.now();
      (saved || []).forEach((entry) => {
        if (!entry?.queryKey || entry.data === undefined) return;
        if (now - (entry.dataUpdatedAt || 0) > MAX_AGE_MS) return;
        queryClient.setQueryData(entry.queryKey, entry.data, { updatedAt: entry.dataUpdatedAt });
      });
    }
  } catch (_) {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  // 2) Guardar cambios (con debounce para no escribir en cada render)
  let saveTimer = null;
  const persist = () => {
    try {
      const queries = queryClient.getQueryCache().getAll()
        .filter((q) => q.state.status === 'success' && q.state.data !== undefined)
        .sort((a, b) => (b.state.dataUpdatedAt || 0) - (a.state.dataUpdatedAt || 0))
        .slice(0, MAX_ENTRIES);

      const entries = [];
      for (const q of queries) {
        try {
          const json = JSON.stringify(q.state.data);
          if (json.length > MAX_ENTRY_SIZE) continue;
          entries.push({
            queryKey: q.queryKey,
            data: q.state.data,
            dataUpdatedAt: q.state.dataUpdatedAt
          });
        } catch (_) {}
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (_) {
      // Cuota llena: limpiar y seguir sin persistencia
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    }
  };

  queryClient.getQueryCache().subscribe(() => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 1500);
  });

  // Guardar también al salir/minimizar la app
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persist();
  });
}