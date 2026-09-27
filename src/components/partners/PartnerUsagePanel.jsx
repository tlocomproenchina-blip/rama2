import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/components/api/ApiQueueManager';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default function PartnerUsagePanel({ company, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!company) return;
    let active = true;
    setLoading(true);
    setData(null);
    base44.functions
      .invoke('getCompanyUsage', { company_code: company.company_code, days: 30 })
      .then((res) => { if (active) setData(res?.data || res); })
      .catch(() => toast.error('No se pudo cargar el uso de la empresa'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [company]);

  const summary = data?.summary;

  return (
    <Dialog open={!!company} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Uso de {company?.name || 'la empresa'}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div>
        ) : !summary ? (
          <p className="py-6 text-center text-sm text-slate-500">Sin datos de uso todavía.</p>
        ) : (
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Operaciones" value={summary.operations} />
              <Metric label="Éxito" value={`${summary.success_rate}%`} />
              <Metric label="Errores" value={summary.errors} />
              <Metric label="Clientes" value={summary.clients} />
            </div>

            <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-600">
              Última actividad: {summary.last_activity
                ? new Date(summary.last_activity).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })
                : 'sin registros'} · Llave usada por última vez:{' '}
              {data?.company?.service_key_last_used_date
                ? new Date(data.company.service_key_last_used_date).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })
                : 'nunca'}
            </div>

            {summary.top_targets?.length ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Lo más usado</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {summary.top_targets.map((item) => (
                    <Badge key={item.label} variant="outline" className="border-slate-200 text-slate-600">
                      {item.label}: {item.count}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Movimientos recientes</p>
              <div className="mt-1 space-y-1.5">
                {(data.recent || []).map((log) => (
                  <div key={log.id} className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={log.success ? 'text-emerald-600' : 'text-rose-600'}>{log.success ? '●' : '▲'}</span>
                      <span className="font-semibold text-slate-700">{log.capability}</span>
                      <span className="text-slate-500">
                        {log.function_name || log.entity_name || log.action}
                        {log.record_count ? ` · ${log.record_count} registro(s)` : ''}
                      </span>
                      <span className="ml-auto text-slate-400">
                        {log.created_date ? new Date(log.created_date).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                      </span>
                    </div>
                    {log.actor_email ? <p className="mt-0.5 break-all text-slate-500">{log.actor_email}</p> : null}
                    {!log.success && log.error_message ? <p className="mt-0.5 text-rose-600">{log.error_message}</p> : null}
                  </div>
                ))}
                {!data.recent?.length ? <p className="text-xs text-slate-500">Sin movimientos en los últimos 30 días.</p> : null}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}