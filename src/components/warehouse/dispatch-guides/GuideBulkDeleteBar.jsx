import React, { useState } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Barra de selección múltiple del historial: marcar todas y eliminar las elegidas.
export default function GuideBulkDeleteBar({ guides, selectedIds, onSelectAll, onClear, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const count = selectedIds.length;
  const allSelected = guides.length > 0 && guides.every((g) => selectedIds.includes(g.id));

  const handleDelete = async (e) => {
    e.preventDefault();
    setDeleting(true);
    try {
      const res = await base44.functions.invoke('deleteDispatchGuide', { guide_ids: selectedIds });
      const { deleted = [], failed = [] } = res.data || {};
      toast.success(`${deleted.length} guía(s) eliminada(s)`);
      if (failed.length) toast.error(`${failed.length} guía(s) no se pudieron eliminar`);
      setOpen(false);
      onDeleted?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'No se pudieron eliminar las guías');
    }
    setDeleting(false);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2">
      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
        <Checkbox checked={allSelected} onCheckedChange={(v) => (v ? onSelectAll() : onClear())} />
        {count ? `${count} seleccionada(s)` : 'Seleccionar todas'}
      </label>
      {count > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={onClear}>
            <X className="h-4 w-4" /> Quitar selección
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
            <Trash2 className="h-4 w-4" /> Eliminar {count}
          </Button>
        </div>
      )}
      <AlertDialog open={open} onOpenChange={(v) => !deleting && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {count} guía(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Las guías se borrarán del historial y sus bultos escaneados volverán a quedar pendientes de guía. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}