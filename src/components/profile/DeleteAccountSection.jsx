import React from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const CONFIRM_TEXT = 'ELIMINAR';

export default function DeleteAccountSection() {
  const [open, setOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState('');
  const [deleting, setDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (confirmText !== CONFIRM_TEXT) {
      toast.error(`Escribe ${CONFIRM_TEXT} para confirmar`);
      return;
    }

    try {
      setDeleting(true);
      const response = await base44.functions.invoke('deleteMyAccount', { confirmation: CONFIRM_TEXT });
      if (response.status !== 200 || !response.data?.success) {
        throw new Error(response.data?.error || 'No se pudo eliminar la cuenta');
      }
      toast.success('Tu cuenta fue eliminada');
      base44.auth.logout('/Home');
    } catch (error) {
      toast.error(error.message || 'No se pudo eliminar la cuenta');
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className="border-rose-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="h-5 w-5" />
            Eliminar cuenta
          </CardTitle>
          <CardDescription>
            Esta acción eliminará tu cuenta de forma permanente y cerrará tu acceso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => setOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Ir a eliminar cuenta
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-rose-700">Confirmación final</DialogTitle>
            <DialogDescription>
              Para eliminar tu cuenta, escribe <strong>{CONFIRM_TEXT}</strong>. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder={`Escribe ${CONFIRM_TEXT}`}
              disabled={deleting}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting || confirmText !== CONFIRM_TEXT}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Eliminar para siempre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}