import React from 'react';
import { AlertTriangle } from 'lucide-react';

// Vista previa de lo que llevará cada etiqueta continua: el mismo contenido que se
// manda a la impresora (número X/N, datos del cliente y pie con la guía) y el aviso
// de los datos que faltan en la guía para completarlos antes de imprimir.
export default function ContinuousLabelPreview({ client, rangeStart = 1, rangeEnd = 10, guideNumber = '' }) {
  const missing = [
    !client?.full_name && 'nombre',
    !client?.cedula && 'cédula',
    !client?.whatsapp && 'teléfono',
    !client?.address && 'dirección',
    !client?.shipping_mark && 'shipping mark',
  ].filter(Boolean);

  const nameCedula = [client?.full_name, client?.cedula ? `C.I. ${client.cedula}` : '']
    .filter(Boolean)
    .join(' - ');
  const cityState = [client?.city, client?.state].filter(Boolean).join(', ');

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-dashed border-border/80 bg-card/70 px-3 py-3 text-center">
        <p className="font-display text-2xl font-bold text-foreground">
          {rangeStart}/{rangeEnd}
        </p>
        <p className="my-1.5 border-t border-border/70" />
        <p className="text-sm font-semibold text-foreground break-words">
          {nameCedula || 'Cliente sin nombre en la guía'}
        </p>
        {client?.whatsapp ? <p className="text-xs text-muted-foreground">Tel: {client.whatsapp}</p> : null}
        {client?.address ? <p className="text-xs text-muted-foreground break-words">{client.address}</p> : null}
        {cityState ? (
          <p className="text-sm font-semibold text-foreground break-words">{cityState}</p>
        ) : null}
        {client?.shipping_mark ? (
          <p className="mt-1 font-mono text-base font-semibold text-blue-700 break-all">
            MARK: {client.shipping_mark}
          </p>
        ) : null}
        {guideNumber ? (
          <p className="mt-1.5 border-t border-border/70 pt-1 text-[10px] text-muted-foreground">
            GUIA {guideNumber}
          </p>
        ) : null}
      </div>

      {missing.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-[11px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Esta guía no tiene {missing.join(', ')} del cliente. Las etiquetas saldrán sin ese dato; si lo
            necesitas, corrígelo en el perfil del cliente y vuelve a emitir la guía.
          </span>
        </p>
      )}
    </div>
  );
}