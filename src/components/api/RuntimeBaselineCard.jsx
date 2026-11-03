import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Loader2, RefreshCw } from 'lucide-react';

const RANGES = [1, 7, 30];
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('es-VE');

// Línea base de estabilidad (Etapa 0): llamadas, rechazos por exceso de
// solicitudes, reintentos, tiempos y errores por pantalla.
export default function RuntimeBaselineCard() {
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const res = await base44.entities.RuntimeMetrics.aggregate({
      query: { created_date: { $gte: since }, total_calls: { $gt: 0 } },
      groupBy: 'page_name',
      sum: ['total_calls', 'rate_limit_hits', 'retries', 'timeouts', 'error_count'],
      avg: ['latency_ms_avg', 'latency_ms_p95'],
    });
    const list = (res?.rows || []).sort((a, b) => (b.sum_total_calls || 0) - (a.sum_total_calls || 0));
    setRows(list.slice(0, 15));
    setLoading(false);
  };

  useEffect(() => { load(); }, [days]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" /> Estabilidad del servidor por pantalla
        </CardTitle>
        <div className="flex items-center gap-1">
          {RANGES.map((d) => (
            <Button key={d} size="sm" variant={d === days ? 'default' : 'outline'} onClick={() => setDays(d)}>{d === 1 ? '24 h' : `${d} días`}</Button>
          ))}
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay mediciones. Se registran cada 5 minutos mientras los administradores usan la app.</p>
        ) : (
          <RuntimeBaselineTable rows={rows} />
        )}
      </CardContent>
    </Card>
  );
}

function RuntimeBaselineTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="text-left">
            <th className="py-2 pr-3">Pantalla</th><th className="pr-3">Llamadas</th><th className="pr-3">Rechazos 429</th>
            <th className="pr-3">Reintentos</th><th className="pr-3">Tiempo agotado</th><th className="pr-3">Errores</th>
            <th className="pr-3">Prom. ms</th><th>5% más lento ms</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.page_name} className="border-t border-border">
              <td className="py-2 pr-3 font-mono text-xs">{r.page_name || '—'}</td>
              <td className="pr-3">{fmt(r.sum_total_calls)}</td>
              <td className={`pr-3 ${r.sum_rate_limit_hits ? 'text-destructive font-semibold' : ''}`}>{fmt(r.sum_rate_limit_hits)}</td>
              <td className="pr-3">{fmt(r.sum_retries)}</td>
              <td className="pr-3">{fmt(r.sum_timeouts)}</td>
              <td className={`pr-3 ${r.sum_error_count ? 'text-destructive' : ''}`}>{fmt(r.sum_error_count)}</td>
              <td className="pr-3">{fmt(r.avg_latency_ms_avg)}</td>
              <td>{fmt(r.avg_latency_ms_p95)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}