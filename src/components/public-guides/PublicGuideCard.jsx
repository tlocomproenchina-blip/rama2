import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Boxes, CalendarCheck2, ChevronDown, ChevronUp, Package } from 'lucide-react';

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

const SOURCE_LABELS = {
  periodo_pagos: 'Período pagado',
  escaneo: 'Por escaneo',
  lote_etiquetas: 'Lote de etiquetas',
  manual: 'Manual',
};

// Números de contenedor de un cliente: se muestran como etiquetas monoespaciadas
// para poder copiarlos tal cual.
function ContainerList({ containers }) {
  if (!containers?.length) {
    return <p className="text-[11px] text-muted-foreground">Sin número de contenedor registrado.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
        <Boxes className="h-3.5 w-3.5" /> Contenedor:
      </span>
      {containers.map((number) => (
        <span
          key={number}
          className="rounded-lg border border-border bg-muted/60 px-2 py-0.5 font-mono text-[11px] text-foreground break-all"
        >
          {number}
        </span>
      ))}
    </div>
  );
}

// Una guía emitida vista desde el enlace público: su número, su estado, sus
// totales y el detalle por cliente con el número de contenedor y los bultos.
export default function PublicGuideCard({ guide }) {
  const [expanded, setExpanded] = useState(false);
  const clients = Array.isArray(guide.clients) ? guide.clients : [];
  const delivered = guide.dispatch_status === 'entregada';

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="font-mono text-sm font-bold text-foreground">{guide.guide_number}</p>
              {guide.auto_generated && (
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                  Automática
                </Badge>
              )}
              {SOURCE_LABELS[guide.source] && (
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                  {SOURCE_LABELS[guide.source]}
                </Badge>
              )}
              {Number(guide.totals?.unregistered) > 0 && (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                  {guide.totals.unregistered} sin bulto
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">Emitida: {fmtDateTime(guide.emitted_date)}</p>
            {guide.auto_generated && guide.last_updated_date ? (
              <p className="text-[11px] text-muted-foreground">
                Actualizada: {fmtDateTime(guide.last_updated_date)}
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

        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <span className="rounded-xl bg-muted/50 px-2 py-1.5 text-center">
            {guide.totals?.clients || clients.length || 0} cliente(s)
          </span>
          <span className="flex items-center justify-center gap-1 rounded-xl bg-muted/50 px-2 py-1.5 text-center font-semibold text-foreground">
            <Boxes className="h-3.5 w-3.5" /> {guide.totals?.bultos || 0} bulto(s)
          </span>
          <span className="flex items-center justify-center gap-1 rounded-xl bg-muted/50 px-2 py-1.5 text-center">
            <Package className="h-3.5 w-3.5" /> {guide.totals?.packages || 0} paquete(s)
          </span>
        </div>

        {delivered && (
          <p className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-2 py-1.5 text-[11px] text-emerald-800">
            <CalendarCheck2 className="h-3.5 w-3.5 shrink-0" />
            Entregada el {fmtDateTime(guide.delivered_date)}
            {guide.received_by ? ` · Recibido por ${guide.received_by}` : ''}
          </p>
        )}

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 border-t border-border/60 pt-2 text-left text-xs font-semibold text-muted-foreground"
        >
          Detalle por cliente
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && (
          <div className="space-y-3">
            {clients.length === 0 ? (
              <p className="text-xs text-muted-foreground">Esta guía no tiene clientes guardados.</p>
            ) : (
              clients.map((client) => (
                <div
                  key={`${client.shipping_mark}-${client.client_name}`}
                  className="space-y-1.5 rounded-xl border border-border/70 p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground break-all">{client.client_name}</p>
                    <span className="text-[11px] text-muted-foreground">
                      {client.bultos} bulto(s) · {client.packages} paquete(s)
                      {client.unregistered ? ` · ${client.unregistered} sin bulto` : ''}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-blue-700 break-all">
                    Mark: {client.shipping_mark || '—'}
                  </p>
                  <ContainerList containers={client.containers} />
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}