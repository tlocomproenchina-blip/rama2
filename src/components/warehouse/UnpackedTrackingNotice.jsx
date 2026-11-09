import React, { useEffect, useState } from 'react';
import { Loader2, PackageSearch } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const fmt = (v) => (v ? new Date(v).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '');

// Cuando la búsqueda del historial no encuentra bultos, explica si el tracking existe
// como paquete pero todavía no está empacado (por ejemplo, revisado pero sin empacar).
export default function UnpackedTrackingNotice({ query }) {
  const [state, setState] = useState({ loading: false, pkgs: [], reviews: {} });
  const term = String(query || '').trim();

  useEffect(() => {
    if (term.length < 6) { setState({ loading: false, pkgs: [], reviews: {} }); return undefined; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      const pkgs = await base44.entities.Package.filter({ tracking_number: term }, '-created_date', 5);
      const reviews = {};
      if (pkgs.length) {
        const rows = await base44.entities.CajaInventoryReview.filter({ tracking_number: term }, '-reviewed_date', 1);
        if (rows[0]) reviews[term] = rows[0];
      }
      if (!cancelled) setState({ loading: false, pkgs, reviews });
    })().catch(() => !cancelled && setState({ loading: false, pkgs: [], reviews: {} }));
    return () => { cancelled = true; };
  }, [term]);

  if (state.loading) return <p className="mt-3 flex items-center justify-center gap-2 text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando el paquete…</p>;
  if (!state.pkgs.length) return null;
  const review = state.reviews[term];

  return (
    <div className="mx-auto mt-4 max-w-md space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900">
      <p className="flex items-center gap-1.5 font-semibold"><PackageSearch className="h-4 w-4" /> El paquete existe, pero no está en ningún bulto ni caja</p>
      {state.pkgs.map((p) => (
        <p key={p.id} className="break-all">
          <span className="font-mono">{p.tracking_number}</span> · {p.client_email || 'sin cliente'} · estado: {p.status}
        </p>
      ))}
      {review && (
        <p>Revisado el {fmt(review.reviewed_date)} por {review.reviewed_by_name || review.reviewed_by || '—'}, pero no se terminó de empacar. Escanéalo de nuevo en Empacar y usa “Empacar con la revisión existente”.</p>
      )}
    </div>
  );
}