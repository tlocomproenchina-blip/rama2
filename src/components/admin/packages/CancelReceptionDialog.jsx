import React from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Loader2 } from 'lucide-react';

export default function CancelReceptionDialog({
  pkg,
  processing,
  onOpenChange,
  onConfirm,
}) {
  return (
    <AlertDialog open={!!pkg} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar</AlertDialogTitle>
          <AlertDialogDescription>
            Esto revertirá el paquete a estado <span className="font-semibold">Pre‑alerta</span> y limpiará fecha, usuario y foto de recepción.
            <br />
            Tracking: <span className="font-mono">{pkg?.tracking_number}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={processing}>Cerrar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-rose-600 hover:bg-rose-700"
            disabled={processing}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Procesando...</> : 'Confirmar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}