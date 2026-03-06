import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { base44 } from '@/api/base44Client';

export default function AssistedPaymentHistory({ user }) {
  const [items, setItems] = React.useState([]);
  const [statusFilter, setStatusFilter] = React.useState('pendiente');
  const load = async () => {
    const reqs = await base44.entities.AssistedPaymentRequest.filter({ client_email: user.email }, '-created_date', 50).catch(() => []);
    setItems(reqs || []);
  };
  React.useEffect(() => { if (user?.email) load(); }, [user?.email]);

  const filtered = items.filter((r) => {
    if (statusFilter === 'pendiente') return r.status === 'en_proceso' && !!r.invoice_id;
    if (statusFilter === 'pagado') return r.status === 'pagado';
    if (statusFilter === 'rechazado') return r.status === 'rechazado';
    return true;
  });

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Historial de solicitudes</CardTitle>
        <div className="w-56">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendiente">Pendiente por pagar</SelectItem>
              <SelectItem value="pagado">Pagado</SelectItem>
              <SelectItem value="rechazado">Rechazado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500">Sin solicitudes en este estado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
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
                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(r.created_date).toLocaleString()}</td>
                    <td className="py-2 pr-4 uppercase">{r.provider}</td>
                    <td className="py-2 pr-4">{r.link_url ? <a href={r.link_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">Abrir</a> : '—'}</td>
                    <td className="py-2 pr-4">${(r.amount||0).toFixed(2)}</td>
                    <td className="py-2 pr-4">${(r.fee_amount||0).toFixed(2)}</td>
                    <td className="py-2 pr-4">{r.status === 'en_proceso' && r.invoice_id ? 'Pendiente de pago' : r.status}</td>
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