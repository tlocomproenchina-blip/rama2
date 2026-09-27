import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Plug, Play, CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { appDiagnostic, timeAgo, INTEGRATED_APP_ENDPOINT } from '@/lib/integratedApps';

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:gap-4">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:w-44 sm:shrink-0">{label}</span>
      <span className="min-w-0 text-sm text-slate-700 break-words">{value}</span>
    </div>
  );
}

export default function IntegratedAppDiagnosticDialog({ app, open, onOpenChange, onRefresh }) {
  const [busy, setBusy] = useState('');

  // Mientras el diagnóstico está abierto se refresca solo: la prueba pedida
  // aparece respondida sin tener que recargar la página.
  useEffect(() => {
    if (!open || !onRefresh) return undefined;
    const id = setInterval(() => { onRefresh(); }, 60000);
    return () => clearInterval(id);
  }, [open, onRefresh]);

  const requestTest = async () => {
    setBusy('request');
    try {
      const { data } = await base44.functions.invoke('manageIntegratedApps', { action: 'request_test', app_id: app.id });
      if (!data?.ok) throw new Error(data?.error || 'No se pudo pedir la prueba');
      toast.success('Prueba pedida: la copia la ejecutará en su próximo ciclo');
      if (onRefresh) await onRefresh();
    } catch (error) {
      toast.error(error?.message || 'No se pudo pedir la prueba');
    } finally {
      setBusy('');
    }
  };

  const cleanupTest = async () => {
    setBusy('cleanup');
    try {
      const { data } = await base44.functions.invoke('manageIntegratedApps', { action: 'cleanup_test', app_id: app.id });
      if (!data?.ok) throw new Error(data?.error || 'No se pudieron borrar los datos de prueba');
      toast.success(data.removed ? `Datos de prueba borrados (${data.removed})` : 'No había nada que borrar');
      if (onRefresh) await onRefresh();
    } catch (error) {
      toast.error(error?.message || 'No se pudieron borrar los datos de prueba');
    } finally {
      setBusy('');
    }
  };

  if (!app) return null;
  const diag = appDiagnostic(app);
  const test = diag.test;
  const request = diag.testRequest;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <Plug className="h-4 w-4 shrink-0 text-primary" />
            Diagnóstico de {app.name}
          </DialogTitle>
          <DialogDescription>Cómo está la conexión de esta copia y qué hacer si algo falta.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={diag.tone}>{diag.label}</Badge>
          <span className="text-xs font-mono text-slate-400">{app.slug}</span>
        </div>

        <div className="divide-y divide-border/70 rounded-xl border bg-slate-50/60 px-3">
          <Row
            label="Última llamada"
            value={app.last_seen ? `${formatDateTime(app.last_seen)} · ${timeAgo(app.last_seen)}` : 'Nunca ha llamado'}
          />
          <Row label="Última acción" value={app.last_action} />
          <Row label="Total de llamadas" value={String(app.call_count || 0)} />
          <Row label="Reporte de estado" value={diag.reportDate ? formatDateTime(diag.reportDate) : ''} />
          <Row label="Envíos pendientes" value={diag.reportDate ? String(diag.pending) : ''} />
          <Row
            label="Último error"
            value={diag.lastError ? `${diag.lastError}${diag.lastErrorDate ? ` · ${formatDateTime(diag.lastErrorDate)}` : ''}` : ''}
          />
          <Row
            label="Llamadas rechazadas"
            value={diag.rejected.count
              ? `${diag.rejected.count}${diag.rejected.date ? ` · última ${formatDateTime(diag.rejected.date)}` : ''}${diag.rejected.reason ? ` · ${diag.rejected.reason}` : ''}`
              : ''}
          />
          <Row label="Clave" value={app.key_prefix} />
          <Row label="Responsable" value={app.contact_email} />
        </div>

        <div className="space-y-3 rounded-xl border bg-card p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Prueba de conexión</p>
              <p className="text-xs text-slate-500">
                {test.ran
                  ? `Última: ${formatDateTime(test.date)} · ${timeAgo(test.date)}`
                  : 'Todavía no hay ninguna prueba ejecutada'}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={busy === 'request' || app.active === false}
              onClick={requestTest}
            >
              {busy === 'request' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Probar conexión ahora
            </Button>
          </div>

          {request.pending && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Prueba pedida {timeAgo(request.requested)}. La copia la ejecutará en su próximo ciclo de sincronización (hasta 15 minutos).
            </p>
          )}

          {test.ran && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={test.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}
              >
                {test.ok ? 'Prueba correcta' : 'Prueba con fallas'}
              </Badge>
              <span className="text-xs text-slate-500">Cliente, pre-alerta, factura y cobro</span>
            </div>
          )}

          {test.steps.length > 0 && (
            <div className="divide-y divide-border/70 rounded-xl border bg-slate-50/60 px-3">
              {test.steps.map((step) => (
                <div key={step.step} className="flex items-start gap-2 py-2">
                  {step.ok
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700">{step.label || step.step}</p>
                    {step.detail && <p className="text-xs text-slate-500 break-words">{step.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {test.leftovers.length > 0 && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-800">
                La copia no pudo borrar: <span className="font-medium">{test.leftovers.join(', ')}</span>.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={busy === 'cleanup'}
                onClick={cleanupTest}
              >
                {busy === 'cleanup' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Borrar datos de prueba
              </Button>
            </div>
          )}
        </div>

        <div className={`flex items-start gap-2 rounded-xl border p-3 ${diag.tone}`}>
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-sm">{diag.step}</p>
        </div>

        {!diag.connected && (
          <div className="space-y-1 rounded-xl border border-border/70 bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Para dejar la copia conectada</p>
            <p className="font-mono text-xs break-all text-slate-600">{INTEGRATED_APP_ENDPOINT}</p>
            <p className="text-xs text-slate-500">
              Guarda estos dos valores en la copia:{' '}
              <span className="font-medium text-slate-700">Dirección_del_servicio</span> y{' '}
              <span className="font-medium text-slate-700">Clave_de_acceso</span>.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}