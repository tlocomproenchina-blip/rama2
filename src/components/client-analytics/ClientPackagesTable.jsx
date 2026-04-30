import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_TABS = [
  { key: 'all', label: 'Todos' },
  { key: 'pre_alerta', label: 'Pre-alerta' },
  { key: 'recibido', label: 'Recibidos' },
  { key: 'en_consolidacion', label: 'En consolidación' },
  { key: 'en_transito', label: 'En tránsito' },
  { key: 'entregado', label: 'Entregados' },
];

const fmt = (d) => (d ? format(new Date(d), 'dd/MM/yyyy HH:mm') : '—');

export default function ClientPackagesTable({ packages }) {
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    let list = packages || [];
    if (tab !== 'all') list = list.filter((p) => p.status === tab);
    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter((p) =>
        [p.tracking_number, p.description, p.shipping_type, p.status].filter(Boolean).join(' ').toLowerCase().includes(s)
      );
    }
    return list;
  }, [packages, tab, q]);

  const counts = useMemo(() => {
    const map = { all: packages?.length || 0 };
    (packages || []).forEach((p) => { map[p.status] = (map[p.status] || 0) + 1; });
    return map;
  }, [packages]);

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-slate-700" />
            <h3 className="text-lg font-bold text-slate-800">Historial de paquetes</h3>
            <Badge variant="secondary">{packages?.length || 0}</Badge>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tracking o descripción..." className="pl-10" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((t) => (
            <Button
              key={t.key}
              variant={tab === t.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(t.key)}
              className="gap-2"
            >
              {t.label}
              <Badge variant={tab === t.key ? 'secondary' : 'outline'} className="ml-1">{counts[t.key] || 0}</Badge>
            </Button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b">
                <th className="py-2 pr-3">Tracking</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Bultos</th>
                <th className="py-2 pr-3">CBM</th>
                <th className="py-2 pr-3">Peso (kg)</th>
                <th className="py-2 pr-3">Registrado</th>
                <th className="py-2 pr-3">Recibido</th>
                <th className="py-2 pr-3">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-500">Sin paquetes</td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className="border-b last:border-b-0 hover:bg-slate-50">
                  <td className="py-2 pr-3 font-mono text-xs">{p.tracking_number}</td>
                  <td className="py-2 pr-3 capitalize">{p.shipping_type || '—'}</td>
                  <td className="py-2 pr-3"><Badge variant="outline" className="text-xs">{p.status || '—'}</Badge></td>
                  <td className="py-2 pr-3">{p.package_count || 1}</td>
                  <td className="py-2 pr-3">{Number(p.cbm || 0).toFixed(5)}</td>
                  <td className="py-2 pr-3">{Number(p.weight_kg || 0).toFixed(2)}</td>
                  <td className="py-2 pr-3 text-xs text-slate-600">{fmt(p.created_date)}</td>
                  <td className="py-2 pr-3 text-xs text-slate-600">{fmt(p.received_date)}</td>
                  <td className="py-2 pr-3 max-w-[260px] truncate" title={p.description}>{p.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}