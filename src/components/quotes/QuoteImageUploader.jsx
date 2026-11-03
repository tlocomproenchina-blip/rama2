import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Clipboard } from 'lucide-react';
import { uploadImageNoCredits } from '@/lib/imgbbUpload';
import ImageViewerModal from '@/components/common/ImageViewerModal';

export default function QuoteImageUploader({ imageUrl, onChange, disabled }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const url = await uploadImageNoCredits(file);
      onChange(url);
    } catch (err) {
      setError('No se pudo subir la imagen');
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const file = new File([blob], `pasted-${Date.now()}.png`, { type });
            await handleFile(file);
            return;
          }
        }
      }
      setError('No hay imagen en el portapapeles');
    } catch (err) {
      setError('No se pudo acceder al portapapeles');
    }
  };

  if (uploading) {
    return (
      <div className="flex items-center gap-2 text-xs text-purple-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Subiendo...
      </div>
    );
  }

  if (imageUrl) {
    return (
      <div className="flex flex-col items-center gap-1">
        <img
          src={imageUrl}
          alt="producto"
          onClick={() => setViewerOpen(true)}
          className="h-12 w-12 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
          title="Click para ampliar"
        />
        {!disabled && (
          <div className="flex gap-1">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[10px] text-blue-600 hover:underline">
              Cambiar
            </button>
            <button type="button" onClick={() => onChange('')} className="text-[10px] text-red-500 hover:underline">
              Quitar
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
        />
        <ImageViewerModal
          open={viewerOpen}
          imageUrl={imageUrl}
          onClose={() => setViewerOpen(false)}
          title="Imagen del producto"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-wrap gap-1 justify-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="h-8 px-2 text-[11px] gap-1"
        >
          <Upload className="h-3 w-3" /> Subir
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={handlePaste}
          className="h-8 px-2 text-[11px] gap-1"
        >
          <Clipboard className="h-3 w-3" /> Pegar
        </Button>
      </div>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
      />
    </div>
  );
}