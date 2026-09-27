import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Plug } from 'lucide-react';
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

export default function IntegratedAppDiagnosticDialog({ app, open, onOpenChange }) {
  if (!app) return null;
  const diag = appDiagnostic(app);

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
          <Row label="Clave" value={app.key_prefix} />
          <Row label="Responsable" value={app.contact_email} />
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