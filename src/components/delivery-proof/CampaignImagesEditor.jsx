import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageIcon, Loader2, Upload, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { uploadImageNoCredits } from '@/lib/imgbbUpload';

// Las imágenes del correo: ejemplos del comprobante y la guía dentro de la app.
// Cada espacio acepta un enlace público o una subida desde el equipo.
export default function CampaignImagesEditor({ images, onChange, disabled }) {
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const inputRef = useRef(null);
  const [targetIndex, setTargetIndex] = useState(null);

  const update = (index, patch) => {
    onChange(images.map((img, i) => (i === index ? { ...img, ...patch } : img)));
  };

  const addSlot = () => {
    if (images.length >= 6) return;
    onChange([...images, { url: '', caption: '' }]);
  };

  const removeSlot = (index) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const pickFile = (index) => {
    setTargetIndex(index);
    inputRef.current?.click();
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || targetIndex === null) return;
    setUploadingIndex(targetIndex);
    try {
      const url = await uploadImageNoCredits(file);
      update(targetIndex, { url });
    } catch (error) {
      toast.error(error?.message || 'No se pudo subir la imagen');
    } finally {
      setUploadingIndex(null);
      setTargetIndex(null);
    }
  };

  return (
    <div className="space-y-4">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {images.map((img, index) => (
        <div key={index} className="rounded-2xl border border-border/70 bg-card p-3">
          <div className="flex gap-3">
            <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-muted/40">
              {img.url ? (
                <img src={img.url} alt={img.caption || `Imagen ${index + 1}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Imagen {index + 1}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground"
                  onClick={() => removeSlot(index)}
                  disabled={disabled}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <Input
                value={img.caption || ''}
                onChange={(event) => update(index, { caption: event.target.value })}
                placeholder="Texto que explica la imagen"
                disabled={disabled}
              />

              <div className="flex gap-2">
                <Input
                  value={img.url || ''}
                  onChange={(event) => update(index, { url: event.target.value })}
                  placeholder="Enlace público de la imagen"
                  disabled={disabled}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => pickFile(index)}
                  disabled={disabled || uploadingIndex !== null}
                  className="shrink-0"
                >
                  {uploadingIndex === index ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addSlot} disabled={disabled || images.length >= 6}>
        <Plus className="mr-1 h-4 w-4" /> Agregar imagen
      </Button>
    </div>
  );
}