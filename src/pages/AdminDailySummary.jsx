import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Package, Users, CreditCard, FileText, ShieldCheck, MessageCircle, Clock, AlertTriangle, ShoppingBag, UserX, Radio } from 'lucide-react';
import PageHero from '@/components/common/PageHero';

const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_INTERVAL = 30 * 1000; // 30 segundos
const SUBSCRIPTION_DEBOUNCE = 800; // ms — evita múltiples refresh por ráfaga de eventos

const fmt = (n) => Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtUsd = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d.toLocaleString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AdminDailySummary({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [livePulse, setLivePulse] = useState(false);
  const timerRef = useRef(null);
  const debounceRef = useRef(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const now = new Date();
      const since = new Date(now.getTime() - DAY_MS).toISOString();

      const [
        recentPackages,
        recentUsers,
        recentPayments,
        recentTickets,
        recentInvoices,
        allPayments,
        allAssisted,
        allTickets,
        pendingQuotes,
        reviewInvoices,
        pendingConsolidations,
      ] = await Promise.all([
        base44.entities.Package.list('-created_date', 500),
        base44.entities.User.list('-created_date', 500),
        base44.entities.InvoicePayment.list('-approved_date', 500),
        base44.entities.SupportTicket.list('-created_date', 500),
        base44.entities.Invoice.list('-created_date', 500),
        base44.entities.InvoicePayment.filter({ status: 'pendiente' }, '-created_date', 1000),
        base44.entities.AssistedPaymentRequest.filter({ status: 'pendiente' }, '-created_date', 1000),
        base44.entities.SupportTicket.filter({ status: 'abierto' }, '-created_date', 1000),
        base44.entities.Quote.filter({ status: 'cliente_completo' }, '-updated_date', 1000),
        base44.entities.Invoice.filter({ status: 'revision' }, '-invoice_date', 1000),
        base44.entities.Consolidation.filter({ status: 'pago_pendiente_validacion' }, '-created_date', 1000),
      ]);

      // === Filtrado client-side (más confiable que filter por status) ===
      const newPackages = (recentPackages || []).filter((p) => p.created_date && p.created_date >= since);
      const newClients = (recentUsers || []).filter((u) => u.role === 'user' && u.created_date && u.created_date >= since);
      const clientsWithoutMark = newClients.filter((u) => !u.shipping_mark);
      const newPayments = (recentPayments || []).filter((p) => p.status === 'aprobado' && p.approved_date && p.approved_date >= since);
      const newTickets = (recentTickets || []).filter((t) => t.created_date && t.created_date >= since);
      const newInvoices = (recentInvoices || []).filter((i) => i.created_date && i.created_date >= since);

      const insuredRecent = newPackages.filter((p) => p.has_insurance);
      const paymentsTotal = newPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const invoicesTotal = newInvoices.reduce((s, i) => s + Number(i.total || 0), 0);
      const insuredTotalFob = insuredRecent.reduce((s, p) => s + Number(p.fob_value || 0), 0);

      // Pendientes actuales (consulta filtrada por estado — conteo real sin tope de 500)
      const pendingPaymentsCount = (allPayments || []).length + (reviewInvoices || []).length + (pendingConsolidations || []).length;
      const pendingAssistedCount = (allAssisted || []).length;
      const openTicketsCount = (allTickets || []).length;
      const pendingQuotesCount = (pendingQuotes || []).length;

      setData({
        periodStart: fmtDate(new Date(now.getTime() - DAY_MS)),
        periodEnd: fmtDate(now),
        activity: [
          { icon: Package, label: 'Paquetes registrados', value: fmt(newPackages.length), highlight: newPackages.length > 0, color: 'text-blue-600' },
          { icon: Users, label: 'Nuevos clientes', value: fmt(newClients.length), highlight: newClients.length > 0, color: 'text-emerald-600' },
          { icon: UserX, label: 'Sin shipping mark', value: fmt(clientsWithoutMark.length), highlight: clientsWithoutMark.length > 0, color: 'text-amber-600' },
          { icon: CreditCard, label: 'Pagos aprobados', value: `${fmt(newPayments.length)} (${fmtUsd(paymentsTotal)})`, highlight: newPayments.length > 0, color: 'text-emerald-600' },
          { icon: FileText, label: 'Facturas emitidas', value: `${fmt(newInvoices.length)} (${fmtUsd(invoicesTotal)})`, highlight: newInvoices.length > 0, color: 'text-slate-800' },
          { icon: ShieldCheck, label: 'Paquetes asegurados', value: `${fmt(insuredRecent.length)} (${fmtUsd(insuredTotalFob)} FOB)`, highlight: insuredRecent.length > 0, color: 'text-amber-600' },
          { icon: MessageCircle, label: 'Tickets nuevos', value: fmt(newTickets.length), highlight: newTickets.length > 0, color: 'text-rose-600' },
        ],
        pending: [
          { icon: Clock, label: 'Pagos por validar', value: fmt(pendingPaymentsCount), alert: pendingPaymentsCount > 0, color: 'text-amber-600' },
          { icon: ShoppingBag, label: 'Pagos asistidos pendientes', value: fmt(pendingAssistedCount), alert: pendingAssistedCount > 0, color: 'text-amber-600' },
          { icon: FileText, label: 'Presupuestos por revisar', value: fmt(pendingQuotesCount), alert: pendingQuotesCount > 0, color: 'text-amber-600' },
          { icon: AlertTriangle, label: 'Tickets abiertos', value: fmt(openTicketsCount), alert: openTicketsCount > 0, color: 'text-rose-600' },
        ],
      });
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading daily summary:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Debounce para suscripciones: si llegan varios eventos juntos, un solo refresh
  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLivePulse(true);
    debounceRef.current = setTimeout(() => {
      load(true);
      setTimeout(() => setLivePulse(false), 1000);
    }, SUBSCRIPTION_DEBOUNCE);
  }, [load]);

  useEffect(() => {
    load();

    // Auto-refresh cada 30 segundos
    timerRef.current = setInterval(() => load(true), REFRESH_INTERVAL);

    // Suscripción en tiempo real a cambios de entidades clave
    const subs = [
      base44.entities.Package,
      base44.entities.InvoicePayment,
      base44.entities.SupportTicket,
      base44.entities.AssistedPaymentRequest,
      base44.entities.Invoice,
      base44.entities.User,
      base44.entities.Quote,
      base44.entities.Consolidation,
    ];
    const unsubs = subs
      .map((e) => e.subscribe?.(() => scheduleRefresh()))
      .filter(Boolean);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      unsubs.forEach((u) => u?.());
    };
  }, [load, scheduleRefresh]);

  const handleRefresh = () => load(true);

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
            <div className="flex items-center gap-3">
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${livePulse ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                <Radio className={`h-3.5 w-3.5 ${livePulse ? 'animate-pulse' : ''}`} />
                {livePulse ? 'Actualizando…' : 'En vivo'}
              </span>
              {lastUpdate && (
                <span className="text-xs text-slate-400">Actualizado: {lastUpdate.toLocaleTimeString('es-VE')}</span>
              )}
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
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
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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