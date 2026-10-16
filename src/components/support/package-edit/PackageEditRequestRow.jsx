import React from 'react';
import { Badge } from '@/components/ui/badge';
import useImageViewer from '@/hooks/useImageViewer';

const STATUS = {
  pendiente: { label: 'Pendiente de supervisión', className: 'bg-amber-100 text-amber-700' },
  aplicada: { label: 'Aplicada al paquete', className: 'bg-emerald-100 text-emerald-700' },
  rechazada: { label: 'No aplicada', className: 'bg-rose-100 text-rose-700' },
};

const fdate = (value) => (value
  ? new Date(value).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '');

const money = (value) => (value === null || value === undefined ? 'sin registro' : `$${Number(value).toFixed(2)}`);

const shortDate = (value) => (value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('es-VE') : 'sin registro');

function changeLines(request) {
  const previous = request.previous_values || {};
  const lines = [];
  if (request.tracking_number_new) lines.push(['Tracking', previous.tracking_number || request.tracking_number, request.tracking_number_new]);
  if (request.insurance_amount !== null && request.insurance_amount !== undefined) {
    lines.push(['Monto del seguro', money(previous.insurance_amount), money(request.insurance_amount)]);
  }
  if (request.dispatched_date) {
    lines.push(['Fecha de despacho', shortDate(previous.dispatched_date), shortDate(request.dispatched_date)]);
  }
  return lines;
}

// Una solicitud de cambio de datos de paquete, tal como la ve Soporte y
// Supervisión: qué cambia, con qué imagen y quién la mandó. Recibe las acciones
// del supervisor cuando toca atenderla.
export default function PackageEditRequestRow({ request, actions }) {
  const imageViewer = useImageViewer();
  const status = STATUS[request.status] || STATUS.pendiente;
  const lines = changeLines(request);
  const images = [request.insurance_proof, request.dispatch_proof].filter((item) => item?.url);

  return (
    <div className="space-y-3 rounded-2xl border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-foreground">{request.tracking_number}</p>
          <p className="text-[11px] text-muted-foreground">
            {request.requested_by_name || request.requested_by_email || 'ATC'} · {fdate(request.requested_date || request.created_date)}
            {request.ticket_number ? ` · caso ${request.ticket_number}` : ''}
          </p>
        </div>
        <Badge className={status.className}>{status.label}</Badge>
      </div>

      {lines.length > 0 ? (
        <ul className="space-y-1">
          {lines.map(([label, before, after]) => (
            <li key={label} className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">{label}:</span>
              <span className="text-muted-foreground line-through">{before}</span>
              <span className="text-foreground">→</span>
              <span className="font-semibold text-foreground">{after}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Sin cambios de datos: la solicitud va solo con las imágenes adjuntas.</p>
      )}

      {images.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {images.map((image, index) => (
            <button
              key={`${image.url}-${index}`}
              type="button"
              onClick={() => imageViewer.open(image.url)}
              className="overflow-hidden rounded-xl border border-border/70"
            >
              <img src={image.url} alt={image.name || 'Imagen del cambio'} className="h-20 w-28 object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      {request.note ? <p className="whitespace-pre-wrap text-xs text-foreground">{request.note}</p> : null}

      {request.review_note ? (
        <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-foreground">
          <span className="font-semibold">{request.reviewed_by_name || 'Supervisión'}: </span>
          {request.review_note}
        </p>
      ) : null}

      {actions}
      {imageViewer.modal}
    </div>
  );
}