import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import useImageViewer from '@/hooks/useImageViewer';
import { uploadSupportImages } from '@/components/support/supportUploadUtils';
import PackageEditImageField from './PackageEditImageField';

const day = (value) => String(value || '').slice(0, 10);

// El ATC corrige aquí los datos del paquete y adjunta las imágenes. Todo se
// envía a Supervisión: desde Soporte no se aprueba ni se cambia el paquete.
export default function PackageEditRequestDialog({ open, onOpenChange, pkg, clientEmail, clientName, shippingMark, ticket, user, onSaved }) {
  const imageViewer = useImageViewer();
  const [current, setCurrent] = useState(null);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [tracking, setTracking] = useState('');
  const [amount, setAmount] = useState('');
  const [dispatchedDate, setDispatchedDate] = useState('');
  const [insuranceFiles, setInsuranceFiles] = useState([]);
  const [dispatchFiles, setDispatchFiles] = useState([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !pkg) return undefined;
    setTracking(pkg.tracking_number || '');
    setDispatchedDate(day(pkg.dispatched_date));
    setAmount('');
    setInsuranceFiles([]);
    setDispatchFiles([]);
    setNote('');
    setCurrent(null);
    let active = true;
    setLoadingCurrent(true);
    base44.entities.InsurancePayment.filter({ package_id: pkg.id }, '-created_date', 1)
      .then((rows) => {
        const payment = (rows || [])[0] || null;
        if (!active || !payment) return;
        setCurrent(payment);
        setAmount(payment.amount === undefined || payment.amount === null ? '' : String(payment.amount));
      })
      .catch(() => {})
      .finally(() => { if (active) setLoadingCurrent(false); });
    return () => { active = false; };
  }, [open, pkg?.id]);

  const handleSubmit = async () => {
    const nextTracking = tracking.trim();
    const nextTrackingChanged = !!nextTracking && nextTracking !== (pkg.tracking_number || '');
    const amountChanged = amount !== '' && Number(amount) !== Number(current?.amount);
    const dateChanged = !!dispatchedDate && dispatchedDate !== day(pkg.dispatched_date);

    if (!nextTrackingChanged && !amountChanged && !dateChanged && !insuranceFiles.length && !dispatchFiles.length) {
      toast.error('Indica al menos un cambio o adjunta una imagen');
      return;
    }

    setSaving(true);
    try {
      const [insuranceProof] = insuranceFiles.length ? await uploadSupportImages(insuranceFiles, 1) : [];
      const [dispatchProof] = dispatchFiles.length ? await uploadSupportImages(dispatchFiles, 1) : [];

      await base44.entities.PackageEditRequest.create({
        client_email: clientEmail || pkg.client_email || '',
        client_name: clientName || '',
        shipping_mark: shippingMark || pkg.shipping_mark || '',
        package_id: pkg.id,
        tracking_number: pkg.tracking_number || '',
        ticket_id: ticket?.id || null,
        ticket_number: ticket?.ticket_number || '',
        tracking_number_new: nextTrackingChanged ? nextTracking : '',
        insurance_amount: amountChanged ? Number(amount) : null,
        dispatched_date: dateChanged ? dispatchedDate : '',
        insurance_proof: insuranceProof ? { url: insuranceProof.url, name: insuranceProof.name, kind: 'image' } : null,
        dispatch_proof: dispatchProof ? { url: dispatchProof.url, name: dispatchProof.name, kind: 'image' } : null,
        previous_values: {
          tracking_number: pkg.tracking_number || '',
          insurance_amount: current ? Number(current.amount) || 0 : null,
          dispatched_date: day(pkg.dispatched_date),
        },
        note: note.trim(),
        status: 'pendiente',
        requested_by_email: user?.email || '',
        requested_by_name: user?.full_name || user?.email || 'ATC',
        requested_date: new Date().toISOString(),
      });

      toast.success('Cambios enviados a supervisión');
      onOpenChange(false);
      onSaved?.();
    } catch {
      toast.error('No se pudo enviar la solicitud a supervisión');
    }
    setSaving(false);
  };

  if (!pkg) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar datos del paquete</DialogTitle>
          <DialogDescription>
            Tracking {pkg.tracking_number}. Los cambios y las imágenes van a Supervisión para su revisión: la aprobación del seguro la sigue haciendo administración.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-tracking">Número de tracking</Label>
            <Input id="edit-tracking" value={tracking} onChange={(event) => setTracking(event.target.value)} disabled={saving} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-amount">Monto del seguro (USD)</Label>
            <Input
              id="edit-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={saving}
              placeholder="0.00"
            />
            {loadingCurrent ? (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Leyendo el seguro registrado…
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {current
                  ? `Registrado hoy: $${Number(current.amount || 0).toFixed(2)} · ${current.status === 'aprobado' ? 'aprobado por administración' : current.status === 'rechazado' ? 'rechazado' : 'pendiente de aprobación'}`
                  : 'Este paquete todavía no tiene un pago de seguro registrado.'}
              </p>
            )}
          </div>

          <PackageEditImageField
            label="Imagen del pago del seguro"
            hint="Adjuntar el comprobante del seguro"
            currentUrl={current?.proof_url}
            files={insuranceFiles}
            onChange={setInsuranceFiles}
            disabled={saving}
            onView={imageViewer.open}
          />

          <div className="space-y-1.5">
            <Label htmlFor="edit-dispatched">Fecha de despacho en almacén</Label>
            <Input
              id="edit-dispatched"
              type="date"
              value={dispatchedDate}
              onChange={(event) => setDispatchedDate(event.target.value)}
              disabled={saving}
            />
          </div>

          <PackageEditImageField
            label="Imagen de confirmación del despacho"
            hint="Adjuntar la foto del despacho"
            currentUrl={pkg.dispatch_confirmation_image_url}
            files={dispatchFiles}
            onChange={setDispatchFiles}
            disabled={saving}
            onView={imageViewer.open}
          />

          <div className="space-y-1.5">
            <Label htmlFor="edit-note">Nota para Supervisión</Label>
            <Textarea
              id="edit-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={saving}
              placeholder="Qué cambia y por qué…"
            />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
            Enviar a supervisión
          </Button>
        </div>

        {imageViewer.modal}
      </DialogContent>
    </Dialog>
  );
}