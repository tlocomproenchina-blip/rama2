import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, CheckCircle, Image as ImageIcon, Trash2 } from 'lucide-react';

export default function ReceivePackageModal({
  pkg,
  imageFiles,
  setImageFiles,
  processing,
  onClose,
  onConfirm,
}) {
  return (
    <Dialog open={!!pkg} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar Recepción o Rechazo</DialogTitle>
          <DialogDescription>
            Puedes continuar con o sin foto del paquete.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-500">Tracking</p>
            <p className="font-mono font-medium">{pkg?.tracking_number}</p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Fotos del paquete (hasta 3)
            </Label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setImageFiles(Array.from(e.target.files || []).slice(0,3))}
                className="hidden"
                id="pkg-image"
              />
              <label htmlFor="pkg-image" className="cursor-pointer">
                {imageFiles && imageFiles.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-center gap-2 text-emerald-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">{imageFiles.length} archivo(s) seleccionados</span>
                  </div>
                ) : (
                  <div className="text-slate-500">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm">Click para subir foto</p>
                    <p className="text-xs mt-1 text-slate-500">Opcional</p>
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col gap-3 sm:flex-col sm:space-x-0">
          <Button onClick={() => onConfirm('recibido')} disabled={processing} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
            {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Confirmar
          </Button>
          <Button onClick={() => onConfirm('rechazado')} disabled={processing} variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">
            {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
            Rechazado
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full">
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}