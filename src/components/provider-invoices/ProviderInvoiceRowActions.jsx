import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ProviderInvoiceEditDialog from './ProviderInvoiceEditDialog';
import { piCall } from '@/lib/providerInvoicesApi';

export default function ProviderInvoiceRowActions({ inv, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const remove = async () => {
    try { await piCall('delete', { id: inv.id }); toast.success('Factura eliminada'); onChanged?.(); }
    catch (err) { toast.error(err?.response?.data?.error || 'No se pudo eliminar'); }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil />Editar</Button>
      <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirm(true)}><Trash2 />Borrar</Button>
      {editing && <ProviderInvoiceEditDialog inv={inv} open={editing} onOpenChange={setEditing} onSaved={onChanged} />}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar la factura {inv.invoice_code}?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer. El enlace público dejará de funcionar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground">Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}