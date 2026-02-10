import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function DeleteAccountModal({ open, onClose }) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      toast.error('Debes escribir DELETE para confirmar');
      return;
    }

    setDeleting(true);
    try {
      // Soft delete: update user status
      await base44.auth.updateMe({
        account_status: 'deleted',
        deleted_date: new Date().toISOString()
      });

      toast.success('Cuenta eliminada. Serás desconectado.');
      
      setTimeout(() => {
        base44.auth.logout();
      }, 2000);
    } catch (error) {
      toast.error('Error al eliminar cuenta');
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Eliminar Cuenta Permanentemente
          </DialogTitle>
          <DialogDescription className="text-left space-y-3 pt-2">
            <p className="font-semibold text-slate-800">⚠️ Esta acción es irreversible</p>
            <p>Al eliminar tu cuenta:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
              <li>Perderás acceso permanente a tu cuenta</li>
              <li>Tu perfil y datos personales serán eliminados</li>
              <li>No podrás recuperar tu cuenta después</li>
              <li>Tus paquetes y consolidaciones quedarán en el sistema solo para auditoría administrativa</li>
            </ul>
            <p className="text-red-600 font-semibold text-sm">
              Si tienes paquetes o consolidaciones activas, considera contactar soporte antes de eliminar tu cuenta.
            </p>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Para confirmar, escribe <span className="font-bold text-red-600">DELETE</span></Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Escribe DELETE"
              className="font-mono"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={confirmText !== 'DELETE' || deleting}
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Eliminando...
              </>
            ) : (
              'Eliminar Cuenta'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}