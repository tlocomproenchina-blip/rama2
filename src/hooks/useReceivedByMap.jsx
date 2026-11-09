import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const CHUNK = 100;

// Para los bultos visibles del historial, trae de cada paquete quién lo registró al
// recibirlo en almacén (Package.received_by). Devuelve { [packageId]: email | null }.
export function useReceivedByMap(entries) {
  const [map, setMap] = useState({});

  useEffect(() => {
    const ids = new Set();
    (entries || []).forEach((entry) => (entry.bultos || []).forEach((b) => (
      (b.package_ids || []).forEach((id) => { if (id && !String(id).startsWith('local_')) ids.add(id); })
    )));
    const missing = [...ids].filter((id) => !(id in map));
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      const next = {};
      for (let i = 0; i < missing.length; i += CHUNK) {
        const slice = missing.slice(i, i + CHUNK);
        const rows = await base44.entities.Package.filter({ id: { $in: slice } }, '-received_date', slice.length);
        slice.forEach((id) => { next[id] = null; });
        rows.forEach((p) => { next[p.id] = p.received_by || null; });
      }
      if (!cancelled) setMap((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
  }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps

  return map;
}