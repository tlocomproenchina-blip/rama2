import React from 'react';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { isOpenBox, OPEN_BOX_LABEL } from '@/lib/incidentTone';

const TYPES = { abierto: OPEN_BOX_LABEL, faltante: 'Contenido faltante', danado: 'Contenido dañado' };

// Incidencia registrada en la revisión de la caja al llegar el contenedor.
// "Caja abierta" es la verificación normal y se muestra en verde.
export default function ClientBultoReception({ reception }) {
  if (!reception || reception.result !== 'recibida_con_incidencia') return null;
  const date = reception.date ? format(new Date(reception.date), 'dd/MM/yyyy') : '';
  const photos = reception.photo_urls || [];
  const routine = isOpenBox(reception.incident_type);
  return (
    <div className={`space-y-2 rounded-xl border p-3 text-xs ${routine ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
      <p className="flex items-center gap-1.5 font-semibold">
        {routine
          ? <><CheckCircle2 className="h-4 w-4" /> Verificada {date}</>
          : <><AlertTriangle className="h-4 w-4" /> Recibida con incidencia {date}</>}
      </p>
      {reception.incident_type ? <p className="font-medium">{TYPES[reception.incident_type] || reception.incident_type}</p> : null}
      {reception.container_number ? <p>Contenedor: {reception.container_number}</p> : null}
      {reception.notes ? <p>{reception.notes}</p> : null}
      {photos.length ? (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              <img src={url} alt="Foto de la verificación" className="aspect-square w-full rounded-lg object-cover" />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}