import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Shield } from 'lucide-react';

export default function PreAlertEditorModal({
  pkg,
  insurance,
  setInsurance,
  fobValue,
  setFobValue,
  invoiceFile,
  setInvoiceFile,
  processing,
  onClose,
  onSave,
}) {
  return (
    <Dialog open={!!pkg} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Seguro y factura</DialogTitle>
          <DialogDescription>
            Tracking: {pkg?.tracking_number}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Checkbox
              id="prealert-insurance"
              checked={insurance}
              onCheckedChange={setInsurance}
            />
            <Label htmlFor="prealert-insurance" className="cursor-pointer">Asegurar esta carga</Label>
          </div>
          <div className="space-y-2">
            <Label>Valor FOB</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Ej: 120"
              value={fobValue}
              onChange={(e) => setFobValue(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Factura</Label>
            <Input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
            />
            {pkg?.invoice_url && !invoiceFile && (
              <a href={pkg.invoice_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
                Ver factura actual
              </a>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={processing}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={processing} className="bg-blue-600 hover:bg-blue-700">
            {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}