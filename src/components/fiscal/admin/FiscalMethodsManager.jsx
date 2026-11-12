import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { fiscalCall } from '@/lib/fiscalApi';
import { invokeErrorMessage } from '@/lib/invokeErrorMessage';
import FiscalVatMethodCard from '@/components/fiscal/FiscalVatMethodCard';
import FiscalMethodForm from '@/components/fiscal/admin/FiscalMethodForm';

export default function FiscalMethodsManager() {
  const [methods, setMethods] = useState(null);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setMethods(await base44.entities.FiscalVatPaymentMethod.filter({}, 'sort_order', 200));
  }, []);
  useEffect(() => { load(); }, [load]);

  const guard = async (fn, ok) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); await load(); } catch (err) { toast.error(invokeErrorMessage(err, 'No se pudo guardar')); } finally { setBusy(false); }
  };

  const save = (values) => guard(async () => {
    const { id, created_date, updated_date, created_by_id, ...data } = values;
    if (id) await base44.entities.FiscalVatPaymentMethod.update(id, data);
    else {
      const max = (methods || []).reduce((m, x) => Math.max(m, x.sort_order || 0), 0);
      await base44.entities.FiscalVatPaymentMethod.create({ ...data, archived: false, sort_order: max + 1 });
    }
    setEditing(null);
  }, 'Método guardado');

  const move = (i, dir) => guard(async () => {
    const list = methods.filter((m) => !m.archived);
    const a = list[i]; const b = list[i + dir];
    if (!a || !b) return;
    await Promise.all([
      base44.entities.FiscalVatPaymentMethod.update(a.id, { sort_order: b.sort_order ?? i + dir }),
      base44.entities.FiscalVatPaymentMethod.update(b.id, { sort_order: a.sort_order ?? i }),
    ]);
  });

  const remove = () => guard(async () => {
    const res = await fiscalCall('deleteMethod', { id: toDelete.id });
    toast.info(res.archived ? 'Tenía pagos vinculados: se archivó en lugar de eliminarse' : 'Método eliminado');
    setToDelete(null);
  });

  if (!methods) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const active = methods.filter((m) => !m.archived);
  const archived = methods.filter((m) => m.archived);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Los métodos activos se muestran al cliente en el paso de pago del IVA, en este orden.</p>
        <Button type="button" onClick={() => setEditing({})}><Plus className="h-4 w-4" /> Nuevo método</Button>
      </div>
      {active.length === 0 ? <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No hay métodos configurados. Los clientes no podrán enviar el pago del IVA hasta que agregues uno.</p> : null}
      {active.map((m, i) => (
        <div key={m.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div className="min-w-0 flex-1"><FiscalVatMethodCard method={m} /></div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={m.active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}>{m.active ? 'Activo' : 'Inactivo'}</Badge>
            <Switch checked={!!m.active} disabled={busy} onCheckedChange={(v) => guard(() => base44.entities.FiscalVatPaymentMethod.update(m.id, { active: v }))} aria-label="Activar o desactivar" />
            <Button type="button" variant="ghost" size="icon" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp className="h-4 w-4" /></Button>
            <Button type="button" variant="ghost" size="icon" disabled={busy || i === active.length - 1} onClick={() => move(i, 1)} aria-label="Bajar"><ArrowDown className="h-4 w-4" /></Button>
            <Button type="button" variant="outline" size="icon" onClick={() => setEditing(m)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
            <Button type="button" variant="outline" size="icon" onClick={() => setToDelete(m)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      ))}
      {archived.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Archivados</p>
          {archived.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border p-3 text-sm">
              <span>{m.name}</span>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => guard(() => base44.entities.FiscalVatPaymentMethod.update(m.id, { archived: false }), 'Método restaurado')}><RotateCcw className="h-4 w-4" /> Restaurar</Button>
            </div>
          ))}
        </div>
      ) : null}
      <FiscalMethodForm open={!!editing} method={editing} busy={busy} onSave={save} onClose={() => setEditing(null)} />
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este método?</AlertDialogTitle>
            <AlertDialogDescription>Si ya tiene pagos de IVA vinculados, se archivará para conservar el historial.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}