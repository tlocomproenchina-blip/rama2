import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Printer } from 'lucide-react';

// variant 'card': tarjeta lateral de escritorio (en móvil no se muestra: ahí el
// resumen vive en la ventana flotante que abre el botón compacto).
// variant 'sheet': contenido de esa ventana flotante, donde el título lo pone el Sheet.
export default function DispatchGuideSummary({ summary, selectedClients, generating, onGenerate, disabled = false, variant = 'card' }) {
  const isSheet = variant === 'sheet';
  const counts = [
    ['Clientes', summary.clients],
    ['Bultos', summary.bultos],
    ['Paquetes', summary.packages],
  ];

  return (
    <div className={isSheet ? 'space-y-3' : 'sticky bottom-2 z-10 hidden space-y-3 rounded-2xl border border-border/70 bg-card/95 p-4 shadow-card lg:bottom-auto lg:top-4 lg:block'}>
      {!isSheet && (
        <div>
          <p className="text-sm font-semibold text-slate-800">Resumen de la guía</p>
          <p className="text-xs text-slate-500">Un solo PDF continuo con los clientes marcados.</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        {counts.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/70 py-2">
            <p className="text-lg font-bold text-slate-800">{value}</p>
            <p className="text-[11px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {summary.unregistered > 0 && (
        <p className="text-[11px] text-amber-700">
          {summary.unregistered} código(s) escaneado(s) sin bulto registrado: verificar antes de entregar.
        </p>
      )}

      {selectedClients.length > 0 && (
        <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-2">
          {selectedClients.map((client) => (
            <p key={client.client_key} className="text-[11px] text-slate-600 break-all">
              {client.client_name || client.client_email} · {client.totals?.bultos || 0} bulto(s)
            </p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Button className="w-full" onClick={() => onGenerate('save')} disabled={!summary.clients || Boolean(generating) || disabled}>
          {generating === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Generar guía de despacho
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onGenerate('print')}
          disabled={!summary.clients || Boolean(generating) || disabled}
        >
          {generating === 'print' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
          Imprimir
        </Button>
      </div>

      {disabled ? (
        <p className="text-[11px] text-amber-700">
          Sin conexión no se emiten guías nuevas. Revisa el historial para reimprimir una guía ya emitida.
        </p>
      ) : (
        !summary.clients && <p className="text-[11px] text-slate-400">Marca los clientes que van en la guía.</p>
      )}
    </div>
  );
}