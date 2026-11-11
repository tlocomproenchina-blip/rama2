import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StatusPill from './StatusPill';
import { PAYOUT_METHODS, REQUEST_STATUS } from '@/lib/referralTerms';

export default function PayoutRequestsList({ requests, renderActions }) {
  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-2"><CardTitle className="text-base">Solicitudes de cobro</CardTitle></CardHeader>
      <CardContent className="divide-y p-0">
        {!requests.length && <p className="p-6 text-center text-sm text-muted-foreground">Sin solicitudes.</p>}
        {requests.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">${r.amount} · {r.blocks} CBM · {PAYOUT_METHODS[r.method]}</p>
              <p className="text-xs text-muted-foreground">
                {renderActions && <>{r.referrer_name} ({r.referrer_email}) · </>}
                {new Date(r.created_date).toLocaleDateString()}
                {r.payout_details ? ` · ${r.payout_details}` : ''}
                {r.due_date && r.status === 'aprobada' ? ` · límite ${new Date(r.due_date).toLocaleDateString()}` : ''}
                {r.payment_reference ? ` · Ref: ${r.payment_reference}` : ''}
                {r.admin_notes ? ` · ${r.admin_notes}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill map={REQUEST_STATUS} value={r.status} />
              {renderActions?.(r)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}