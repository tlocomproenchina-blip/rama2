import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StatusPill from './StatusPill';
import { PROFILE_STATUS } from '@/lib/referralTerms';

export default function AdminProfilesList({ profiles, onDecide }) {
  return (
    <Card className="border-border/70 shadow-card">
      <CardContent className="divide-y p-0">
        {!profiles.length && <p className="p-6 text-center text-sm text-muted-foreground">Sin registros.</p>}
        {profiles.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{p.full_name} {p.referral_code && <span className="ml-1 font-mono text-xs text-muted-foreground">{p.referral_code}</span>}</p>
              <p className="text-xs text-muted-foreground">{p.user_email} · ID {p.id_number} · {p.phone} · {p.contact_email}</p>
              <p className="text-xs text-muted-foreground">Acumulado: {Number(p.accumulated_cbm || 0).toFixed(3)} CBM{p.review_notes ? ` · ${p.review_notes}` : ''}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill map={PROFILE_STATUS} value={p.status} />
              {p.status !== 'activo' && <Button size="sm" onClick={() => onDecide(p, 'activo')}>Habilitar</Button>}
              {p.status === 'pendiente' && <Button size="sm" variant="outline" onClick={() => onDecide(p, 'rechazado')}>Rechazar</Button>}
              {p.status === 'activo' && <Button size="sm" variant="outline" onClick={() => onDecide(p, 'suspendido')}>Suspender</Button>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}