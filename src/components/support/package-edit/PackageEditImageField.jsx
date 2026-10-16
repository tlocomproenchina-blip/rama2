import React from 'react';
import { ImageIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import SupportImageUploader from '@/components/support/SupportImageUploader';

// Campo de imagen de la solicitud: muestra lo que ya tiene el paquete (si hay
// algo) y deja adjuntar la imagen nueva que Supervisión va a revisar.
export default function PackageEditImageField({ label, hint, currentUrl, files, onChange, disabled, onView }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {currentUrl ? (
        <button
          type="button"
          onClick={() => onView(currentUrl)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline"
        >
          <ImageIcon className="h-3.5 w-3.5" /> Ver la imagen que está cargada hoy
        </button>
      ) : (
        <p className="text-[11px] text-muted-foreground">Todavía no hay imagen cargada.</p>
      )}
      <SupportImageUploader files={files} onChange={onChange} disabled={disabled} maxFiles={1} label={hint} />
    </div>
  );
}