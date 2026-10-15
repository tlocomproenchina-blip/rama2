import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Copy, Link2 } from 'lucide-react';

export const PUBLIC_GUIDES_PATH = '/GuiasPublicas';

// Enlace único del portal público de guías: cualquier persona con esta dirección
// consulta las guías emitidas sin iniciar sesión y sin clave.
export default function PublicGuidesLinkCard() {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${PUBLIC_GUIDES_PATH}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      setCopied(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-2">
          <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-foreground">Enlace público de consulta</p>
            <p className="text-xs text-muted-foreground">
              Comparte esta dirección para que consulten las guías emitidas: buscador por cliente,
              número de contenedor y bultos. No pide cuenta ni clave.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={link} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={copy} className="shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
            <Button variant="outline" onClick={() => window.open(link, '_blank', 'noopener')} className="shrink-0">
              Abrir
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}