import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Mail, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_STYLES = {
  sent: { label: 'Enviado', className: 'bg-emerald-100 text-emerald-700' },
  delivered: { label: 'Entregado', className: 'bg-emerald-100 text-emerald-700' },
  opened: { label: 'Abierto', className: 'bg-blue-100 text-blue-700' },
  clicked: { label: 'Click', className: 'bg-indigo-100 text-indigo-700' },
  bounced: { label: 'Rebotado', className: 'bg-amber-100 text-amber-700' },
  failed: { label: 'Falló', className: 'bg-red-100 text-red-700' },
};

export default function EmailLogCard({ log }) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_STYLES[log.status] || STATUS_STYLES.sent;
  const dateStr = log.sent_date ? format(new Date(log.sent_date), "dd MMM yyyy · hh:mm a", { locale: es }) : '—';

  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors"
      >
        <div className="mt-0.5 h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <Mail className="h-4 w-4 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-800 truncate">{log.subject || 'Sin asunto'}</p>
            <Badge className={`text-[10px] ${status.className}`}>{status.label}</Badge>
            {log.campaign_name && (
              <Badge variant="outline" className="text-[10px]">{log.campaign_name}</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            Para: {log.recipient_name ? `${log.recipient_name} · ` : ''}{log.recipient_email}
          </p>
          <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
            <Calendar className="h-3 w-3" /> {dateStr}
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t bg-slate-50/50">
          {log.status === 'failed' && log.bounce_reason && (
            <div className="mt-3 flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{log.bounce_reason}</span>
            </div>
          )}
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mt-3 mb-1">Contenido del mensaje</p>
          <div className="text-sm text-slate-700 whitespace-pre-wrap bg-white border rounded-lg p-3 max-h-80 overflow-y-auto">
            {log.body_preview || 'Sin contenido registrado'}
          </div>
        </div>
      )}
    </div>
  );
}