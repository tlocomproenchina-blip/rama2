import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { computeTotals } from '@/lib/fiscalCalc';
import { buildPayload, formFromRequest, validateLines, validateTaxData } from '@/lib/fiscalForm';
import FiscalTaxDataStep from '@/components/fiscal/FiscalTaxDataStep';
import FiscalLinesStep from '@/components/fiscal/FiscalLinesStep';
import FiscalTotalsSummary from '@/components/fiscal/FiscalTotalsSummary';

// Edición administrativa de datos fiscales y líneas. Cada cambio queda auditado.
export default function FiscalAdminEditDialog({ open, request, busy, onConfirm, onClose }) {
  const [form, setForm] = useState(null);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  useEffect(() => { if (open && request) { setForm(formFromRequest(request)); setNotes(''); setErrors({}); } }, [open, request]);
  const totals = useMemo(() => (form ? computeTotals(form.lines) : null), [form]);
  if (!form) return null;

  const save = () => {
    const e = { ...validateTaxData(form), ...validateLines(form) };
    if (notes.trim().length < 3) e.notes = 'Indica el motivo del cambio';
    setErrors(e);
    if (Object.keys(e).length) return;
    const { vat, ...payload } = buildPayload(form);
    onConfirm({ ...payload, notes: notes.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar datos fiscales</DialogTitle>
          <DialogDescription>Los importes se recalculan en el servidor y el cambio queda registrado en la auditoría.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <FiscalTaxDataStep form={form} setForm={setForm} errors={errors} />
          <FiscalLinesStep form={form} setForm={setForm} error={errors.lines} />
          <FiscalTotalsSummary subtotal={totals.subtotal} vat={totals.vat_amount} total={totals.total} />
          <div className="space-y-1">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Motivo del cambio (obligatorio)" />
            {errors.notes ? <p className="text-xs font-medium text-destructive">{errors.notes}</p> : null}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={busy} onClick={save}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}