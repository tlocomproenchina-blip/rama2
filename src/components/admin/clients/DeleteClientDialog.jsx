import React from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';

export default function DeleteClientDialog({ deleteClient, deleting, onClose, onConfirm }) {
  return (
    <AlertDialog open={!!deleteClient} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            ¿Eliminar Cliente?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Estás a punto de eliminar a{' '}
            <span className="font-semibold text-slate-800">
              {deleteClient?.first_name && deleteClient?.last_name
                ? `${deleteClient.first_name} ${deleteClient.last_name}`
                : deleteClient?.email}
            </span>
            . Esta acción no se puede deshacer.
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm font-medium">
                ⚠️ Se eliminarán en cascada TODOS los datos asociados (paquetes, consolidaciones, facturas, tickets, notificaciones, notas, etc.).
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Eliminando...</>
            ) : (
              <><Trash2 className="h-4 w-4 mr-2" /> Eliminar</>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}