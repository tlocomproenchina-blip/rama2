import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

const Field = ({ label, value }) => (
  <div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium text-right break-all">{value || '—'}</span></div>
);

export default function WholesalerAuditDetail({ selected, loading }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card space-y-3">
      <h2 className="font-display text-lg font-semibold border-b-2 border-primary pb-2">Detalle</h2>
      {loading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
      {!loading && !selected && <p className="text-sm text-muted-foreground">Selecciona un cliente o consulta un tracking para ver su ficha.</p>}
      {!loading && selected?.type === 'client' && (() => {
        const c = selected.data;
        return (
          <div className="space-y-2">
            <Badge variant="outline">Fuente: {c.wholesaler_name || 'Mayorista principal'}</Badge>
            <Field label="Nombre" value={c.full_name} />
            <Field label="Email" value={c.email} />
            <Field label="Cédula" value={c.cedula} />
            <Field label="WhatsApp" value={c.whatsapp} />
            <Field label="Ciudad / Estado" value={[c.city, c.state].filter(Boolean).join(', ')} />
            <Field label="Dirección" value={c.address} />
            <Field label="Shipping Mark" value={c.shipping_mark} />
            <Field label="ID en mayorista" value={c.external_id} />
            <Field label="Estado de alta" value={c.status} />
            <p className="pt-2 text-sm font-semibold">Trackings del mayorista ({selected.trackings.length})</p>
            <div className="max-h-80 space-y-1 overflow-auto">
              {selected.trackings.map((t) => (
                <div key={t.id} className="flex justify-between rounded-lg border px-2 py-1 text-xs">
                  <span className="font-mono">{t.tracking_number}</span><span className="text-muted-foreground">{t.event_type}</span>
                </div>
              ))}
              {!selected.trackings.length && <p className="text-xs text-muted-foreground">Sin trackings reportados.</p>}
            </div>
          </div>
        );
      })()}
      {!loading && selected?.type === 'tracking' && (() => {
        const s = selected.data;
        return (
          <div className="space-y-2">
            <Field label="Tracking" value={s.tracking_number} />
            <Field label="Estado del aviso" value={s.estado} />
            <Field label="Estado del paquete" value={s.package_status} />
            <Field label="Cliente" value={s.client_email} />
            <Field label="Shipping Mark" value={s.shipping_mark} />
            <Field label="Fotos" value={String(s.fotos_count ?? 0)} />
            <p className="rounded-lg bg-muted p-2 text-xs">{s.mensaje}</p>
            {(s.history || []).map((h, i) => <p key={i} className="text-xs text-muted-foreground">{h.date || h.event_date} · {h.result || h.estado}</p>)}
          </div>
        );
      })()}
    </div>
  );
}