import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { uploadImageNoCredits } from '@/lib/imgbbUpload';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, FileImage } from 'lucide-react';
import { toast } from 'sonner';

export default function InsurePackageModal({ pkg, onClose, onSaved }) {
  const [fobValue, setFobValue] = useState('');
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pkg) {
      setFobValue(pkg.fob_value != null ? String(pkg.fob_value) : '');
      setInvoiceFile(null);
    }
  }, [pkg]);

  const handleSave = async () => {
    const fob = Number(fobValue);
    if (!fobValue || isNaN(fob) || fob <= 0) {
      toast.error('Ingresa el valor FOB de tu carga');
      return;
    }
    if (!invoiceFile && !pkg?.invoice_url) {
      toast.error('Sube la foto de la factura');
      return;
    }
    setSaving(true);
    try {
      let invoiceUrl = pkg?.invoice_url || null;
      if (invoiceFile) {
        invoiceUrl = await uploadImageNoCredits(invoiceFile);
      }
      const updates = { has_insurance: true, fob_value: fob, invoice_url: invoiceUrl };
      await base44.functions.invoke('updateMyPackage', { package_id: pkg.id, updates });
      toast.success('Tu carga ahora está asegurada');
      onSaved?.(pkg.id, updates);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'No se pudo asegurar la carga');
    }
    setSaving(false);
  };

  return (
    <Dialog open={!!pkg} onOpenChange={() => !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
            <Shield className="h-5 w-5 text-emerald-600" />
            {pkg?.has_insurance ? 'Editar seguro' : 'Asegurar carga'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs md:text-sm text-slate-600">
            Sube la foto de la factura de tu compra e indica el valor FOB para asegurar el paquete <span className="font-mono">{pkg?.tracking_number}</span>.
          </p>
          <div>
            <Label>Valor FOB (USD) *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={fobValue}
              onChange={(e) => setFobValue(e.target.value)}
              placeholder="Ej: 150.00"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Foto de la factura *</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
              className="mt-1"
            />
            {!invoiceFile && pkg?.invoice_url && (
              <a
                href={pkg.invoice_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <FileImage className="h-3 w-3" /> Ver factura actual
              </a>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
            {pkg?.has_insurance ? 'Guardar cambios' : 'Asegurar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}