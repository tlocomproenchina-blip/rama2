import React, { useRef, useState } from 'react';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X, ImageIcon, Clipboard } from 'lucide-react';
import { toast } from 'sonner';
import { uploadImageNoCredits } from '@/lib/imgbbUpload';
import useImageViewer from '@/hooks/useImageViewer';

// Cargador de la imagen (JPG/PNG) de la factura del proveedor. Sube a ImgBB (0 créditos).
export default function ProviderInvoiceUploader({ value, onChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const imageViewer = useImageViewer();

  const uploadFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes (JPG o PNG)');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImageNoCredits(file);
      onChange(url);
      toast.success('Factura del proveedor cargada');
    } catch (err) {
      toast.error(err.message || 'No se pudo subir la imagen');
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = (e) => uploadFile(e.target.files?.[0]);

  const handlePasteButton = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find((t) => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          await uploadFile(new File([blob], 'pasted-image.png', { type: imgType }));
          return;
        }
      }
      toast.error('No hay ninguna imagen en el portapapeles');
    } catch (_) {
      toast.error('No se pudo leer el portapapeles. Usa Ctrl+V sobre esta sección.');
    }
  };

  const handlePasteEvent = (e) => {
    const file = Array.from(e.clipboardData?.items || [])
      .find((i) => i.type.startsWith('image/'))?.getAsFile();
    if (file) {
      e.preventDefault();
      uploadFile(file);
    }
  };

  return (
    <div className="space-y-2 border-t pt-3" onPaste={handlePasteEvent} tabIndex={-1}>
      <Label className="text-sm">Factura del proveedor (imagen)</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/jpg"
        className="hidden"
        onChange={handleFile}
      />
      {value ? (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => imageViewer.open(value)} className="flex items-center gap-2 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-blue-700 hover:bg-slate-100 cursor-pointer">
            <ImageIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">Ver imagen cargada</span>
          </button>
          <Button type="button" variant="outline" size="icon" onClick={() => onChange('')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {uploading ? 'Subiendo...' : 'Cargar imagen'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={uploading}
            onClick={handlePasteButton}
          >
            <Clipboard className="h-4 w-4 mr-2" />
            Pegar imagen
          </Button>
        </div>
      )}
      <p className="text-xs text-slate-500">Opcional. Solo imágenes. Uso interno: se guarda en la cuenta por pagar, el cliente no la ve.</p>
      {imageViewer.modal}
    </div>
  );
}