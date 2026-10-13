import React from 'react';
import { Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Muestra el enlace completo del portal (sobre el dominio registrado) para verlo, abrirlo y copiarlo.
// Cuando el enlace en claro no está disponible (no se guarda por seguridad), ofrece regenerarlo.
export default function PortalLinkReveal({ url, onCopy, onRegenerate }) {
  if (!url) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
        <p className="text-xs text-amber-900">
          <span className="font-semibold">Enlace no disponible:</span> por seguridad solo se muestra al generarlo. Regenera
          para ver y copiar uno nuevo.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={onRegenerate}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Regenerar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input readOnly value={url} className="font-mono text-xs" onFocus={(event) => event.target.select()} />
      <div className="flex shrink-0 gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCopy}>
          <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1 h-3.5 w-3.5" /> Abrir
          </a>
        </Button>
      </div>
    </div>
  );
}