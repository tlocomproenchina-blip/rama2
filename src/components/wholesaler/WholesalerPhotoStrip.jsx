import React from 'react';
import { ImageOff } from 'lucide-react';

// Fotos de la carga: son las que la app manda al mayorista dentro del aviso.
export default function WholesalerPhotoStrip({ fotos = [], label = 'Fotos de la carga' }) {
  if (!fotos.length) {
    return (
      <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ImageOff className="h-3.5 w-3.5" />
        {label}: sin fotos
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">
        {label}: {fotos.length}
      </p>
      <div className="flex flex-wrap gap-2">
        {fotos.map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="block h-16 w-16 overflow-hidden rounded-lg border border-border/70"
            title="Ver la foto"
          >
            <img src={url} alt="Foto de la carga" loading="lazy" className="h-full w-full object-cover" />
          </a>
        ))}
      </div>
    </div>
  );
}