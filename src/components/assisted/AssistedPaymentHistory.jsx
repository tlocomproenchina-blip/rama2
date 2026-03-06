import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { base44 } from '@/api/base44Client';

export default function AssistedPaymentHistory({ user }) {
  const [items, setItems] = React.useState([]);
  const load = async () => {
    const reqs = await base44.entities.AssistedPaymentRequest.filter({ client_email: user.email }, '-created_date', 50).catch(() => []);
    setItems(reqs || []);
  };
  React.useEffect(() => { if (user?.email) load(); }, [user?.email]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de solicitudes</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Sin solicitudes</p>
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
                {items.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(r.created_date).toLocaleString()}</td>
                    <td className="py-2 pr-4 uppercase">{r.provider}</td>
                    <td className="py-2 pr-4">{r.link_url ? <a href={r.link_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">Abrir</a> : '—'}</td>
                    <td className="py-2 pr-4">${(r.amount||0).toFixed(2)}</td>
                    <td className="py-2 pr-4">${(r.fee_amount||0).toFixed(2)}</td>
                    <td className="py-2 pr-4">{r.status === 'en_proceso' && r.invoice_id ? 'Pago pendiente' : r.status}</td>
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