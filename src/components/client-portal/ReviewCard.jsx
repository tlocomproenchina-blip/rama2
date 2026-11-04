import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

export default function ReviewCard({ review }) {
  const ok = review.result !== 'recibida_con_incidencia';
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <Card className={`border shadow-card ${ok ? 'border-emerald-200' : 'border-amber-300'}`}>
      <CardContent className="p-4 flex gap-3">
        <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className={`text-sm font-semibold ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>
            {ok ? 'Revisión positiva' : `Aviso: ${review.incident_label}`}
          </p>
          <p className="font-mono text-xs text-slate-800 break-all">{review.tracking_number || 'Sin tracking'}</p>
          <p className="text-xs text-slate-500">
            Contenedor: {review.container_number || '—'} · {review.date ? new Date(review.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
          </p>
          {!ok && <p className="text-xs text-slate-600">Nuestro equipo ya está al tanto. Contacta a soporte si necesitas más información.</p>}
        </div>
      </CardContent>
    </Card>
  );
}