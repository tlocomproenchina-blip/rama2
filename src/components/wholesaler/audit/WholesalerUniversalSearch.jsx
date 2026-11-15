import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2, Package, Search, User } from 'lucide-react';
import { EVENT_LABELS, regexFor, scopeFor, toRows } from '@/lib/wholesalerScope';

const STATES = [
  { key: 'all', label: 'Todos' },
  { key: 'recepcion', label: 'Recibidos' },
  { key: 'aviso_enviado', label: 'Avisados al mayorista' },
  { key: 'prealerta_reportada', label: 'En tránsito' },
];
const PAGE = 25;

// Buscador universal: clientes y trackings del mayorista elegido (o de todos)
// en una sola búsqueda, cada resultado con su fuente.
export default function WholesalerUniversalSearch({ source, onSelectClient, onSelectTracking }) {
  const [q, setQ] = useState('');
  const [state, setState] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const [data, setData] = useState({ clients: [], logs: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setLimit(PAGE); }, [q, state, source]);
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true); setError('');
      const scope = scopeFor(source);
      const rx = regexFor(q);
      const clientFilter = rx ? { $and: [scope, { $or: [{ full_name: rx }, { email: rx }, { shipping_mark: rx }, { cedula: rx }, { external_id: rx }] }] } : scope;
      const logParts = [scope, state === 'all' ? { tracking_number: { $exists: true, $ne: '' } } : { event_type: state }];
      if (rx) logParts.push({ $or: [{ tracking_number: rx }, { client_email: rx }, { shipping_mark: rx }] });
      const [c, l] = await Promise.allSettled([
        state === 'all' ? base44.entities.WholesalerClient.filter(clientFilter, '-created_date', limit) : Promise.resolve([]),
        base44.entities.WholesalerLog.filter({ $and: logParts }, '-event_date', limit),
      ]);
      if (c.status === 'rejected' || l.status === 'rejected') setError('Parte de la búsqueda no respondió; se muestran resultados parciales.');
      setData({ clients: c.status === 'fulfilled' ? toRows(c.value) : [], logs: l.status === 'fulfilled' ? toRows(l.value) : [] });
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q, state, source, limit]);

  const more = data.clients.length >= limit || data.logs.length >= limit;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} className="h-12 text-base" placeholder="Buscar cliente, email, cédula, ID, Shipping Mark o tracking…" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {STATES.map((s) => <Button key={s.key} size="sm" variant={state === s.key ? 'default' : 'outline'} onClick={() => setState(s.key)}>{s.label}</Button>)}
        {q.trim() && <Button size="sm" variant="ghost" onClick={() => onSelectTracking(q.trim())}>Consultar estado de «{q.trim()}»</Button>}
      </div>
      {error && <p className="flex items-center gap-2 rounded-xl bg-warning-bg p-3 text-sm text-warning"><AlertTriangle className="h-4 w-4" />{error}</p>}
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
        <div className="space-y-4">
          {state === 'all' && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Clientes ({data.clients.length}{data.clients.length >= limit ? '+' : ''})</p>
              <div className="divide-y rounded-xl border">
                {!data.clients.length && <p className="p-4 text-sm text-muted-foreground">Sin clientes que coincidan.</p>}
                {data.clients.map((r) => (
                  <button key={r.id} onClick={() => onSelectClient(r)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent">
                    <User className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1"><p className="truncate font-semibold">{r.full_name || r.email}</p><p className="truncate text-xs text-muted-foreground">{r.email} · {r.shipping_mark || 'sin mark'}{r.cedula ? ` · ${r.cedula}` : ''}</p></div>
                    <Badge variant="outline">{r.wholesaler_name || 'Principal'}</Badge>
                  </button>
                ))}
              </div>
            </section>
          )}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Trackings ({data.logs.length}{data.logs.length >= limit ? '+' : ''})</p>
            <div className="divide-y rounded-xl border">
              {!data.logs.length && <p className="p-4 text-sm text-muted-foreground">Sin trackings registrados localmente que coincidan.</p>}
              {data.logs.map((r) => (
                <button key={r.id} onClick={() => onSelectTracking(r.tracking_number)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent">
                  <Package className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1"><p className="font-mono font-semibold">{r.tracking_number}</p><p className="truncate text-xs text-muted-foreground">{r.client_email || r.shipping_mark || 'sin cliente'} · {EVENT_LABELS[r.event_type] || r.event_type}{r.event_date ? ` · ${new Date(r.event_date).toLocaleDateString('es-VE')}` : ''}</p></div>
                  <Badge variant="outline">{r.wholesaler_name || 'Principal'}</Badge>
                </button>
              ))}
            </div>
          </section>
          {more && <Button variant="outline" onClick={() => setLimit(limit + PAGE)}>Cargar más</Button>}
        </div>
      )}
    </div>
  );
}