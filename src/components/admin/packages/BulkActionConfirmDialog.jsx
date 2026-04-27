import React from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Loader2 } from 'lucide-react';

export default function BulkActionConfirmDialog({
  open,
  onOpenChange,
  bulkAction,
  bulkStatus,
  selectedCount,
  bulkProcessing,
  onConfirm,
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Acción Masiva</AlertDialogTitle>
          <AlertDialogDescription>
            {bulkAction === 'delete' ? (
              <>
                Estás a punto de <span className="font-semibold text-red-600">eliminar {selectedCount} paquete(s)</span>.
                Esta acción no se puede deshacer.
              </>
            ) : bulkAction === 'status' ? (
              <>
                Cambiarás el estado de <span className="font-semibold">{selectedCount} paquete(s)</span> a{' '}
                <span className="font-semibold text-blue-600">{bulkStatus}</span>.
                {['en_transito', 'disponible', 'entregado'].includes(bulkStatus) && ' Los clientes serán notificados.'}
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={bulkProcessing}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={bulkProcessing}
            className={bulkAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
          >
            {bulkProcessing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>
            ) : (
              <>Confirmar</>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}