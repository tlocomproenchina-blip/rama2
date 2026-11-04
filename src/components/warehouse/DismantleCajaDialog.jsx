import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, PackageOpen } from 'lucide-react';
import { toast } from 'sonner';

export default function DismantleCajaDialog({ caja, onClose, onDone }) {
  const [working, setWorking] = useState(false);

  const confirm = async () => {
    setWorking(true);
    const res = await base44.functions.invoke('desarmarCaja', { bulto_id: caja.id }).catch((e) => e?.response || { data: { error: e?.message } });
    setWorking(false);
    if (res?.data?.error) {
      toast.error(res.data.error);
      return;
    }
    toast.success(res?.data?.message || `Caja ${caja.label_code} desarmada`);
    onDone?.();
    onClose();
  };

  return (
    <Dialog open={!!caja} onOpenChange={(o) => !o && !working && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desarmar caja {caja?.label_code}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Los paquetes de esta caja vuelven a quedar sueltos en el almacén y la caja deja de existir. ¿Continuar?
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={working}>Cancelar</Button>
          <Button onClick={confirm} disabled={working} className="bg-amber-600 hover:bg-amber-700">
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageOpen className="h-4 w-4" />} Desarmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}