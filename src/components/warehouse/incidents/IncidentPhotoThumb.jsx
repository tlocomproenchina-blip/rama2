import React from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import useSignedUri from './useSignedUri';

// Miniatura de la foto de la incidencia. La imagen es privada: se abre con un
// enlace firmado temporal generado al mostrar la tarjeta.
export default function IncidentPhotoThumb({ uri }) {
  const url = useSignedUri(uri);

  if (!uri) {
    return (
      <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
        <ImageOff className="h-5 w-5" />
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-border bg-muted">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-border">
      <img src={url} alt="Foto de la incidencia" className="h-24 w-24 object-cover transition hover:opacity-90" />
    </a>
  );
}