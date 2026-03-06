import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ExternalLink, RefreshCw, CreditCard } from 'lucide-react';

export default function MyAssistedPayments({ user }) {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const load = async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
      const list = await base44.entities.AssistedPaymentRequest.filter({ client_email: user.email }, '-created_date');
      setItems(list || []);
    } catch (e) {
      console.error('Error loading assisted payments', e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { load(); }, [user?.email]);

  const statusCfg = {
    pendiente: { label: 'Pendiente', className: 'bg-amber-100 text-amber-800' },
    en_proceso: { label: 'Aprobado', className: 'bg-blue-100 text-blue-800' },
    pagado: { label: 'Pagado', className: 'bg-emerald-100 text-emerald-800' },
    rechazado: { label: 'Rechazado', className: 'bg-rose-100 text-rose-800' },
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><CreditCard className="h-5 w-5" /> Mis Pagos Asistidos</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} className="gap-2"><RefreshCw className="h-4 w-4" /> Actualizar</Button>
          <Link to={createPageUrl('AssistedPayment')}>
            <Button className="bg-blue-600 hover:bg-blue-700">Nuevo Pago Asistido</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de solicitudes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Cargando...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-slate-600">Aún no tienes solicitudes de Pago Asistido.</p>
              <Link to={createPageUrl('AssistedPayment')}>
                <Button className="mt-4 bg-blue-600 hover:bg-blue-700">Crear solicitud</Button>
              </Link>
            </div>
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
                    <th className="py-2 pr-4">Estado</th>
                    <th className="py-2 pr-4">Referencia</th>
                    <th className="py-2">Soporte</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b hover:bg-slate-50">
                      <td className="py-2 pr-4 whitespace-nowrap">{new Date(item.created_date).toLocaleString()}</td>
                      <td className="py-2 pr-4 uppercase">{item.provider || '—'}</td>
                      <td className="py-2 pr-4 max-w-[260px]">
                        {item.link_url ? (
                          <a href={item.link_url} target="_blank" rel="noreferrer" className="text-blue-600 underline inline-flex items-center gap-1 truncate max-w-[240px]">
                            <span className="truncate">{item.link_url}</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : '—'}
                      </td>
                      <td className="py-2 pr-4">${(item.amount||0).toFixed(2)} {item.currency || 'USD'}</td>
                      <td className="py-2 pr-4">${(item.fee_amount||0).toFixed(2)} ({item.fee_percentage || 0}%)</td>
                      <td className="py-2 pr-4 font-semibold">${(item.total_amount||0).toFixed(2)} {item.currency || 'USD'}</td>
                      <td className="py-2 pr-4">
                        {(() => {
                          const cfg = statusCfg[item.status] || { label: item.status, className: 'bg-slate-100 text-slate-800' };
                          return <Badge className={cfg.className}>{cfg.label}</Badge>;
                        })()}
                      </td>
                      <td className="py-2 pr-4">{item.reference || '—'}</td>
                      <td className="py-2">
                        {item.image_url ? (
                          <a href={item.image_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">Ver</a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}