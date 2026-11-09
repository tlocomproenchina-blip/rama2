import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Hash, Loader2, Lock } from 'lucide-react';
import { lookupContainerNumbers } from '@/lib/containerLookup';

// Confirmación previa al cierre del bulto: deja ver y modificar el número de contenedor
// (el detectado automáticamente o uno ingresado a mano) antes de sellarlo.
export default function CloseBultoDialog({ open, bulto, onConfirm, onCancel }) {
  const [orderText, setOrderText] = useState('');

  const detected = Array.isArray(bulto?.cbm_order_numbers)
    ? bulto.cbm_order_numbers.filter(Boolean)
    : [];

  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open || !bulto) return;
    const own = (Array.isArray(bulto.cbm_order_numbers) ? bulto.cbm_order_numbers : []).filter(Boolean);
    setOrderText(own.join(', '));
    if (own.length) return;
    let cancelled = false;
    setSearching(true);
    lookupContainerNumbers(bulto.client_email, bulto.package_trackings)
      .then((found) => { if (!cancelled && found.length) setOrderText((t) => t || found.join(', ')); })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [open, bulto]);

  if (!bulto) return null;

  const count = bulto.package_ids?.length || (bulto.package_trackings || []).length || 0;
  const cs = bulto.client_snapshot || {};
  const orders = orderText.split(',').map((s) => s.trim()).filter(Boolean);

  const handleConfirm = () => {
    if (orders.length) onConfirm(orders);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> Cerrar bulto
          </DialogTitle>
          <DialogDescription>
            Revisa el número de contenedor antes de cerrar: después de cerrar, el bulto queda sellado y listo para despacho y facturación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="font-mono text-sm font-semibold text-slate-800 break-all">{bulto.shipping_mark || '—'}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Bulto {bulto.bulto_number}/{bulto.total_bultos} · {cs.full_name || bulto.client_email}
            </p>
            <p className="text-xs text-slate-500">{count} paquete(s)</p>
          </div>

          <div>
            <Label htmlFor="close-bulto-order" className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Hash className="h-3.5 w-3.5" /> Número de contenedor
            </Label>
            <Input
              id="close-bulto-order"
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              placeholder="Ej: 12345 (separar con comas si son varias)"
              inputMode="numeric"
              pattern="[0-9, ]*"
              className="mt-1 text-sm font-mono"
              autoFocus
            />
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              {searching && <Loader2 className="h-3 w-3 animate-spin" />}
              {searching
                ? 'Buscando contenedor por los trackings…'
                : detected.length > 0
                  ? `Detectado: ${detected.join(', ')}. Puedes corregirlo antes de cerrar.`
                  : orders.length
                    ? 'Sale impreso en la etiqueta del bulto.'
                    : 'Obligatorio: escribe el N° de contenedor para cerrar e imprimir la etiqueta.'}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!orders.length} className="flex-1 bg-blue-600 hover:bg-blue-700">
            <Lock className="h-4 w-4" /> Cerrar bulto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}