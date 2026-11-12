import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { isClosedBox, CLOSED_BOX_LABEL } from '@/lib/incidentTone';

export default function ReviewCard({ review }) {
  const closed = isClosedBox(review.incident_type);
  const issue = review.result === 'recibida_con_incidencia' && !closed;
  const ok = !issue;
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  const photos = review.photos || [];
  return (
    <Card className={`border shadow-card ${ok ? 'border-emerald-200' : 'border-red-200'}`}>
      <CardContent className="p-4 flex gap-3">
        <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className={`text-sm font-semibold ${ok ? 'text-emerald-700' : 'text-red-700'}`}>
            {closed ? CLOSED_BOX_LABEL : ok ? 'Revisión positiva' : `Aviso: ${review.incident_label}`}
          </p>
          <p className="font-mono text-xs text-slate-800 break-all">{review.tracking_number || 'Sin tracking'}</p>
          <p className="text-xs text-slate-500">
            Contenedor: {review.container_number || '—'} · {review.date ? new Date(review.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
          </p>
          {(issue || closed) && review.detail && (
            <p className={`text-sm text-slate-700 rounded-lg px-3 py-2 ${closed ? 'bg-emerald-50' : 'bg-red-50'}`}>{review.detail}</p>
          )}
          {(issue || closed) && photos.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {photos.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border">
                  <img src={url} alt="Foto de la revisión" className="h-20 w-20 object-cover" />
                </a>
              ))}
            </div>
          )}
          {issue && <p className="text-xs text-slate-600">Nuestro equipo ya está al tanto. Contacta a soporte si necesitas más información.</p>}
        </div>
      </CardContent>
    </Card>
  );
}