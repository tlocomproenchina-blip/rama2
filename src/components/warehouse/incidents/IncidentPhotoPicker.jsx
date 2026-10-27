import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, ImagePlus, X } from 'lucide-react';

// Foto de la incidencia: se toma con la cámara del dispositivo o se elige del
// archivo. El formulario es quien la sube (stored privately).
export default function IncidentPhotoPicker({ file, previewUrl, onChange }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const handleFile = (event) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (picked) onChange(picked);
  };

  if (previewUrl) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border">
        <img src={previewUrl} alt="Foto de la incidencia" className="h-44 w-full object-cover" />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
          aria-label="Quitar foto"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-4">
      <p className="text-xs text-muted-foreground">Toma la foto del paquete abierto o elígela de tus archivos.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()}>
          <Camera className="mr-1.5 h-4 w-4" /> Tomar foto
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => galleryRef.current?.click()}>
          <ImagePlus className="mr-1.5 h-4 w-4" /> Elegir archivo
        </Button>
      </div>
      {file ? <p className="truncate text-xs text-foreground">{file.name}</p> : null}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}