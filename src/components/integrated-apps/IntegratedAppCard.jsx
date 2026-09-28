import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plug, RefreshCw, Power, Trash2, Mail, Clock, Activity, DollarSign } from 'lucide-react';
import IntegratedAppStats from './IntegratedAppStats';
import IntegratedAppDiagnosticDialog from './IntegratedAppDiagnosticDialog';
import CopyClientTxtReportButton from './CopyClientTxtReportButton';
import { appState, timeAgo } from '@/lib/integratedApps';

const money = (v) => `$${Number(v || 0).toFixed(2)}`;

export default function IntegratedAppCard({ app, onRotate, onToggle, onDelete, onRefresh, onTariff }) {
  const state = appState(app);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [statsKey, setStatsKey] = useState(0);
  const hasTariff = Number(app.rate_cbm_regular) > 0 || Number(app.rate_cbm_high_risk) > 0;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-primary shrink-0" />
            <h3 className="font-semibold text-slate-800 truncate">{app.name}</h3>
          </div>
          <p className="text-[11px] font-mono text-slate-400 truncate">{app.slug}</p>
          {app.contact_email && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 truncate">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{app.contact_email}</span>
            </p>
          )}
        </div>
        <Badge variant="outline" className={`shrink-0 ${state.tone}`}>{state.label}</Badge>
      </div>

      <IntegratedAppStats appId={app.id} refreshKey={statsKey} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> {timeAgo(app.last_seen)}
        </span>
        <span>{app.call_count || 0} llamadas</span>
        {app.key_prefix && <span className="font-mono">{app.key_prefix}</span>}
      </div>

      {app.last_action && (
        <p className="text-[11px] text-slate-400">Última acción: {app.last_action}</p>
      )}

      <p className={`text-[11px] ${hasTariff ? 'text-slate-500' : 'text-amber-600'}`}>
        {hasTariff
          ? `Tarifa propia: ${money(app.rate_cbm_regular)}/CBM general · ${money(app.rate_cbm_high_risk)}/CBM alto riesgo`
          : 'Sin tarifa propia: su carga se está facturando con la tarifa normal de TLEC CARGO'}
      </p>

      <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
        <Button variant="outline" size="sm" onClick={() => setShowDiagnostic(true)} className="gap-1.5">
          <Activity className="h-3.5 w-3.5" /> Diagnóstico
        </Button>
        <Button variant="outline" size="sm" onClick={() => onTariff(app)} className="gap-1.5">
          <DollarSign className="h-3.5 w-3.5" /> Tarifa de la copia
        </Button>
        <Button variant="outline" size="sm" onClick={() => onRotate(app)} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Rotar clave
        </Button>
        <Button variant="outline" size="sm" onClick={() => onToggle(app)} className="gap-1.5">
          <Power className="h-3.5 w-3.5" /> {app.active ? 'Desactivar' : 'Activar'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(app)}
          className="gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
        >
          <Trash2 className="h-3.5 w-3.5" /> Eliminar
        </Button>
      </div>

      <CopyClientTxtReportButton app={app} onReportChanged={() => setStatsKey((k) => k + 1)} />

      <IntegratedAppDiagnosticDialog app={app} open={showDiagnostic} onOpenChange={setShowDiagnostic} onRefresh={onRefresh} />
    </div>
  );
}