import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Boxes } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ReferredList({ referred = [] }) {
  const totalCbm = referred.reduce((s, r) => s + (Number(r.cbm) || 0), 0);
  return (
    <Card className="border-border/70 shadow-card">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Tus referidos</p>
            <h3 className="mt-1 font-display text-xl font-bold">Quiénes se registraron con tu enlace</h3>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-accent/60 p-4">
            <Users className="h-4 w-4 text-accent-foreground" />
            <p className="mt-2 font-display text-2xl font-bold">{referred.length}</p>
            <p className="text-xs text-muted-foreground">Registrados</p>
          </div>
          <div className="rounded-xl bg-muted p-4">
            <Boxes className="h-4 w-4 text-muted-foreground" />
            <p className="mt-2 font-display text-2xl font-bold">{totalCbm.toFixed(3)}</p>
            <p className="text-xs text-muted-foreground">CBM enviados</p>
          </div>
        </div>
        {referred.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aún nadie se ha registrado con tu enlace. Compártelo para empezar.
          </p>
        ) : (
          <ul className="divide-y divide-border/70">
            {referred.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Registrado el {r.joined ? format(new Date(r.joined), "d 'de' MMM yyyy", { locale: es }) : '—'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display font-bold">{(Number(r.cbm) || 0).toFixed(3)}</p>
                  <p className="text-xs text-muted-foreground">CBM</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}