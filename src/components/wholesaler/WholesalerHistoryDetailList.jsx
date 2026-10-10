import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronUp } from 'lucide-react';

const AVISOS = {
  enviado: { text: 'Aviso enviado al mayorista', className: 'bg-emerald-100 text-emerald-700' },
  fallido: { text: 'Aviso fallido', className: 'bg-rose-100 text-rose-700' },
  omitido: { text: 'Ya se le había avisado', className: 'bg-slate-100 text-slate-600' },
  pendiente: { text: 'Pendiente de devolver', className: 'bg-amber-100 text-amber-700' },
  sin_foto: { text: 'Sin foto de recepción', className: 'bg-amber-100 text-amber-700' },
  no_recibido: { text: 'Aún no recibida en el almacén', className: 'bg-slate-100 text-slate-600' },
  no_aplica: { text: 'Sin carga registrada', className: 'bg-slate-100 text-slate-600' },
};

const RESULTADOS = {
  nuevo: { text: 'Nueva', className: 'bg-emerald-100 text-emerald-700' },
  completado: { text: 'Completada', className: 'bg-sky-100 text-sky-700' },
  alineado: { text: 'Ya alineada', className: 'bg-slate-100 text-slate-600' },
  con_error: { text: 'Con error', className: 'bg-rose-100 text-rose-700' },
};

// Detalle de la última sincronización del historial: cada registro con su titular,
// su estado en TLEC CARGO y cómo quedó su aviso al mayorista.
export default function WholesalerHistoryDetailList({ detail = [] }) {
  const [open, setOpen] = useState(false);
  const [soloAvisadas, setSoloAvisadas] = useState(false);

  if (!Array.isArray(detail) || !detail.length) return null;

  const resumen = detail.reduce((acc, row) => {
    const key = row.aviso || 'no_aplica';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const visibles = soloAvisadas
    ? detail.filter((row) => ['enviado', 'fallido', 'omitido'].includes(row.aviso))
    : detail;

  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-foreground">Detalle por paquete ({detail.length})</span>
        {resumen.enviado > 0 && <Badge className="bg-emerald-100 text-emerald-700">{resumen.enviado} enviada(s)</Badge>}
        {resumen.fallido > 0 && <Badge className="bg-rose-100 text-rose-700">{resumen.fallido} fallida(s)</Badge>}
        {resumen.pendiente > 0 && <Badge className="bg-amber-100 text-amber-700">{resumen.pendiente} pendiente(s)</Badge>}
        {resumen.sin_foto > 0 && <Badge className="bg-amber-100 text-amber-700">{resumen.sin_foto} sin foto</Badge>}
        {resumen.no_recibido > 0 && <Badge className="bg-slate-100 text-slate-600">{resumen.no_recibido} sin recibir</Badge>}
        <Button variant="ghost" size="sm" className="ml-auto gap-1" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {open ? 'Ocultar detalle' : 'Ver detalle'}
        </Button>
      </div>

      {open && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={soloAvisadas} onCheckedChange={(value) => setSoloAvisadas(value === true)} />
            Ver solo las que se le avisaron al mayorista
          </label>
          <div className="space-y-2">
            {visibles.map((row, index) => {
              const aviso = AVISOS[row.aviso] || AVISOS.no_aplica;
              const resultado = RESULTADOS[row.resultado] || RESULTADOS.con_error;
              return (
                <div key={row.package_id || `${row.tracking}-${index}`} className="space-y-1 rounded-lg bg-muted/40 p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-medium break-all text-foreground">{row.tracking || 'sin tracking'}</span>
                    <Badge className={resultado.className}>{resultado.text}</Badge>
                    <Badge className={aviso.className}>{aviso.text}</Badge>
                    {Number(row.fotos) > 0 && <Badge className="bg-sky-100 text-sky-700">{row.fotos} foto(s)</Badge>}
                  </div>
                  <p className="text-muted-foreground">
                    {row.client_email
                      ? `Titular: ${row.client_email}${row.asignado ? ' · asignada en esta corrida' : ''}`
                      : 'Sin titular asignado todavía'}
                    {row.estado ? ` · Estado en TLEC: ${row.estado}` : ''}
                    {row.shipping_mark ? ` · Mark: ${row.shipping_mark}` : ''}
                  </p>
                  {row.mensaje && <p className="text-muted-foreground">{row.mensaje}</p>}
                </div>
              );
            })}
            {!visibles.length && (
              <p className="text-xs text-muted-foreground">En esta corrida no se le avisó ninguna carga al mayorista.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}