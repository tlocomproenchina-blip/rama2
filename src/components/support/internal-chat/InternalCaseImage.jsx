import React from 'react';
import { ImageIcon } from 'lucide-react';
import useSignedUri from '@/components/warehouse/incidents/useSignedUri';

// Miniatura de una imagen del chat interno: el archivo vive en el almacenamiento
// privado, así que se pide un enlace firmado temporal para mostrarlo.
export default function InternalCaseImage({ image, index = 0, onOpen }) {
  const url = useSignedUri(image?.file_uri);

  return (
    <button
      type="button"
      onClick={() => url && onOpen(url)}
      className="aspect-square overflow-hidden rounded-xl border border-border/70 bg-muted transition hover:opacity-90"
    >
      {url ? (
        <img src={url} alt={image?.name || `Imagen ${index + 1}`} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
        </span>
      )}
    </button>
  );
}