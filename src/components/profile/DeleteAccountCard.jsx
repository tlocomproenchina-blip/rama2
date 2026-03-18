import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DeleteAccountCard({ userEmail }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const canDelete = confirmText.trim().toUpperCase() === 'ELIMINAR';

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setConfirmText('');
      setDeleting(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);

    try {
      const response = await base44.functions.invoke('deleteMyAccount', {});
      if (response?.data?.success) {
        toast.success('Tu cuenta fue eliminada');
        setOpen(false);
        base44.auth.logout('/Home');
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || 'No se pudo eliminar la cuenta');
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className="border-rose-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="h-5 w-5" />
            Zona de peligro
          </CardTitle>
          <CardDescription>
            Si ya no deseas usar tu cuenta, puedes eliminarla de forma permanente desde aquí.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="destructive" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar mi cuenta
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar cuenta</DialogTitle>
            <DialogDescription>
              Esta acción es permanente. Se eliminarán tu cuenta y tus datos vinculados a <strong>{userEmail}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              Escribe <strong>ELIMINAR</strong> para confirmar.
            </div>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Escribe ELIMINAR"
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={!canDelete || deleting}>
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Eliminar cuenta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}