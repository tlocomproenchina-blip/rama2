import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AssistedPaymentPayModal from './AssistedPaymentPayModal';
import { base44 } from '@/components/api/ApiQueueManager';

const statusConfig = {
  pendiente: { label: 'Pendiente', className: 'bg-amber-100 text-amber-800' },
  en_proceso: { label: 'En proceso', className: 'bg-blue-100 text-blue-800' },
  pagado: { label: 'Pagado', className: 'bg-emerald-100 text-emerald-800' },
  rechazado: { label: 'Rechazado', className: 'bg-rose-100 text-rose-800' },
};

export default function AssistedPaymentHistory({ user }) {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [payOpen, setPayOpen] = React.useState(false);
  const [selectedReq, setSelectedReq] = React.useState(null);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (!user?.email) { setItems([]); setLoading(false); return; }
        const res = await base44.entities.AssistedPaymentRequest.filter(
          { client_email: user.email }, '-created_date', 100
        );
        if (!active) return;
        setItems(res || []);
      } finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [user?.email]);

  return (
    <>
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Mis solicitudes de Pago Asistido</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-slate-500">Cargando historial...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no tienes solicitudes.</p>
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
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-4">Estatus</th>
                  <th className="py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const s = statusConfig[it.status] || { label: it.status, className: 'bg-slate-100 text-slate-700' };
                  return (
                    <tr key={it.id} className="border-b hover:bg-slate-50">
                      <td className="py-2 pr-4 whitespace-nowrap">{new Date(it.created_date).toLocaleString()}</td>
                      <td className="py-2 pr-4 uppercase">{it.provider || '—'}</td>
                      <td className="py-2 pr-4 max-w-[260px]">
                        {it.link_url ? (
                          <a href={it.link_url} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all inline-block truncate max-w-[240px]">
                            {it.link_url}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="py-2 pr-4">${(it.amount || 0).toFixed(2)} {it.currency || 'USD'}</td>
                      <td className="py-2 pr-4">${(it.fee_amount || 0).toFixed(2)} ({it.fee_percentage || 0}%)</td>
                      <td className="py-2 pr-4 font-semibold">${(it.total_amount || 0).toFixed(2)} {it.currency || 'USD'}</td>
                      <td className="py-2 pr-4"><Badge className={s.className}>{s.label}</Badge></td>
                      <td className="py-2">
                        {it.status === 'en_proceso' && it.payment_method && it.payment_method !== 'debito_internacional' ? (
                          <Button size="sm" onClick={() => { setSelectedReq(it); setPayOpen(true); }}>
                            Pagar / Subir comprobante
                          </Button>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>

    <AssistedPaymentPayModal 
      open={payOpen}
      onClose={() => setPayOpen(false)}
      request={selectedReq}
      onSubmitted={() => {
        // Refresh list
        (async () => {
          const res = await base44.entities.AssistedPaymentRequest.filter({ client_email: user.email }, '-created_date', 100);
          setItems(res || []);
        })();
      }}
    />
    </>
  );
}