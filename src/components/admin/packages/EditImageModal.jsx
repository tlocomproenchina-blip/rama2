import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, CheckCircle, Image as ImageIcon } from 'lucide-react';
import OptimizedImage from '@/components/OptimizedImage';

export default function EditImageModal({
  pkg,
  newImageFiles,
  setNewImageFiles,
  processing,
  onClose,
  onSubmit,
}) {
  const currentImages = pkg?.package_image_urls && pkg.package_image_urls.length > 0
    ? pkg.package_image_urls
    : (pkg?.package_image_url ? [pkg.package_image_url] : []);

  return (
    <Dialog open={!!pkg} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {pkg?.package_image_url ? 'Reemplazar Foto' : 'Agregar Foto'}
          </DialogTitle>
          <DialogDescription>
            Tracking: {pkg?.tracking_number}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {pkg?.package_image_url && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Fotos actuales</p>
              <div className="grid grid-cols-3 gap-2">
                {currentImages.map((url, idx) => (
                  <div
                    key={idx}
                    className="h-24 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ring-offset-2 hover:ring-2 hover:ring-blue-400 overflow-hidden"
                    onClick={() => window.open(url, '_blank')}
                    title="Click para abrir en tamaño completo"
                  >
                    <OptimizedImage src={url} alt={`Actual ${idx+1}`} className="w-full h-full" />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Agregar fotos (hasta 3 en total)
            </Label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setNewImageFiles(Array.from(e.target.files || []))}
                className="hidden"
                id="edit-pkg-image"
              />
              <label htmlFor="edit-pkg-image" className="cursor-pointer">
                {newImageFiles && newImageFiles.length > 0 ? (
                  <div className="flex items-center justify-center gap-2 text-emerald-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium text-sm">{newImageFiles.length} seleccionado(s)</span>
                  </div>
                ) : (
                  <div className="text-slate-500">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm">Click para subir foto</p>
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={processing || !newImageFiles || newImageFiles.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            {pkg?.package_image_url ? 'Reemplazar' : 'Agregar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}