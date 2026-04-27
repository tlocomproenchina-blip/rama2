import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plane, Ship, Loader2, Save } from 'lucide-react';

export default function AddPackageDialog({
  open, onOpenChange,
  packageClient,
  newPackage, setNewPackage,
  uploadingImage,
  onImageUpload,
  saving,
  onSubmit,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agregar Paquete Recibido</DialogTitle>
          <DialogDescription>
            Crear paquete directamente como recibido para {packageClient?.email}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Número de Tracking *</Label>
            <Input
              value={newPackage.tracking_number}
              onChange={(e) => setNewPackage({ ...newPackage, tracking_number: e.target.value })}
              placeholder="Ej: 1234567890"
            />
          </div>

          <div className="space-y-2">
            <Label>Descripción *</Label>
            <Textarea
              value={newPackage.description}
              onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })}
              placeholder="Describe el contenido del paquete"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de Envío</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNewPackage({ ...newPackage, shipping_type: 'aereo' })}
                className={`p-3 rounded-lg border-2 transition-all ${newPackage.shipping_type === 'aereo' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <Plane className={`h-5 w-5 mx-auto mb-1 ${newPackage.shipping_type === 'aereo' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="text-sm font-medium">Aéreo</span>
              </button>
              <button
                type="button"
                onClick={() => setNewPackage({ ...newPackage, shipping_type: 'maritimo' })}
                className={`p-3 rounded-lg border-2 transition-all ${newPackage.shipping_type === 'maritimo' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <Ship className={`h-5 w-5 mx-auto mb-1 ${newPackage.shipping_type === 'maritimo' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="text-sm font-medium">Marítimo</span>
              </button>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <Checkbox
              id="package-insurance"
              checked={newPackage.has_insurance}
              onCheckedChange={(checked) => setNewPackage({ ...newPackage, has_insurance: checked })}
            />
            <div className="flex-1">
              <label htmlFor="package-insurance" className="font-medium text-slate-800 cursor-pointer">
                Asegurar Carga
              </label>
              {newPackage.has_insurance && (
                <div className="mt-2 space-y-2">
                  <Label>Valor FOB (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newPackage.fob_value}
                    onChange={(e) => setNewPackage({ ...newPackage, fob_value: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Imagen del Paquete (Opcional)</Label>
            <div className="flex gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => onImageUpload(e.target.files[0])}
                disabled={uploadingImage}
              />
              {uploadingImage && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
            </div>
            {newPackage.package_image_url && (
              <img src={newPackage.package_image_url} alt="Preview" className="h-32 rounded-lg border" />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Agregar Paquete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}