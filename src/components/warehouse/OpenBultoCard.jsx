import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Boxes, Lock, Undo2, Package, Printer, ChevronDown, ChevronUp, Hash } from 'lucide-react';
import PrintCountBadge from './PrintCountBadge';
import ReprintDialog from './ReprintDialog';

// Tarjeta del bulto activo destacado: shipping mark grande, contador,
// lista de trackings, botón "Cerrar bulto" y "Quitar último".
// Incluye campo colapsable opcional para ingresar el número de orden manualmente.
export default function OpenBultoCard({ bulto, onClose, onRemoveLast }) {
  const [showReprint, setShowReprint] = useState(false);
  const [showOrderInput, setShowOrderInput] = useState(false);
  const [manualOrder, setManualOrder] = useState(
    Array.isArray(bulto.cbm_order_numbers) ? bulto.cbm_order_numbers.join(', ') : ''
  );
  const trackings = bulto.package_trackings || [];
  const count = bulto.package_ids?.length || trackings.length || 0;
  const cs = bulto.client_snapshot || {};

  const existingOrders = Array.isArray(bulto.cbm_order_numbers) ? bulto.cbm_order_numbers.filter(Boolean) : [];

  const handleClose = () => {
    // Si el operador ingresó un número manual, lo pasa como override
    const trimmed = manualOrder.trim();
    if (trimmed) {
      const orders = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
      onClose(orders);
    } else {
      onClose(existingOrders.length > 0 ? existingOrders : null);
    }
  };

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
            {Number(bulto.print_count || 0) > 0 && (
              <div className="mt-1"><PrintCountBadge count={bulto.print_count} /></div>
            )}
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

        {/* Número de orden detectado automáticamente (solo lectura) */}
        {existingOrders.length > 0 && !showOrderInput && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-700">
            <Hash className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium">Orden detectada: {existingOrders.join(', ')}</span>
          </div>
        )}

        {/* Override manual colapsable */}
        <div>
          <button
            onClick={() => setShowOrderInput((v) => !v)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            {showOrderInput ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Número de orden (manual)
          </button>
          {showOrderInput && (
            <div className="mt-1.5">
              <Input
                placeholder="Ej: 12345 (separar con comas si son varias)"
                value={manualOrder}
                onChange={(e) => setManualOrder(e.target.value)}
                className="text-sm"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Reemplaza la orden detectada automáticamente. Deja vacío para usar la automática.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={handleClose} className="w-full bg-blue-600 hover:bg-blue-700">
            <Lock className="h-4 w-4" /> Cerrar bulto
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onRemoveLast} disabled={count === 0} className="flex-1">
              <Undo2 className="h-4 w-4" /> Quitar último
            </Button>
            <Button variant="outline" onClick={() => setShowReprint(true)} className="flex-1">
              <Printer className="h-4 w-4" /> {Number(bulto.print_count || 0) === 0 ? 'Imprimir' : 'Reimprimir'}
            </Button>
          </div>
        </div>
      </CardContent>
      <ReprintDialog bulto={bulto} open={showReprint} onClose={() => setShowReprint(false)} />
    </Card>
  );
}