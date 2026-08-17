import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Package, Users, CreditCard, FileText, ShieldCheck, MessageCircle, Clock, AlertTriangle, ShoppingBag } from 'lucide-react';
import PageHero from '@/components/common/PageHero';

const DAY_MS = 24 * 60 * 60 * 1000;

const fmt = (n) => Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtUsd = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d.toLocaleString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AdminDailySummary({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const now = new Date();
      const since = new Date(now.getTime() - DAY_MS).toISOString();

      const [
        recentPackages,
        recentUsers,
        recentPayments,
        recentTickets,
        recentInvoices,
        pendingPayments,
        pendingAssisted,
        openTickets,
      ] = await Promise.all([
        base44.entities.Package.list('-created_date', 500),
        base44.entities.User.list('-created_date', 500),
        base44.entities.InvoicePayment.list('-approved_date', 500),
        base44.entities.SupportTicket.list('-created_date', 500),
        base44.entities.Invoice.list('-created_date', 500),
        base44.entities.InvoicePayment.filter({ status: 'pendiente' }, '-created_date', 500),
        base44.entities.AssistedPaymentRequest.filter({ status: 'pendiente' }, '-created_date', 500),
        base44.entities.SupportTicket.filter({ status: 'abierto' }, '-created_date', 500),
      ]);

      const newPackages = (recentPackages || []).filter((p) => p.created_date && p.created_date >= since);
      const newClients = (recentUsers || []).filter((u) => u.role === 'user' && u.created_date && u.created_date >= since);
      const newPayments = (recentPayments || []).filter((p) => p.status === 'aprobado' && p.approved_date && p.approved_date >= since);
      const newTickets = (recentTickets || []).filter((t) => t.created_date && t.created_date >= since);
      const newInvoices = (recentInvoices || []).filter((i) => i.created_date && i.created_date >= since);

      const insuredRecent = newPackages.filter((p) => p.has_insurance);
      const paymentsTotal = newPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const invoicesTotal = newInvoices.reduce((s, i) => s + Number(i.total || 0), 0);
      const invoicesPaidTotal = newInvoices.filter((i) => i.status === 'pagada').reduce((s, i) => s + Number(i.total || 0), 0);
      const insuredTotalFob = insuredRecent.reduce((s, p) => s + Number(p.fob_value || 0), 0);

      setData({
        periodStart: fmtDate(new Date(now.getTime() - DAY_MS)),
        periodEnd: fmtDate(now),
        activity: [
          { icon: Package, label: 'Paquetes registrados', value: fmt(newPackages.length), highlight: newPackages.length > 0, color: 'text-blue-600' },
          { icon: Users, label: 'Nuevos clientes', value: fmt(newClients.length), highlight: newClients.length > 0, color: 'text-emerald-600' },
          { icon: CreditCard, label: 'Pagos aprobados', value: `${fmt(newPayments.length)} (${fmtUsd(paymentsTotal)})`, highlight: newPayments.length > 0, color: 'text-emerald-600' },
          { icon: FileText, label: 'Facturas emitidas', value: `${fmt(newInvoices.length)} (${fmtUsd(invoicesTotal)})`, highlight: newInvoices.length > 0, color: 'text-slate-800' },
          { icon: ShieldCheck, label: 'Paquetes asegurados', value: `${fmt(insuredRecent.length)} (${fmtUsd(insuredTotalFob)} FOB)`, highlight: insuredRecent.length > 0, color: 'text-amber-600' },
          { icon: MessageCircle, label: 'Tickets nuevos', value: fmt(newTickets.length), highlight: newTickets.length > 0, color: 'text-rose-600' },
        ],
        pending: [
          { icon: Clock, label: 'Pagos por validar', value: fmt((pendingPayments || []).length), alert: (pendingPayments || []).length > 0, color: 'text-amber-600' },
          { icon: ShoppingBag, label: 'Pagos asistidos pendientes', value: fmt((pendingAssisted || []).length), alert: (pendingAssisted || []).length > 0, color: 'text-amber-600' },
          { icon: AlertTriangle, label: 'Tickets abiertos', value: fmt((openTickets || []).length), alert: (openTickets || []).length > 0, color: 'text-rose-600' },
        ],
      });
    } catch (error) {
      console.error('Error loading daily summary:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHero
        icon={FileText}
        badge="Operaciones"
        title="Resumen Diario"
        description="Acumulado de las últimas 24 horas en el sistema."
        loadingLabel={refreshing ? 'Actualizando' : ''}
      />

      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Período</p>
              <p className="text-sm font-medium text-slate-700">{data.periodStart} → {data.periodEnd}</p>
            </div>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                Actividad de las últimas 24 horas
              </CardTitle>
              <CardDescription>Movimiento nuevo registrado en el período.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {data.activity.map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.label} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-white p-2 shadow-sm">
                        <Icon className={`h-5 w-5 ${row.color}`} />
                      </div>
                      <span className="text-sm font-medium text-slate-600">{row.label}</span>
                    </div>
                    <span className={`text-base font-bold whitespace-nowrap ${row.highlight ? row.color : 'text-slate-800'}`}>
                      {row.value}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                Pendientes actuales
              </CardTitle>
              <CardDescription>Estado actual de tareas que requieren atención.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {data.pending.map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.label} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-white p-2 shadow-sm">
                        <Icon className={`h-5 w-5 ${row.color}`} />
                      </div>
                      <span className="text-sm font-medium text-slate-600">{row.label}</span>
                    </div>
                    <span className={`text-base font-bold ${row.alert ? row.color : 'text-slate-800'}`}>
                      {row.value}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}