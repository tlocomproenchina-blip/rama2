import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, Loader2 } from 'lucide-react';

function dayLabel(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '');
}

// Órdenes ya generadas: se abren tal como se mandaron (sin recalcular nada).
export default function DispatchOrderHistoryList({ items, loading, activeId, onOpen, onRefresh }) {
  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" /> Órdenes generadas
          </CardTitle>
          {onRefresh ? (
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Actualizar
            </Button>
          ) : null}
        </div>
        <CardDescription>Un registro por período: el mismo rango nunca se duplica.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && items.length === 0 ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no se ha generado ninguna orden.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${
                activeId === item.id ? 'border-primary/40 bg-accent/40' : 'border-border/60 bg-card'
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {dayLabel(item.period_from)} al {dayLabel(item.period_to)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.totals?.invoices || 0} factura(s) · {item.totals?.clients || 0} cliente(s) ·{' '}
                  {item.totals?.cajas || 0} caja(s) + {item.totals?.bultos_sueltos || 0} bulto(s) suelto(s) ={' '}
                  {item.totals?.total_unidades || 0} unidad(es)
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.whatsapp_sent_date ? (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    Enviada
                  </Badge>
                ) : null}
                <Button variant="outline" size="sm" onClick={() => onOpen(item)}>
                  Ver orden
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}