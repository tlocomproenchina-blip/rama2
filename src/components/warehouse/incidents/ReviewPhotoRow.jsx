import React from 'react';
import { Badge } from '@/components/ui/badge';
import IncidentPhotoThumb from './IncidentPhotoThumb';
import { CalendarClock, UserCheck } from 'lucide-react';

const fmt = (d) => new Date(d).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const STATES = {
  recibida: { label: 'Sin incidencia', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  recibida_con_incidencia: { label: 'Con incidencia', cls: 'border-red-200 bg-red-50 text-red-700' },
  sin_revisar: { label: 'Sin revisar', cls: 'border-slate-200 bg-slate-50 text-slate-600' },
};

export default function ReviewPhotoRow({ review, bulto }) {
  const state = STATES[review ? review.result : 'sin_revisar'] || STATES.sin_revisar;
  const label = review?.label_code || bulto?.label_code || '—';
  const client = review?.client_name || review?.client_email || bulto?.client_snapshot?.full_name || bulto?.client_email || bulto?.shipping_mark;
  const tracking = review?.tracking_number || (bulto?.package_trackings || []).slice(0, 3).join(', ');
  const date = review?.reviewed_date || review?.created_date ? fmt(review.reviewed_date || review.created_date) : '';
  const photos = review ? [...new Set([review.content_photo_uri, ...(review.damage_photo_uris || [])].filter(Boolean))] : [];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 sm:flex-row sm:items-start">
      <div className="flex flex-wrap gap-2">
        {photos.length ? photos.map((u) => <IncidentPhotoThumb key={u} uri={u} />) : <IncidentPhotoThumb uri="" />}
      </div>
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-medium">{label}</span>
          <Badge variant="outline" className={`text-xs ${state.cls}`}>{state.label}</Badge>
          {review?.source === 'mesa_empaque' && <Badge variant="outline" className="text-xs">Mesa de empaque</Badge>}
        </div>
        {client && <p className="text-foreground">{client}</p>}
        {tracking && <p className="font-mono text-xs text-muted-foreground">{tracking}</p>}
        {review?.notes && <p className="text-xs text-muted-foreground">{review.notes}</p>}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 rounded-xl bg-muted px-2.5 py-1.5 text-xs text-foreground">
          <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
            {review ? (date || 'Sin fecha') : `Creado ${bulto?.created_date ? fmt(bulto.created_date) : '—'}`}
          </span>
          <span className="flex items-center gap-1"><UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
            {review ? (review.reviewed_by_name || review.reviewed_by || 'Revisor no registrado') : 'Aún sin revisor'}
          </span>
        </div>
      </div>
    </div>
  );
}