import React from 'react';
import { AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import useSignedUri from '@/components/warehouse/incidents/useSignedUri';
import { isOpenBox, OPEN_BOX_LABEL } from '@/lib/incidentTone';

const TYPE_LABELS = { abierto: 'Caja abierta', faltante: 'Faltante', danado: 'Dañado' };

function Thumb({ uri }) {
  const url = useSignedUri(uri);
  if (!url) return <div className="h-16 w-16 animate-pulse rounded-lg bg-muted" />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="Foto de revisión" className="h-16 w-16 rounded-lg border border-border object-cover" />
    </a>
  );
}

// Resumen de la revisión del paquete: contenido, estado de incidencia, detalle y fotos.
export default function ReviewSummaryCard({ summary }) {
  if (!summary) return null;
  const { description, container, hasIncident, type, notes, contentUri, damageUris = [] } = summary;
  const photos = [contentUri, ...damageUris.filter((u) => u && u !== contentUri)].filter(Boolean);
  const routine = hasIncident && isOpenBox(type);
  const negative = hasIncident && !routine;

  return (
    <div className={`space-y-2 rounded-lg border px-3 py-2 ${negative ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
      <p className={`flex items-center gap-1.5 text-sm font-semibold ${negative ? 'text-rose-700' : 'text-emerald-700'}`}>
        {negative ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        {routine ? OPEN_BOX_LABEL : hasIncident ? `Con incidencia${type ? ` · ${TYPE_LABELS[type] || type}` : ''}` : 'Sin incidencia'}
      </p>
      <div className="flex items-start gap-1.5 text-xs text-slate-700">
        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p className="whitespace-pre-wrap">Contenido: {description || 'Sin descripción registrada'}</p>
      </div>
      {container && <p className="text-xs text-slate-600">Contenedor: <span className="font-mono">{container}</span></p>}
      {hasIncident && notes && <p className={`whitespace-pre-wrap text-xs ${routine ? 'text-emerald-800' : 'text-rose-800'}`}>Detalle: {notes}</p>}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">{photos.map((u) => <Thumb key={u} uri={u} />)}</div>
      )}
    </div>
  );
}