import React, { useRef, useState } from 'react';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { uploadImageNoCredits } from '@/lib/imgbbUpload';

// Cargador de la imagen (JPG/PNG) de la factura del proveedor. Sube a ImgBB (0 créditos).
export default function ProviderInvoiceUploader({ value, onChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
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

  return (
    <div className="space-y-2 border-t pt-3">
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
          <a href={value} target="_blank" rel="noreferrer" className="flex items-center gap-2 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-blue-700 hover:bg-slate-100">
            <ImageIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">Ver imagen cargada</span>
          </a>
          <Button type="button" variant="outline" size="icon" onClick={() => onChange('')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          {uploading ? 'Subiendo...' : 'Cargar imagen (JPG/PNG)'}
        </Button>
      )}
      <p className="text-xs text-slate-500">Opcional. Solo imágenes. Uso interno: se guarda en la cuenta por pagar, el cliente no la ve.</p>
    </div>
  );
}