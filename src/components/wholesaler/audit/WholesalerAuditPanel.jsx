import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Search } from 'lucide-react';
import WholesalerSourceList from './WholesalerSourceList';
import WholesalerAuditDetail from './WholesalerAuditDetail';

const STATES = [
  { key: 'all', label: 'Todos' },
  { key: 'recepcion', label: 'Recibidos' },
  { key: 'aviso_enviado', label: 'Enviados al mayorista' },
  { key: 'prealerta_reportada', label: 'En tránsito (pre-alerta)' },
];
const PAGE = 50;
const toArr = (r) => (Array.isArray(r) ? r : r?.items || []);

export default function WholesalerAuditPanel() {
  const [connections, setConnections] = useState([]);
  const [source, setSource] = useState('todos');
  const [mode, setMode] = useState('clientes');
  const [q, setQ] = useState('');
  const [state, setState] = useState('all');
  const [rows, setRows] = useState([]);
  const [limit, setLimit] = useState(PAGE);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { base44.entities.WholesalerSync.list('created_date', 50).then((r) => setConnections(toArr(r))); }, []);

  const scope = source === 'todos' ? {} : (connections[0]?.config_key === source || source === 'main')
    ? { $or: [{ wholesaler_key: source }, { wholesaler_key: { $exists: false } }, { wholesaler_key: '' }] }
    : { wholesaler_key: source };

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const term = q.trim();
      const rx = term ? { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } : null;
      if (mode === 'clientes') {
        const filter = rx ? { $and: [scope, { $or: [{ full_name: rx }, { email: rx }, { shipping_mark: rx }, { cedula: rx }, { external_id: rx }] }] } : scope;
        setRows(toArr(await base44.entities.WholesalerClient.filter(filter, '-fetched_date', limit)));
      } else {
        const parts = [scope];
        if (rx) parts.push({ tracking_number: rx });
        parts.push(state === 'all' ? { tracking_number: { $exists: true, $ne: '' } } : { event_type: state });
        setRows(toArr(await base44.entities.WholesalerLog.filter({ $and: parts }, '-event_date', limit)));
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q, mode, state, source, limit, connections.length]);

  const openClient = async (c) => {
    setDetailLoading(true);
    const logs = toArr(await base44.entities.WholesalerLog.filter({ client_email: c.email, tracking_number: { $exists: true, $ne: '' } }, '-event_date', 100));
    setSelected({ type: 'client', data: c, trackings: logs });
    setDetailLoading(false);
  };

  const openTracking = async (tracking) => {
    setDetailLoading(true);
    const conn = connections.find((c) => (c.config_key || 'main') === source);
    const res = await base44.functions.invoke('wholesalerShipments', { action: 'status', search: tracking, connection_id: conn?.id }).catch((e) => ({ data: { mensaje: e?.response?.data?.mensaje || 'No se pudo consultar el tracking.' } }));
    setSelected({ type: 'tracking', data: { tracking_number: tracking, ...(res?.data || {}) } });
    setDetailLoading(false);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr_360px]">
      <WholesalerSourceList connections={connections} value={source} onChange={(k) => { setSource(k); setLimit(PAGE); setSelected(null); }} />
      <div className="rounded-2xl border bg-card p-5 shadow-card space-y-3 min-w-0">
        <Tabs value={mode} onValueChange={(v) => { setMode(v); setLimit(PAGE); }}>
          <TabsList><TabsTrigger value="clientes">Clientes</TabsTrigger><TabsTrigger value="trackings">Trackings</TabsTrigger></TabsList>
        </Tabs>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={mode === 'clientes' ? 'Nombre, email, cédula, ID o Shipping Mark…' : 'Número de tracking…'} />
          </div>
          {mode === 'trackings' && q.trim() && <Button onClick={() => openTracking(q.trim())}>Consultar estado</Button>}
        </div>
        {mode === 'trackings' && (
          <div className="flex flex-wrap gap-2">
            {STATES.map((s) => <Button key={s.key} size="sm" variant={state === s.key ? 'default' : 'outline'} onClick={() => setState(s.key)}>{s.label}</Button>)}
          </div>
        )}
        {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
          <div className="divide-y rounded-xl border">
            {!rows.length && <p className="p-4 text-sm text-muted-foreground">Sin resultados en esta fuente.</p>}
            {rows.map((r) => mode === 'clientes' ? (
              <button key={r.id} onClick={() => openClient(r)} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-accent">
                <div className="min-w-0"><p className="truncate font-semibold">{r.full_name || r.email}</p><p className="truncate text-xs text-muted-foreground">{r.email} · {r.shipping_mark || 'sin mark'}</p></div>
                <Badge variant="outline">{r.wholesaler_name || 'Principal'}</Badge>
              </button>
            ) : (
              <button key={r.id} onClick={() => openTracking(r.tracking_number)} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-accent">
                <div className="min-w-0"><p className="font-mono font-semibold">{r.tracking_number}</p><p className="truncate text-xs text-muted-foreground">{r.client_email || r.shipping_mark || 'sin cliente'} · {r.event_type}</p></div>
                <Badge variant="outline">{r.wholesaler_name || 'Principal'}</Badge>
              </button>
            ))}
          </div>
        )}
        {rows.length >= limit && <Button variant="outline" onClick={() => setLimit(limit + PAGE)}>Cargar más</Button>}
      </div>
      <WholesalerAuditDetail selected={selected} loading={detailLoading} />
    </div>
  );
}