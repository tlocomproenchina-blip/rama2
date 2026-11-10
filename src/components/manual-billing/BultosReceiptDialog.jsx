import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { prefillFromBultos } from '@/lib/receiptFromBultos';

// Precarga los datos de los bultos y pide solo lo que falta (N° de contenedor y/o CBM).
export default function BultosReceiptDialog({ open, onOpenChange, bultos, saving, onConfirm }) {
  const [pre, setPre] = useState(null);
  const [code, setCode] = useState('');
  const [cbm, setCbm] = useState('');

  useEffect(() => {
    if (!open) return;
    const p = prefillFromBultos(bultos);
    setPre(p);
    setCode(p.invoice_number);
    setCbm(p.cbm > 0 ? String(p.cbm) : '');
  }, [open, bultos]);

  if (!pre) return null;
  const needCode = !pre.invoice_number;
  const needCbm = !(pre.cbm > 0);
  const ready = code.trim() && Number(cbm) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Crear recibo con {bultos.length} bulto(s)</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-3">
            <span className="text-muted-foreground">Paquetes</span><span className="font-semibold">{pre.package_count}</span>
            <span className="text-muted-foreground">Trackings</span><span className="font-semibold">{pre.trackings.length}</span>
            <span className="text-muted-foreground">Fecha</span><span className="font-semibold">{String(pre.fecha).slice(0, 10)}</span>
            {!needCode && <><span className="text-muted-foreground">N° contenedor</span><span className="font-semibold">{pre.invoice_number}</span></>}
            {!needCbm && <><span className="text-muted-foreground">CBM</span><span className="font-semibold">{pre.cbm}</span></>}
          </div>
          {(needCode || needCbm) && <p className="text-xs text-destructive">Completa los datos que faltan para crear el recibo.</p>}
          {needCode && (
            <div className="space-y-1"><Label>N° de contenedor (recibo)</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej: TLLU1234567" /></div>
          )}
          {needCbm && (
            <div className="space-y-1"><Label>CBM</Label><Input type="number" step="0.0001" min="0" value={cbm} onChange={(e) => setCbm(e.target.value)} /></div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button disabled={!ready || saving} onClick={() => onConfirm({ invoiceNumber: code, cbm: Number(cbm) })}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Crear recibo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}