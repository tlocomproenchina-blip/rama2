import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, AlertTriangle, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { INTEGRATED_APP_ENDPOINT, RESOURCE_DOCS, buildCurlExample } from '@/lib/integratedApps';

function CopyBox({ label, value, multiline, onCopy }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      <div className="flex items-start gap-2 rounded-lg border bg-slate-50 p-2.5">
        {multiline ? (
          <pre className="flex-1 min-w-0 overflow-x-auto text-[11px] leading-relaxed text-slate-700 whitespace-pre">{value}</pre>
        ) : (
          <p className="flex-1 min-w-0 break-all font-mono text-xs text-slate-700">{value}</p>
        )}
        <Button variant="ghost" size="icon" onClick={() => onCopy(value)} className="h-8 w-8 shrink-0">
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function IntegratedAppKeyDialog({ open, app, apiKey, onClose }) {
  const [copied, setCopied] = useState(false);

  const copyValue = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      toast.error('No se pudo copiar. Selecciona el texto y cópialo a mano.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Clave de {app?.name}
          </DialogTitle>
          <DialogDescription>
            Cópiala ahora y guárdala en la copia: no se vuelve a mostrar. Si se pierde, genera una nueva con «Rotar clave».
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs text-amber-800">
              Esta clave da acceso a los datos de esta copia. No la compartas por canales públicos ni la subas a repositorios.
            </p>
          </div>

          <CopyBox label="Clave de acceso" value={apiKey || '—'} onCopy={copyValue} />
          <CopyBox label="Dirección del servicio" value={INTEGRATED_APP_ENDPOINT} onCopy={copyValue} />
          <CopyBox
            label="Prueba rápida (envía la clave en la cabecera x-app-key, o en el cuerpo como app_key)"
            value={buildCurlExample(apiKey)}
            multiline
            onCopy={copyValue}
          />

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600">Datos disponibles</p>
            <div className="flex flex-wrap gap-1.5">
              {RESOURCE_DOCS.map((resource) => (
                <Badge key={resource.key} variant="secondary" className="font-mono text-[10px]">
                  {resource.key}
                </Badge>
              ))}
            </div>
            <ul className="space-y-1">
              {RESOURCE_DOCS.map((resource) => (
                <li key={resource.key} className="text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700">{resource.label}:</span> {resource.detail}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-400">
              Operaciones por dato: list, get, create, update y delete. La copia solo accede a los registros que ella misma creó.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full gap-2 sm:w-auto">
            {copied ? <><Check className="h-4 w-4" /> Copiada</> : 'Listo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}