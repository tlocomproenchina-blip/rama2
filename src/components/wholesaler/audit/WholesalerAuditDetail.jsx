import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Receipt } from 'lucide-react';
import { EVENT_LABELS } from '@/lib/wholesalerScope';

const Field = ({ label, value }) => (
  <div className="flex justify-between gap-3 border-b border-border/60 py-1.5 text-sm last:border-0"><span className="text-muted-foreground">{label}</span><span className="break-all text-right font-medium">{value || '—'}</span></div>
);

export default function WholesalerAuditDetail({ selected, loading, onBill }) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-card lg:sticky lg:top-20">
      <h2 className="border-b-2 border-primary pb-2 font-display text-lg font-semibold">Ficha</h2>
      {loading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
      {!loading && !selected && <p className="text-sm text-muted-foreground">Selecciona un cliente o un tracking para ver su ficha.</p>}
      {!loading && selected?.type === 'client' && (() => {
        const c = selected.data;
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline">Fuente: {c.wholesaler_name || 'Mayorista principal'}</Badge>
              <Button size="sm" onClick={() => onBill(c)}><Receipt /> Facturar</Button>
            </div>
            <div>
              <Field label="Nombre" value={c.full_name} /><Field label="Email" value={c.email} /><Field label="Cédula" value={c.cedula} />
              <Field label="WhatsApp" value={c.whatsapp} /><Field label="Ciudad / Estado" value={[c.city, c.state].filter(Boolean).join(', ')} />
              <Field label="Dirección" value={c.address} /><Field label="Shipping Mark" value={c.shipping_mark} />
              <Field label="ID en mayorista" value={c.external_id} /><Field label="Estado de alta" value={c.status} />
            </div>
            <p className="text-sm font-semibold">Trackings registrados ({selected.trackings.length})</p>
            <div className="max-h-72 space-y-1 overflow-auto">
              {selected.trackings.map((t) => (
                <div key={t.id} className="flex justify-between gap-2 rounded-lg border px-2 py-1.5 text-xs">
                  <span className="font-mono">{t.tracking_number}</span><span className="text-muted-foreground">{EVENT_LABELS[t.event_type] || t.event_type}</span>
                </div>
              ))}
              {!selected.trackings.length && <p className="text-xs text-muted-foreground">Sin trackings registrados localmente.</p>}
            </div>
          </div>
        );
      })()}
      {!loading && selected?.type === 'tracking' && (() => {
        const s = selected.data;
        const unavailable = s.estado === 'no_registrado' || s.error;
        return (
          <div className="space-y-2">
            <Field label="Tracking" value={s.tracking_number} />
            {!unavailable && <>
              <Field label="Estado del aviso" value={s.estado} /><Field label="Estado del paquete" value={s.package_status} />
              <Field label="Cliente" value={s.client_email} /><Field label="Shipping Mark" value={s.shipping_mark} />
              <Field label="Fotos" value={String(s.fotos_count ?? 0)} />
            </>}
            <p className={`rounded-lg p-2 text-xs ${unavailable ? 'bg-warning-bg text-warning' : 'bg-muted'}`}>
              {s.mensaje || s.error}{unavailable ? ' El mayorista no ofrece consulta externa de este dato: solo se muestra lo registrado aquí.' : ''}
            </p>
          </div>
        );
      })()}
    </div>
  );
}