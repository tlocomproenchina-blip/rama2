import React, { useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, ImagePlus, X } from 'lucide-react';

// Varias fotos (cámara o archivo). Las sube el formulario al guardar.
export default function MultiPhotoPicker({ files, onChange, max = 10, hint }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const add = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    onChange([...files, ...picked].slice(0, max));
  };

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/30 p-3">
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {urls.length ? (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((u, i) => (
            <div key={u} className="relative">
              <img src={u} alt="Foto" className="aspect-square w-full rounded-lg object-cover" />
              <button type="button" aria-label="Quitar foto" onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {files.length < max ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()}>
            <Camera className="h-4 w-4" /> Tomar foto
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => galleryRef.current?.click()}>
            <ImagePlus className="h-4 w-4" /> Elegir archivo
          </Button>
        </div>
      ) : null}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={add} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={add} />
    </div>
  );
}