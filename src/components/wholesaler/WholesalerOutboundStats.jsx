import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Clock, AlertTriangle } from 'lucide-react';

const cards = [
  { key: 'enviados', label: 'Enviados al mayorista', icon: Send, tone: 'text-emerald-600 bg-emerald-50' },
  { key: 'pendientes', label: 'Pendientes de enviar', icon: Clock, tone: 'text-amber-600 bg-amber-50' },
  { key: 'fallidos', label: 'Con envío fallido', icon: AlertTriangle, tone: 'text-rose-600 bg-rose-50' },
];

export default function WholesalerOutboundStats({ counts = {}, loading }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map(({ key, label, icon: Icon, tone }) => (
        <Card key={key} className="rounded-2xl border-0 shadow-card">
          <CardContent className="flex items-center gap-3 p-4">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
              {loading ? (
                <Skeleton className="mt-1 h-6 w-12" />
              ) : (
                <p className="font-display text-2xl font-semibold leading-tight text-foreground">{counts?.[key] ?? 0}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}