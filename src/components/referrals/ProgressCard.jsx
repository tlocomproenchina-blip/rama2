import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { USD_PER_BLOCK } from '@/lib/referralTerms';

export default function ProgressCard({ balance, onRequest, canRequest }) {
  const free = Number(balance?.free || 0);
  const pct = Math.min(100, (free % 1) * 100 + (free >= 1 ? 0 : 0));
  return (
    <Card className="overflow-hidden border-border/70 shadow-card">
      <CardContent className="grid gap-6 p-6 md:grid-cols-[1.4fr_1fr] md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">CBM disponible</p>
          <p className="mt-1 font-display text-5xl font-bold tracking-tight">{free.toFixed(2)}<span className="ml-1 text-xl text-muted-foreground">CBM</span></p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${free >= 1 ? 100 : pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Acumulado histórico {Number(balance?.accumulated || 0).toFixed(2)} CBM · usado en solicitudes {Number(balance?.used || 0).toFixed(2)} CBM · sin vencimiento
          </p>
        </div>
        <div className="rounded-2xl bg-accent p-5 text-center">
          <p className="text-sm text-accent-foreground">Bloques listos para cobrar</p>
          <p className="font-display text-4xl font-bold">{balance?.blocks || 0}</p>
          <p className="text-sm text-muted-foreground">${(balance?.blocks || 0) * USD_PER_BLOCK} USD</p>
          <Button className="mt-3 w-full" disabled={!canRequest || !balance?.blocks} onClick={onRequest}>
            Cobrar ${USD_PER_BLOCK}{balance?.blocks > 1 ? '+' : ''}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}