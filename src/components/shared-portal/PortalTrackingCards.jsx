import React from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { portalDayText, portalEstadoLabel, portalOrigenLabel } from '@/lib/sharedPortalFormat';

function CardRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

export default function PortalTrackingCards({ rows, selected, onToggle, loading, onOpenPhoto, photoLoadingId }) {
  return (
    <div className="space-y-3 md:hidden">
      {loading && rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Consultando los resultados…
        </div>
      ) : null}
      {!loading && rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No hay registros con esos filtros.
        </div>
      ) : null}
      {rows.map((row) => (
        <div key={row.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-display text-base font-bold text-foreground">{row.tracking_number || '—'}</p>
              <p className="truncate text-xs text-muted-foreground">{row.shipping_mark || 'Sin Shipping Mark'}</p>
            </div>
            <Checkbox
              checked={selected.has(row.id)}
              onCheckedChange={() => onToggle(row.id)}
              aria-label={`Seleccionar ${row.tracking_number}`}
            />
          </div>
          <div className="mt-3 divide-y divide-border/60">
            <CardRow label="Mayorista" value={row.wholesaler || '—'} />
            <CardRow label="Cliente" value={row.client || '—'} />
            <CardRow label="Registro" value={portalDayText(row.registro)} />
            <CardRow label="Recepción" value={portalDayText(row.recepcion)} />
            <CardRow
              label="Estado"
              value={
                <span
                  className={
                    row.estado === 'recibido'
                      ? 'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700'
                      : 'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700'
                  }
                >
                  {portalEstadoLabel(row.estado)}
                </span>
              }
            />
            <CardRow label="Origen" value={portalOrigenLabel(row.origen)} />
          </div>
          {row.has_photo ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenPhoto?.(row)}
              disabled={photoLoadingId === row.id}
              className="mt-3 w-full gap-2"
            >
              {photoLoadingId === row.id
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Camera className="h-4 w-4" />}
              Ver foto de la entrega
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}