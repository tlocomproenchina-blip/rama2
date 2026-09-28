import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, ChevronRight, PackageX } from 'lucide-react';

const money = (v) => `$${Number(v || 0).toFixed(2)}`;

export default function WarehouseBillingList({ clients, onOpen }) {
  if (clients.length === 0) {
    return (
      <Card className="border-border/70 shadow-card">
        <CardContent className="flex flex-col items-center justify-center py-14 text-center">
          <PackageX className="h-14 w-14 text-slate-300 mb-3" />
          <p className="text-slate-500">No hay carga pendiente de facturar en el almacén</p>
          <p className="text-sm text-slate-400 mt-1">
            Aparecen aquí los bultos en almacén de Venezuela y los envíos/recibos de CBM sin facturar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Escritorio */}
      <Card className="hidden md:block border-border/70 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-left">
                <th className="px-4 py-3 font-semibold text-slate-600">Cliente</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-center">Bultos</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-center">Envíos</th>
                <th className="px-4 py-3 font-semibold text-slate-600">N° Orden</th>
                <th className="px-4 py-3 font-semibold text-slate-600">N° Envío</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right">CBM</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-center">Paq.</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right">Monto estimado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const orders = c.bultos.flatMap((b) => b.order_numbers || []).filter(Boolean);
                const labels = c.receipts.map((r) => r.label).filter(Boolean);
                return (
                  <tr key={c.client_email} className="border-b border-border/60 last:border-0 hover:bg-accent/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{c.client_name}</div>
                      <div className="text-xs text-slate-500 break-all">{c.client_email}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {[c.shipping_mark, c.city, c.state].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="secondary">{c.totals.bultos}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="secondary">{c.totals.receipts}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {orders.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {[...new Set(orders)].slice(0, 4).map((o) => (
                            <span key={o} className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-mono text-primary">{o}</span>
                          ))}
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {labels.length > 0 ? labels.slice(0, 2).join(', ') : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{Number(c.totals.cbm || 0).toFixed(4)}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{c.totals.packages}</td>
                    <td className="px-4 py-3 text-right font-semibold text-primary">{money(c.estimate.total)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => onOpen(c)}>
                        Abrir <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Móvil */}
      <div className="md:hidden space-y-3">
        {clients.map((c) => {
          const orders = [...new Set(c.bultos.flatMap((b) => b.order_numbers || []).filter(Boolean))];
          return (
            <Card key={c.client_email} className="border-border/70 shadow-card">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{c.client_name}</p>
                    <p className="text-xs text-slate-500 break-all">{c.client_email}</p>
                  </div>
                  <span className="font-semibold text-primary shrink-0">{money(c.estimate.total)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" /> {c.totals.bultos} bulto(s)</span>
                  <span className="text-slate-400">·</span>
                  <span>{c.totals.receipts} envío(s)</span>
                  <span className="text-slate-400">·</span>
                  <span>{Number(c.totals.cbm || 0).toFixed(4)} CBM</span>
                  <span className="text-slate-400">·</span>
                  <span>{c.totals.packages} paq.</span>
                </div>
                {orders.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {orders.slice(0, 5).map((o) => (
                      <span key={o} className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-mono text-primary">{o}</span>
                    ))}
                  </div>
                )}
                <Button size="sm" variant="outline" className="w-full" onClick={() => onOpen(c)}>
                  Abrir cliente <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}