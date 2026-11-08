import { useCallback, useState } from 'react';

// Pestaña activa guardada en la dirección (?tab=...): al recargar o compartir el enlace se
// vuelve a la misma tarea.
export default function useTaskTab(keys, fallback = keys[0]) {
  const [tab, setTab] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tab');
    return keys.includes(fromUrl) ? fromUrl : fallback;
  });

  const change = useCallback((next) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState(window.history.state, '', url);
  }, []);

  return [tab, change];
}