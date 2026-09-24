import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { DoorOpen, Loader2 } from 'lucide-react';

// Modal de confirmación simple para aprobar la salida de almacén de un paquete.
export default function DispatchApprovalModal({ open, onOpenChange, packageData, client, onConfirm, processing }) {
  if (!packageData) return null;

  const tracking = packageData.tracking_number || '(sin tracking)';
  const clientName = client?.full_name || packageData.client_email || 'Cliente';
  const mark = packageData.shipping_mark || client?.shipping_mark || '';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <DoorOpen className="h-5 w-5 text-blue-600" />
            Aprobar salida de almacén
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>¿Confirmas la salida de almacén del siguiente paquete?</p>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 space-y-1">
                <p><span className="text-slate-500">Cliente:</span> <span className="font-semibold text-slate-800">{clientName}</span></p>
                {mark && <p><span className="text-slate-500">Shipping Mark:</span> <span className="font-mono font-semibold text-blue-700">{mark}</span></p>}
                <p><span className="text-slate-500">Tracking:</span> <span className="font-mono font-semibold text-slate-800 break-all">{tracking}</span></p>
              </div>
              <p className="text-slate-600">
                Al aprobar, el paquete se marcará como despachado y se notificará al cliente
                que un <strong>transportista fue asignado</strong>.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            disabled={processing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <DoorOpen className="h-4 w-4 mr-2" />}
            Aprobar salida
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}