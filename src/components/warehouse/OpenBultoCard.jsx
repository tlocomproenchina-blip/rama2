import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Boxes, Lock, Undo2, Package } from 'lucide-react';

// Tarjeta del bulto activo destacado: shipping mark grande, contador,
// lista de trackings, botón "Cerrar bulto" y "Quitar último".
export default function OpenBultoCard({ bulto, onClose, onRemoveLast }) {
  const trackings = bulto.package_trackings || [];
  const count = bulto.package_ids?.length || trackings.length || 0;
  const cs = bulto.client_snapshot || {};

  return (
    <Card className="shadow-premium border-blue-300">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Bulto activo</p>
            <h2 className="text-2xl font-bold text-slate-800 font-mono break-all leading-tight">
              {bulto.shipping_mark || '—'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Bulto {bulto.bulto_number}/{bulto.total_bultos} · {cs.full_name || bulto.client_email}
            </p>
          </div>
          <div className="shrink-0 rounded-2xl bg-blue-50 border border-blue-200 px-3 py-2 text-center">
            <p className="text-2xl font-bold text-blue-700 leading-none">{count}</p>
            <p className="text-[10px] uppercase tracking-wide text-blue-600 mt-0.5">paquetes</p>
          </div>
        </div>

        {trackings.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 p-2 max-h-32 overflow-y-auto">
            <ul className="space-y-1">
              {trackings.map((t, i) => (
                <li key={`${t}-${i}`} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-mono w-5 text-right">{i + 1}.</span>
                  <span className="font-mono text-slate-700 break-all">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700" disabled={count === 0}>
            <Lock className="h-4 w-4" /> Cerrar bulto
          </Button>
          <Button variant="outline" onClick={onRemoveLast} disabled={count === 0} className="w-full">
            <Undo2 className="h-4 w-4" /> Quitar último paquete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}