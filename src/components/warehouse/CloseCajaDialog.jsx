import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Hash, Loader2, Lock } from 'lucide-react';
import { lookupContainerNumbers } from '@/lib/containerLookup';

// Antes de cerrar la caja se confirma el N° de contenedor que va impreso en sus
// etiquetas: el que ya trae, el que se encuentra por sus trackings o uno escrito a mano
// (las cajas con etiqueta manual no tienen tracking para buscarlo).
export default function CloseCajaDialog({ open, caja, onConfirm, onCancel }) {
  const [orderText, setOrderText] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open || !caja) return;
    const own = (caja.cbm_order_numbers || []).filter(Boolean);
    setOrderText(own.join(', '));
    if (own.length) return;
    let cancelled = false;
    setSearching(true);
    lookupContainerNumbers(caja.client_email, caja.package_trackings)
      .then((found) => { if (!cancelled && found.length) setOrderText((t) => t || found.join(', ')); })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [open, caja]);

  if (!caja) return null;
  const orders = orderText.split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="h-4 w-4" /> Cerrar caja</DialogTitle>
          <DialogDescription>
            El número de contenedor sale impreso en las etiquetas de la caja.
          </DialogDescription>
        </DialogHeader>
        <div>
          <p className="mb-2 font-mono text-sm font-semibold text-foreground break-all">{caja.label_code}</p>
          <Label htmlFor="close-caja-order" className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Hash className="h-3.5 w-3.5" /> Número de contenedor
          </Label>
          <Input
            id="close-caja-order"
            value={orderText}
            onChange={(e) => setOrderText(e.target.value)}
            placeholder="Ej: 338 (separar con comas si son varios)"
            inputMode="numeric"
            className="mt-1 font-mono text-sm"
            autoFocus
          />
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            {searching && <Loader2 className="h-3 w-3 animate-spin" />}
            {searching ? 'Buscando contenedor por los trackings…' : orders.length ? 'Puedes corregirlo antes de cerrar.' : 'No se encontró contenedor: escríbelo para que salga en la etiqueta.'}
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
          <Button onClick={() => onConfirm(orders)} disabled={!orders.length} className="flex-1">
            <Lock className="h-4 w-4" /> Cerrar caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}