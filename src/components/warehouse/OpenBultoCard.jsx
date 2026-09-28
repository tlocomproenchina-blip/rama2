import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Boxes, Lock, Undo2, Package, Printer, Hash, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import PrintCountBadge from './PrintCountBadge';
import ReprintDialog from './ReprintDialog';
import CloseBultoDialog from './CloseBultoDialog';

// Tarjeta del bulto activo destacado: shipping mark grande, contador,
// lista de trackings, N° de orden editable y botones de cierre/impresión.
export default function OpenBultoCard({ bulto, onClose, onRemoveLast, onOrderChange }) {
  const [showReprint, setShowReprint] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const trackings = bulto.package_trackings || [];
  const count = bulto.package_ids?.length || trackings.length || 0;
  const cs = bulto.client_snapshot || {};

  const existingOrders = Array.isArray(bulto.cbm_order_numbers) ? bulto.cbm_order_numbers.filter(Boolean) : [];

  // N° de orden editable antes de cerrar el bulto (se guarda en el bulto y se
  // refleja en la etiqueta; el diálogo de cierre hace la última revisión).
  const [orderText, setOrderText] = useState(existingOrders.join(', '));
  const [savedOrderText, setSavedOrderText] = useState(existingOrders.join(', '));
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    const text = (Array.isArray(bulto.cbm_order_numbers) ? bulto.cbm_order_numbers.filter(Boolean) : []).join(', ');
    setOrderText(text);
    setSavedOrderText(text);
  }, [bulto.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const orderDirty = orderText.trim() !== savedOrderText.trim();

  const handleSaveOrder = async () => {
    const orders = orderText.split(',').map((s) => s.trim()).filter(Boolean);
    setSavingOrder(true);
    try {
      await onOrderChange?.(orders);
      setSavedOrderText(orders.join(', '));
      toast.success('N° de orden guardado');
    } catch (_) {
      toast.error('No se pudo guardar el N° de orden');
    } finally {
      setSavingOrder(false);
    }
  };

  // El diálogo de cierre devuelve las órdenes ya revisadas/editadas (o null).
  const handleClose = (orders) => {
    setShowCloseDialog(false);
    onClose(orders);
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

        {/* N° de orden: se puede ver y editar antes de cerrar el bulto */}
        <div className="rounded-lg border border-border bg-muted/20 p-2.5 space-y-1.5">
          <Label htmlFor="bulto-order" className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <Hash className="h-3.5 w-3.5" /> N° de orden
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="bulto-order"
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              placeholder="Ej: 12345 (varias separadas por coma)"
              className="h-9 text-sm font-mono"
            />
            <Button
              size="sm"
              onClick={handleSaveOrder}
              disabled={!orderDirty || savingOrder}
              className="shrink-0 bg-blue-600 hover:bg-blue-700"
            >
              {savingOrder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar
            </Button>
          </div>
          <p className="text-[10px] text-slate-400">
            {existingOrders.length > 0
              ? 'Esta es la orden detectada automáticamente. Corrígela si hace falta: se imprime en la etiqueta al cerrar.'
              : 'Ingrésala ahora o revísala al cerrar el bulto.'}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={() => setShowCloseDialog(true)} className="w-full bg-blue-600 hover:bg-blue-700">
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
      <CloseBultoDialog
        open={showCloseDialog}
        bulto={bulto}
        onConfirm={handleClose}
        onCancel={() => setShowCloseDialog(false)}
      />
    </Card>
  );
}