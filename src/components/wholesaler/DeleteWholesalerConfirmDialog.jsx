import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Confirmación compartida para eliminar una conexión mayorista o un cliente
// traído del mayorista. El borrado lo ejecuta quien abre el diálogo.
export default function DeleteWholesalerConfirmDialog({ open, onOpenChange, title, description, onConfirm }) {
  const [busy, setBusy] = useState(false);

  const confirm = async (event) => {
    event?.preventDefault();
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={confirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/92"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}