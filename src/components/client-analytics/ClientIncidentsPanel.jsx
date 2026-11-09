import React from 'react';
import { Badge } from '@/components/ui/badge';
import IncidentPhotoThumb from '@/components/warehouse/incidents/IncidentPhotoThumb';
import { isOpenBox, OPEN_BOX_LABEL, OPEN_BOX_BADGE } from '@/lib/incidentTone';

const TYPE_LABEL = { abierto: 'Paquete abierto', faltante: 'Contenido faltante', danado: 'Paquete dañado' };

const fmt = (v) => (v ? new Date(v).toLocaleString('es-VE') : '');

// Incidencias reportadas en almacén para los paquetes del cliente (solo lectura).
export default function ClientIncidentsPanel({ incidents }) {
  if (!incidents.length) {
    return <p className="text-sm text-muted-foreground bg-muted rounded-lg px-4 py-3">Este cliente no tiene incidencias reportadas en sus paquetes.</p>;
  }
  return (
    <div className="grid gap-3">
      {incidents.map((inc) => (
        <div key={inc.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row">
          <IncidentPhotoThumb uri={inc.photo_uri} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {isOpenBox(inc.incident_type)
                ? <Badge variant="outline" className={OPEN_BOX_BADGE}>{OPEN_BOX_LABEL}</Badge>
                : <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{TYPE_LABEL[inc.incident_type] || 'Incidencia'}</Badge>}
              {inc.container_number && <Badge variant="outline" className="font-mono text-xs">{inc.container_number}</Badge>}
              <span className="text-xs text-muted-foreground">{fmt(inc.reported_date || inc.created_date)}</span>
            </div>
            <p className="font-mono text-xs text-foreground break-all">{inc.tracking_number || 'Sin tracking'}</p>
            {inc.notes && <p className="text-sm text-muted-foreground">{inc.notes}</p>}
            {(inc.reported_by_name || inc.reported_by) && (
              <p className="text-xs text-muted-foreground">Registró: {inc.reported_by_name || inc.reported_by}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}