import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Fila de una etiqueta del cliente con su botón de descarga.
export default function SupportLabelRow({ code, title, subtitle, badge, onDownload }) {
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setBusy(true);
    try {
      await onDownload();
      toast.success(`Etiqueta ${code} descargada`);
    } catch (e) {
      toast.error(`No se pudo generar la etiqueta: ${e?.message || ''}`);
    }
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-xs font-semibold text-foreground">{code}</p>
        <p className="truncate text-xs text-muted-foreground">{title}{subtitle ? ` · ${subtitle}` : ''}</p>
      </div>
      {badge ? <Badge variant="outline" className="text-[10px]">{badge}</Badge> : null}
      <Button size="sm" variant="outline" onClick={handle} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        <span className="ml-1 hidden sm:inline">Descargar</span>
      </Button>
    </div>
  );
}