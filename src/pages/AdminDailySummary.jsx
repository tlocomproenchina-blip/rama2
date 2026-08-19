import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Package, Users, CreditCard, FileText, ShieldCheck, MessageCircle, Clock, AlertTriangle, ShoppingBag, UserX, Radio } from 'lucide-react';
import PageHero from '@/components/common/PageHero';

const REFRESH_INTERVAL = 30 * 1000; // 30 segundos — solo polling, sin suscripciones

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

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      // Una sola llamada a la función backend que devuelve todo pre-agregado
      const res = await base44.functions.invoke('getDailySummary', {});
      const m = res?.data;

      if (!m || m.error) throw new Error(m?.error || 'Sin datos');

      const periodStart = fmtDate(new Date(m.period_start));
      const periodEnd = fmtDate(new Date(m.period_end));

      setData({
        periodStart,
        periodEnd,
        activity: [
          { icon: Package, label: 'Paquetes registrados', value: fmt(m.activity.new_packages), highlight: m.activity.new_packages > 0, color: 'text-blue-600' },
          { icon: Users, label: 'Nuevos clientes', value: fmt(m.activity.new_clients), highlight: m.activity.new_clients > 0, color: 'text-emerald-600' },
          { icon: UserX, label: 'Sin shipping mark', value: fmt(m.activity.clients_without_mark), highlight: m.activity.clients_without_mark > 0, color: 'text-amber-600' },
          { icon: CreditCard, label: 'Pagos aprobados', value: `${fmt(m.activity.new_payments_count)} (${fmtUsd(m.activity.new_payments_total)})`, highlight: m.activity.new_payments_count > 0, color: 'text-emerald-600' },
          { icon: FileText, label: 'Facturas emitidas', value: `${fmt(m.activity.new_invoices_count)} (${fmtUsd(m.activity.new_invoices_total)})`, highlight: m.activity.new_invoices_count > 0, color: 'text-slate-800' },
          { icon: ShieldCheck, label: 'Paquetes asegurados', value: `${fmt(m.activity.insured_count)} (${fmtUsd(m.activity.insured_total_fob)} FOB)`, highlight: m.activity.insured_count > 0, color: 'text-amber-600' },
          { icon: MessageCircle, label: 'Tickets nuevos', value: fmt(m.activity.new_tickets), highlight: m.activity.new_tickets > 0, color: 'text-rose-600' },
        ],
        pending: [
          { icon: Clock, label: 'Pagos por validar', value: fmt(m.pending.pending_payments), alert: m.pending.pending_payments > 0, color: 'text-amber-600' },
          { icon: ShoppingBag, label: 'Pagos asistidos pendientes', value: fmt(m.pending.pending_assisted), alert: m.pending.pending_assisted > 0, color: 'text-amber-600' },
          { icon: FileText, label: 'Presupuestos por revisar', value: fmt(m.pending.pending_quotes), alert: m.pending.pending_quotes > 0, color: 'text-amber-600' },
          { icon: AlertTriangle, label: 'Tickets abiertos', value: fmt(m.pending.open_tickets), alert: m.pending.open_tickets > 0, color: 'text-rose-600' },
        ],
      });
      setLastUpdate(new Date());
      if (isRefresh) {
        setLivePulse(true);
        setTimeout(() => setLivePulse(false), 1000);
      }
    } catch (error) {
      console.error('Error loading daily summary:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Solo polling cada 30s — sin suscripciones en tiempo real
    timerRef.current = setInterval(() => load(true), REFRESH_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

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