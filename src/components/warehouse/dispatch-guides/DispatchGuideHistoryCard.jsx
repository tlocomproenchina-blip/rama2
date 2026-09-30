import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CalendarCheck2,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  PenLine,
  Printer,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { generateDispatchGuidePdf } from '@/lib/dispatchGuidePdf';
import DispatchGuideDeliveryDialog from './DispatchGuideDeliveryDialog';

const fmtDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-VE');
};

const fmtDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Una guía ya emitida: su número, sus totales, el desglose por cliente y las
// acciones de reimprimir y anotar la entrega.
export default function DispatchGuideHistoryCard({ guide, appName, highlighted = false, onGuideUpdated }) {
  const [expanded, setExpanded] = useState(!!highlighted);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState('');

  const clients = Array.isArray(guide.clients) ? guide.clients : [];
  const delivered = guide.dispatch_status === 'entregada';

  const handlePdf = async (mode) => {
    setGenerating(mode);
    try {
      await generateDispatchGuidePdf({
        clients,
        appName,
        mode,
        guideNumber: guide.guide_number,
        emittedAt: guide.emitted_date,
      });
    } catch (_) {
      toast.error('No se pudo generar el PDF de la guía');
    }
    setGenerating('');
  };

  return (
    <Card className={highlighted ? 'ring-2 ring-emerald-300' : ''}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="font-mono text-sm font-bold text-slate-800">{guide.guide_number}</p>
              {guide.auto_generated && (
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                  Automática
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-slate-500">Emitida: {fmtDateTime(guide.emitted_date)}</p>
            {guide.auto_generated && guide.last_updated_date ? (
              <p className="text-[11px] text-slate-500">
                Actualizada: {fmtDateTime(guide.last_updated_date)}
              </p>
            ) : null}
            {guide.emitted_by_name || guide.emitted_by ? (
              <p className="flex items-center gap-1 text-[11px] text-slate-500">
                <User className="h-3 w-3 shrink-0 text-slate-400" />
                <span className="truncate">{guide.emitted_by_name || guide.emitted_by}</span>
              </p>
            ) : null}
          </div>
          <Badge
            variant="outline"
            className={delivered
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'}
          >
            {delivered ? 'Entregada' : 'Emitida'}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
          <span>{guide.totals?.clients || clients.length || 0} cliente(s)</span>
          <span>·</span>
          <span>{guide.totals?.bultos || 0} bulto(s)</span>
          <span>·</span>
          <span>{guide.totals?.packages || 0} paquete(s)</span>
        </div>

        {delivered && (
          <p className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-2 py-1.5 text-[11px] text-emerald-800">
            <CalendarCheck2 className="h-3.5 w-3.5 shrink-0" />
            Entregada el {fmtDate(guide.delivered_date)}
            {guide.received_by ? ` · Recibido por ${guide.received_by}` : ''}
          </p>
        )}

        {delivered && guide.delivery_notes && (
          <p className="text-[11px] text-slate-500">Notas: {guide.delivery_notes}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => handlePdf('print')} disabled={Boolean(generating)}>
            {generating === 'print' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Imprimir
          </Button>
          <Button size="sm" variant="outline" onClick={() => handlePdf('save')} disabled={Boolean(generating)}>
            {generating === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar
          </Button>
          <Button size="sm" variant={delivered ? 'ghost' : 'default'} onClick={() => setDialogOpen(true)}>
            <PenLine className="h-4 w-4" />
            {delivered ? 'Corregir entrega' : 'Anotar entrega'}
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-2 border-t border-border/60 pt-2 text-left text-xs font-semibold text-slate-600"
        >
          Detalle por cliente
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && (
          <div className="space-y-3">
            {clients.length === 0 ? (
              <p className="text-xs text-slate-400">Esta guía no tiene clientes guardados.</p>
            ) : (
              clients.map((client) => (
                <div key={client.client_key || client.client_email || client.client_name} className="rounded-xl border border-border/70 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800 break-all">
                      {String(client.client_name || client.client_email || 'Cliente').replace(/^Sin registrar(?= —|$)/i, 'Cliente')}
                    </p>
                    <span className="text-[11px] text-slate-500">
                      {client.totals?.bultos || (client.bultos || []).length} bulto(s) ·{' '}
                      {client.totals?.packages || 0} paquete(s)
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-blue-700 break-all">
                    Mark: {client.shipping_mark || client.client?.shipping_mark || '—'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(client.bultos || []).map((bulto) => (
                      <span
                        key={`${client.client_key}-${bulto.label_code}`}
                        className="rounded-lg border border-border bg-card/80 px-2 py-0.5 font-mono text-[11px] text-foreground"
                      >
                        {bulto.label_code} · {bulto.package_count || 0} paq.
                        {bulto.date ? ` · ${fmtDate(bulto.date)}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>

      <DispatchGuideDeliveryDialog
        guide={guide}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={onGuideUpdated}
      />
    </Card>
  );
}