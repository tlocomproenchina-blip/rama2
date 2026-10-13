import React from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { portalDayText, portalEstadoLabel, portalOrigenLabel } from '@/lib/sharedPortalFormat';

function EstadoBadge({ estado }) {
  const recibido = estado === 'recibido';
  return (
    <span
      className={
        recibido
          ? 'inline-flex whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700'
          : 'inline-flex whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700'
      }
    >
      {portalEstadoLabel(estado)}
    </span>
  );
}

export default function PortalTrackingTable({ rows, selected, onToggle, onToggleAll, loading, onOpenPhoto, photoLoadingId }) {
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  return (
    <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-border bg-secondary/60">
            <tr className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <th className="w-12 px-4 py-3">
                <Checkbox checked={allSelected} onCheckedChange={onToggleAll} aria-label="Seleccionar resultados visibles" />
              </th>
              <th className="px-4 py-3">Tracking</th>
              <th className="px-4 py-3">Shipping Mark</th>
              <th className="px-4 py-3">Mayorista</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Fecha de registro</th>
              <th className="px-4 py-3">Fecha de recepción</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Origen</th>
              <th className="px-4 py-3">Foto</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">Consultando los resultados…</td>
              </tr>
            ) : null}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">No hay registros con esos filtros.</td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/40">
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selected.has(row.id)}
                    onCheckedChange={() => onToggle(row.id)}
                    aria-label={`Seleccionar ${row.tracking_number}`}
                  />
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{row.tracking_number || '—'}</td>
                <td className="px-4 py-3 text-foreground">{row.shipping_mark || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.wholesaler || '—'}</td>
                <td className="px-4 py-3">
                  <p className="text-foreground">{row.client || '—'}</p>
                  {row.client_email && row.client_email !== row.client ? (
                    <p className="text-xs text-muted-foreground">{row.client_email}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-foreground">{portalDayText(row.registro)}</td>
                <td className="px-4 py-3 text-muted-foreground">{portalDayText(row.recepcion)}</td>
                <td className="px-4 py-3"><EstadoBadge estado={row.estado} /></td>
                <td className="px-4 py-3 text-muted-foreground">{portalOrigenLabel(row.origen)}</td>
                <td className="px-4 py-3">
                  {row.has_photo ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenPhoto?.(row)}
                      disabled={photoLoadingId === row.id}
                      className="h-8 gap-1 px-2 text-xs"
                      title="Foto de la entrega del vendedor"
                    >
                      {photoLoadingId === row.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Camera className="h-4 w-4" />}
                      Ver
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}