import React from 'react';
import { Loader2, RefreshCw, ImageOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Aviso de foto perdida en un escaneo. La foto nunca se descarta en silencio:
// queda el código en rojo con la opción de reintentar la subida.
// Sin `onSkip` el código NO se procesa (pantallas estrictas: empacado, despacho
// y escaneo de N° de orden). Con `onSkip` se puede continuar de forma consciente
// sin esa foto (recepción, registro de paquete y escaneo de bodega).
export default function ScanPhotoFailureNotice({
  codes = [],
  retrying = false,
  onRetry,
  onSkip,
  skipLabel = 'Continuar sin foto',
  description,
}) {
  if (!codes.length) return null;

  return (
    <Card className="border-rose-300 bg-rose-50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <ImageOff className="h-6 w-6 shrink-0 text-rose-600" />
          <div className="min-w-0">
            <p className="font-semibold text-rose-700">No se pudo subir la foto</p>
            <p className="text-sm text-rose-600 break-words">
              {codes.length === 1 ? 'El código ' : 'Los códigos '}
              <span className="font-mono break-all">{codes.join(', ')}</span>
              {codes.length === 1 ? ' quedó sin foto.' : ' quedaron sin foto.'}{' '}
              {description || (onSkip
                ? 'Reintenta la subida o continúa sin foto de forma consciente.'
                : 'Reintenta la subida para poder procesarlo.')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onRetry} disabled={retrying} className="bg-rose-600 hover:bg-rose-700">
            {retrying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Reintentar foto
          </Button>
          {onSkip && (
            <Button variant="outline" onClick={onSkip} disabled={retrying}>
              {skipLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}