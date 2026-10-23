import React, { useRef, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Button } from '@/components/ui/button';
import { Boxes, CheckCircle2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { realPackageCount } from '@/lib/bultoCounts';
import BluetoothPrinter from './BluetoothPrinter';

// Resultado de combinar unidades: se muestra solo la unidad nueva y se imprime
// únicamente su etiqueta. Las unidades combinadas ya no existen, así que no se
// ofrecen para imprimir.
export default function CombinedUnitResultCard({ bulto, onClose }) {
  const [registered, setRegistered] = useState(false);
  const registeringRef = useRef(false);

  const handlePrinted = async () => {
    if (registered || registeringRef.current || !bulto?.id) return;
    registeringRef.current = true;
    try {
      await base44.functions.invoke('registerBultoPrint', { bulto_id: bulto.id });
      setRegistered(true);
    } catch (_) {
      toast.error('La etiqueta salió, pero no se pudo registrar la impresión');
    } finally {
      registeringRef.current = false;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
        <p className="text-xs text-green-800">
          Unidades combinadas en una sola. Imprime solo esta etiqueta nueva.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {bulto?.is_caja ? <Boxes className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
          {bulto?.is_caja ? 'Caja consolidada' : 'Bulto suelto'}
        </p>
        <p className="font-mono text-sm font-semibold break-all">{bulto?.label_code}</p>
        <p className="text-xs text-muted-foreground">
          Bulto {bulto?.bulto_number}/{bulto?.total_bultos} · {realPackageCount(bulto)} paquete(s)
        </p>
        <p className="text-xs text-muted-foreground">
          {bulto?.client_snapshot?.full_name || bulto?.client_email}
        </p>
      </div>

      {bulto?.id && <BluetoothPrinter bultos={[bulto]} onPrinted={handlePrinted} />}

      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  );
}