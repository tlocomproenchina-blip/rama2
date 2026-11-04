import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Camera } from 'lucide-react';
import ReviewPhotoRow from './ReviewPhotoRow';

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'recibida', label: 'Sin incidencia' },
  { value: 'recibida_con_incidencia', label: 'Con incidencia' },
  { value: 'sin_revisar', label: 'Sin revisar' },
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Historial de revisiones de inventario con su foto: busca por cliente, bulto o tracking.
export default function ReviewPhotoHistory({ refreshKey }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      const q = search.trim();
      const rx = q ? { $regex: esc(q), $options: 'i' } : null;
      let out = [];
      if (status !== 'sin_revisar') {
        const query = rx ? { $or: ['client_name', 'client_email', 'label_code', 'tracking_number'].map((f) => ({ [f]: rx })) } : {};
        if (status !== 'all') query.result = status;
        const page = await base44.entities.CajaInventoryReview.filter(query, { sort: '-reviewed_date', limit: 100 });
        out = (page?.items || []).map((r) => ({ key: r.id, review: r }));
      }
      if (status === 'all' || status === 'sin_revisar') {
        const bq = rx ? { $or: ['shipping_mark', 'client_email', 'label_code', 'client_snapshot.full_name', 'package_trackings'].map((f) => ({ [f]: rx })) } : {};
        const bPage = await base44.entities.Bulto.filter(bq, { sort: '-created_date', limit: 50 });
        const bultos = bPage?.items || [];
        if (bultos.length) {
          const revPage = await base44.entities.CajaInventoryReview.filter({ bulto_id: { $in: bultos.map((b) => b.id) } }, { limit: 500 });
          const reviewed = new Set((revPage?.items || []).map((r) => r.bulto_id));
          out = out.concat(bultos.filter((b) => !reviewed.has(b.id)).map((b) => ({ key: `b-${b.id}`, bulto: b })));
        }
      }
      if (alive) { setRows(out); setLoading(false); }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [search, status, refreshKey]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground"><Camera className="h-4 w-4" /> Fotos de revisiones</h2>
        <span className="text-xs text-muted-foreground">{rows.length} resultado(s)</span>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente, bulto/caja o tracking…" className="pl-10" />
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" onClick={() => setStatus(f.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${status === f.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-accent'}`}>
            {f.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No hay resultados.</p>
      ) : (
        <div className="space-y-2">{rows.map((r) => <ReviewPhotoRow key={r.key} review={r.review} bulto={r.bulto} />)}</div>
      )}
    </div>
  );
}