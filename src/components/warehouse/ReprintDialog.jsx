import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Printer, AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import BluetoothPrinter from './BluetoothPrinter';

const REASONS = ['Etiqueta dañada', 'Se perdió', 'Error de impresión', 'Otra'];

// Diálogo de impresión/reimpresión de etiqueta de bulto.
// Maneja los 4 casos según print_count y reprint_unlocked:
// 0 → primera impresión (libre)
// 1-2 → reimpresión con motivo
// 3 sin unlock → solicitar aprobación de admin
// 3 con unlock → reimpresión aprobada (una vez)
// deviceId: la pantalla /BultoOrderScan abre sin sesión; en ese caso el backend
// registra la impresión a nombre del dispositivo.
export default function ReprintDialog({ bulto, open, onClose, onRegistered, deviceId }) {
  const count = Number(bulto?.print_count || 0);
  const unlocked = !!bulto?.reprint_unlocked;
  const isBlocked = count >= 3 && !unlocked;

  const [reason, setReason] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [step, setStep] = useState(count === 0 || (count >= 3 && unlocked) ? 'print' : 'select');
  const [submitting, setSubmitting] = useState(false);
  const [requested, setRequested] = useState(false);

  const handlePrinted = useCallback(async () => {
    if (!bulto?.id) { onClose(); return; }
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('registerBultoPrint', {
        bulto_id: bulto.id,
        reason: count > 0 ? reason : null,
        reason_detail: reason === 'Otra' ? reasonDetail : null,
        device_id: deviceId || undefined
      });
      if (res?.data?.error) {
        toast.error(res.data.error);
      } else {
        toast.success(`Impresión registrada (${(count + 1)}x)`);
        onRegistered?.(res?.data?.bulto);
      }
    } catch (_) {
      toast.error('No se pudo registrar la impresión');
    } finally {
      setSubmitting(false);
      onClose();
    }
  }, [bulto, count, reason, reasonDetail, onRegistered, onClose, deviceId]);

  const handleRequestApproval = useCallback(async () => {
    if (!reason) { toast.error('Selecciona un motivo'); return; }
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('requestBultoReprintApproval', {
        bulto_id: bulto.id,
        reason,
        reason_detail: reason === 'Otra' ? reasonDetail : null,
        device_id: deviceId || undefined
      });
      if (res?.data?.error) {
        toast.error(res.data.error);
      } else {
        toast.success('Solicitud enviada. Un admin debe aprobar la reimpresión.');
        setRequested(true);
      }
    } catch (_) {
      toast.error('No se pudo enviar la solicitud');
    } finally {
      setSubmitting(false);
    }
  }, [bulto, reason, reasonDetail, deviceId]);

  const handleClose = () => {
    setReason('');
    setReasonDetail('');
    setStep(count === 0 || (count >= 3 && unlocked) ? 'print' : 'select');
    setRequested(false);
    onClose();
  };

  if (!bulto) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            {count === 0 ? 'Imprimir etiqueta' : `Reimprimir etiqueta (${count}x impresa)`}
          </DialogTitle>
        </DialogHeader>

        {requested ? (
          <div className="space-y-3 text-center py-4">
            <ShieldCheck className="h-10 w-10 mx-auto text-blue-500" />
            <p className="text-sm text-slate-700 font-medium">Solicitud enviada</p>
            <p className="text-xs text-slate-500">
              Un administrador debe aprobar esta reimpresión en la página de Auditoría de Impresiones.
              Una vez aprobada, podrás reimprimir una vez más.
            </p>
            <Button onClick={handleClose} className="w-full">Entendido</Button>
          </div>
        ) : isBlocked ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                <p className="font-medium">Límite de reimpresiones alcanzado (3)</p>
                <p className="text-xs mt-0.5">Debes solicitar aprobación de un admin para reimprimir.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Motivo de la reimpresión *</Label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecciona un motivo…</option>
                {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {reason === 'Otra' && (
                <textarea
                  value={reasonDetail}
                  onChange={(e) => setReasonDetail(e.target.value)}
                  placeholder="Describe el motivo…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={2}
                />
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancelar</Button>
              <Button onClick={handleRequestApproval} disabled={submitting || !reason} className="bg-blue-600 hover:bg-blue-700">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Solicitar aprobación
              </Button>
            </DialogFooter>
          </div>
        ) : step === 'select' ? (
          <div className="space-y-4">
            <div className="text-sm text-slate-600 space-y-1">
              <p>Etiqueta: <span className="font-mono">{bulto.label_code}</span></p>
              <p>Cliente: {bulto.client_snapshot?.full_name || bulto.client_email}</p>
              <p>Impresiones anteriores: <strong>{count}</strong></p>
            </div>
            <div className="space-y-2">
              <Label>Motivo de la reimpresión *</Label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecciona un motivo…</option>
                {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {reason === 'Otra' && (
                <textarea
                  value={reasonDetail}
                  onChange={(e) => setReasonDetail(e.target.value)}
                  placeholder="Describe el motivo…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={2}
                />
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={() => setStep('print')} disabled={!reason} className="bg-blue-600 hover:bg-blue-700">
                Continuar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {count >= 3 && unlocked && (
              <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div className="text-sm text-green-700">
                  <p className="font-medium">Reimpresión aprobada por admin</p>
                  <p className="text-xs mt-0.5">Esta es tu única impresión extra disponible.</p>
                </div>
              </div>
            )}
            <div className="text-sm text-slate-600 space-y-1">
              <p>Etiqueta: <span className="font-mono">{bulto.label_code}</span></p>
              <p>Cliente: {bulto.client_snapshot?.full_name || bulto.client_email}</p>
              {count > 0 && reason && (
                <p className="text-xs">Motivo: <strong>{reason}</strong>{reason === 'Otra' && reasonDetail ? ` — ${reasonDetail}` : ''}</p>
              )}
            </div>
            <BluetoothPrinter bultos={[bulto]} onPrinted={handlePrinted} />
            {submitting && <p className="text-xs text-center text-slate-500">Registrando impresión…</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}