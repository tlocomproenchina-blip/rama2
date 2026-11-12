import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PAYMENT_TYPES } from '@/lib/fiscalStatus';
import FiscalField from '@/components/fiscal/FiscalField';

const EMPTY = { name: '', payment_type: 'transferencia', bank_platform: '', holder: '', holder_id: '', account_identifier: '', instructions: '', active: true };

export default function FiscalMethodForm({ open, method, busy, onSave, onClose }) {
  const [f, setF] = useState(EMPTY);
  useEffect(() => { if (open) setF({ ...EMPTY, ...(method || {}) }); }, [open, method]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{method?.id ? 'Editar método de pago' : 'Nuevo método de pago del IVA'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <FiscalField label="Nombre del método *"><Input value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={80} placeholder="Ej: Transferencia Banco X" /></FiscalField>
          <FiscalField label="Tipo de pago">
            <Select value={f.payment_type} onValueChange={(v) => set('payment_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </FiscalField>
          <FiscalField label="Banco o plataforma"><Input value={f.bank_platform} onChange={(e) => set('bank_platform', e.target.value)} maxLength={80} /></FiscalField>
          <FiscalField label="Titular o beneficiario"><Input value={f.holder} onChange={(e) => set('holder', e.target.value)} maxLength={120} /></FiscalField>
          <FiscalField label="Identificación del titular (cédula / RIF)"><Input value={f.holder_id} onChange={(e) => set('holder_id', e.target.value)} maxLength={30} /></FiscalField>
          <FiscalField label="Número de cuenta, teléfono o dirección de pago"><Input value={f.account_identifier} onChange={(e) => set('account_identifier', e.target.value)} maxLength={160} /></FiscalField>
          <FiscalField label="Instrucciones adicionales"><Textarea rows={3} value={f.instructions} onChange={(e) => set('instructions', e.target.value)} maxLength={500} /></FiscalField>
          <label className="flex items-center gap-3 text-sm font-medium"><Switch checked={!!f.active} onCheckedChange={(v) => set('active', v)} /> Activo (visible para los clientes)</label>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={busy || !f.name.trim()} onClick={() => onSave({ ...f, name: f.name.trim() })}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}