import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StatusPill from './StatusPill';
import { SHIPMENT_STATUS } from '@/lib/referralTerms';

export default function ShipmentsList({ shipments, showReferrer }) {
  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-2"><CardTitle className="text-base">Envíos de referidos</CardTitle></CardHeader>
      <CardContent className="divide-y p-0">
        {!shipments.length && <p className="p-6 text-center text-sm text-muted-foreground">Aún no hay envíos vinculados.</p>}
        {shipments.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{s.referred_name || s.referred_email}</p>
              <p className="text-xs text-muted-foreground">
                {showReferrer && <>Referidor: {s.referrer_email} · </>}Factura {s.invoice_number || '—'}{s.exclusion_reason ? ` · ${s.exclusion_reason}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-display font-semibold">{Number(s.cbm || 0).toFixed(3)} CBM</span>
              <StatusPill map={SHIPMENT_STATUS} value={s.status} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}