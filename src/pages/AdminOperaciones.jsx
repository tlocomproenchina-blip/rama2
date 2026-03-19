import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Package, Layers, CreditCard, Clock } from 'lucide-react';

const quickLinks = [
  { label: 'Paquetes', href: '/AdminPackages', icon: Package },
  { label: 'Aprobaciones', href: '/AdminConsolidate', icon: Layers },
  { label: 'Consolidar', href: '/AdminShipmentApprovals', icon: Layers },
  { label: 'Pagos Asistidos', href: '/AdminAssistedPayments', icon: CreditCard },
];

const formatDate = (value) => value ? new Date(value).toLocaleString('es-VE') : '—';

export default function AdminOperaciones() {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState([]);
  const [requests, setRequests] = useState([]);
  const [assistedPayments, setAssistedPayments] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [packageRows, requestRows, paymentRows] = await Promise.all([
        base44.entities.Package.list('-updated_date', 300),
        base44.entities.ConsolidationRequest.list('-updated_date', 300),
        base44.entities.AssistedPaymentRequest.list('-updated_date', 300),
      ]);
      setPackages(packageRows || []);
      setRequests(requestRows || []);
      setAssistedPayments(paymentRows || []);
      setLoading(false);
    };

    loadData();
  }, []);

  const metrics = useMemo(() => ({
    paquetesRecibidos: packages.filter((item) => item.status === 'recibido').length,
    solicitudesAprobadas: requests.filter((item) => item.status === 'aprobada').length,
    solicitudesPendientes: requests.filter((item) => item.status === 'pendiente').length,
    pagosAsistidosPendientes: assistedPayments.filter((item) => ['pendiente', 'en_proceso'].includes(item.status)).length,
  }), [packages, requests, assistedPayments]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-xl md:p-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-emerald-100">
            <Layers className="h-3.5 w-3.5" />
            Centro de operaciones
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Operaciones</h1>
          <p className="max-w-2xl text-sm text-slate-200 md:text-base">
            Control rápido de paquetes, aprobaciones, consolidación y pagos asistidos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Paquetes recibidos</p><p className="mt-2 text-3xl font-bold text-slate-900">{metrics.paquetesRecibidos}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Solicitudes aprobadas</p><p className="mt-2 text-3xl font-bold text-slate-900">{metrics.solicitudesAprobadas}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Solicitudes pendientes</p><p className="mt-2 text-3xl font-bold text-slate-900">{metrics.solicitudesPendientes}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Pagos por atender</p><p className="mt-2 text-3xl font-bold text-slate-900">{metrics.pagosAsistidosPendientes}</p></CardContent></Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Accesos rápidos</CardTitle>
          <CardDescription>Ingresa directo a cada parte operativa.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Button key={item.href} variant="outline" className="h-auto justify-start gap-3 p-4" asChild>
                <Link to={item.href}>
                  <div className="rounded-xl bg-slate-100 p-2">
                    <Icon className="h-4 w-4 text-slate-700" />
                  </div>
                  <span>{item.label}</span>
                </Link>
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Solicitudes recientes</CardTitle>
            <CardDescription>Últimas solicitudes de consolidación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {requests.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{item.shipping_mark || 'Sin shipping mark'}</p>
                    <p className="text-sm text-slate-500">{item.client_email}</p>
                    <p className="text-xs text-slate-400 mt-1">{formatDate(item.updated_date || item.created_date)}</p>
                  </div>
                  <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">{item.status || '—'}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Pagos asistidos recientes</CardTitle>
            <CardDescription>Solicitudes que requieren revisión operativa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {assistedPayments.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{item.client_email}</p>
                    <p className="text-sm text-slate-500">Monto: ${Number(item.total_amount || item.amount || 0).toFixed(2)}</p>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(item.updated_date || item.created_date)}</p>
                  </div>
                  <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">{item.status || '—'}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}