import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { base44 } from '@/components/api/ApiQueueManager';
import { Search, Hash } from 'lucide-react';

const providerLabels = {
  alibaba: 'Alibaba',
  wechat: 'WeChat',
  alipay: 'Alipay',
  otro: 'Otro'
};

const statusLabels = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  pagado: 'Pagado',
  rechazado: 'Rechazado'
};

export default function AssistedPaymentHistory({ user }) {
  const [items, setItems] = React.useState([]);
  const [query, setQuery] = React.useState('');

  const load = async () => {
    const reqs = await base44.entities.AssistedPaymentRequest.filter({ client_email: user.email }, '-created_date', 50).catch(() => []);
    setItems(reqs || []);
  };
  React.useEffect(() => { if (user?.email) load(); }, [user?.email]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) =>
      (r.request_number || '').toLowerCase().includes(q) ||
      (r.provider || '').toLowerCase().includes(q) ||
      (r.link_url || '').toLowerCase().includes(q) ||
      (r.status || '').toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de solicitudes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por ID, plataforma, enlace o estado..."
            className="pl-9"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500">{items.length === 0 ? 'Sin solicitudes' : 'Sin resultados para tu búsqueda'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">ID</th>
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Plataforma</th>
                  <th className="py-2 pr-4">Enlace</th>
                  <th className="py-2 pr-4">Monto</th>
                  <th className="py-2 pr-4">Comisión</th>
                  <th className="py-2 pr-4">Estado</th>
                  <th className="py-2">Factura</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-2 pr-4">
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-blue-700 bg-blue-50 rounded px-1.5 py-0.5 whitespace-nowrap">
                        <Hash className="h-3 w-3" />{r.request_number || r.id.slice(0, 8).toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(r.created_date).toLocaleString()}</td>
                    <td className="py-2 pr-4">{providerLabels[r.provider] || r.provider || '—'}</td>
                    <td className="py-2 pr-4">{r.link_url ? <a href={r.link_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">Abrir</a> : '—'}</td>
                    <td className="py-2 pr-4">${(r.amount||0).toFixed(2)}</td>
                    <td className="py-2 pr-4">${(r.fee_amount||0).toFixed(2)}</td>
                    <td className="py-2 pr-4">{r.status === 'en_proceso' && r.invoice_id ? 'Pago pendiente' : (statusLabels[r.status] || r.status)}</td>
                    <td className="py-2">{r.invoice_id ? 'Generada' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}