import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Loader2, Monitor, Smartphone } from 'lucide-react';

// Vista previa del correo tal como se arma en el servidor, antes de confirmar el envío.
export default function CampaignEmailPreview({ html, subject, loading }) {
  const [mobile, setMobile] = useState(false);

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Eye className="h-4 w-4 text-primary" /> Vista previa del correo
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={mobile ? 'ghost' : 'secondary'}
              onClick={() => setMobile(false)}
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mobile ? 'secondary' : 'ghost'}
              onClick={() => setMobile(true)}
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Asunto: <span className="font-medium text-foreground">{subject || 'Sin asunto'}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
          <div className={`mx-auto bg-card transition-all ${mobile ? 'max-w-[380px]' : 'w-full'}`}>
            {html ? (
              <iframe
                title="Vista previa del correo"
                srcDoc={html}
                sandbox=""
                className="h-[620px] w-full rounded-xl border border-border/60 bg-card"
              />
            ) : (
              <div className="flex h-[620px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                {loading ? 'Preparando la vista previa…' : 'La vista previa aparecerá aquí.'}
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          El correo sale con las cuatro imágenes y el aviso de que cargar la fecha y la foto del comprobante es obligatorio desde su recepción para que el seguro sea válido.
        </p>
      </CardContent>
    </Card>
  );
}