import React from 'react';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

// Resultado de la revisión de la caja al llegar el contenedor.
export default function ClientBultoReception({ reception }) {
  if (!reception) return null;
  const ok = reception.result === 'recibida';
  const date = reception.date ? format(new Date(reception.date), 'dd/MM/yyyy') : '';
  if (ok) {
    return (
      <p className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
        <CheckCircle2 className="h-4 w-4" /> Recibida y revisada {date}
      </p>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
      <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4" /> Recibida con incidencia {date}</p>
      {reception.container_number ? <p>Contenedor: {reception.container_number}</p> : null}
      {reception.notes ? <p>{reception.notes}</p> : null}
      {reception.photo_url ? (
        <a href={reception.photo_url} target="_blank" rel="noreferrer">
          <img src={reception.photo_url} alt="Foto de la incidencia" className="max-h-56 rounded-lg object-cover" />
        </a>
      ) : null}
    </div>
  );
}