import React, { useState } from 'react';
import { Loader2, PackageOpen } from 'lucide-react';
import IncidentCard from './IncidentCard';
import IncidentEditDialog from './IncidentEditDialog';

// Prioridad de atención por tipo: lo faltante primero, luego daños y abiertos.
const TYPE_GROUPS = [
  { key: 'faltante', label: 'Contenido faltante', dot: 'bg-destructive' },
  { key: 'danado', label: 'Paquete dañado', dot: 'bg-primary' },
  { key: 'abierto', label: 'Caja abierta para verificación', dot: 'bg-success' },
  { key: 'otro', label: 'Sin tipo', dot: 'bg-muted-foreground' },
];

// Historial de incidencias registradas en el orden recibido; con groupByType
// se agrupan por tipo según su prioridad, conservando el orden de fecha dentro.
export default function IncidentList({ incidents = [], loading, onChanged, groupByType = false }) {
  const [editing, setEditing] = useState(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-12 text-center">
        <PackageOpen className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Todavía no hay incidencias registradas</p>
        <p className="text-xs text-muted-foreground">Cuando llegue un paquete abierto, regístralo arriba con su foto y su contenedor.</p>
      </div>
    );
  }

  return (
    <>
      {groupByType ? (
        <div className="space-y-6">
          {TYPE_GROUPS.map((group) => {
            const known = ['faltante', 'danado', 'abierto'];
            const rows = incidents.filter((i) =>
              group.key === 'otro' ? !known.includes(i.incident_type) : i.incident_type === group.key
            );
            if (rows.length === 0) return null;
            return (
              <section key={group.key} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${group.dot}`} />
                  <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                  <span className="text-xs text-muted-foreground">{rows.length}</span>
                </div>
                {rows.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} onEdit={setEditing} onDeleted={onChanged} />
                ))}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onEdit={setEditing}
              onDeleted={onChanged}
            />
          ))}
        </div>
      )}

      <IncidentEditDialog
        incident={editing}
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSaved={onChanged}
      />
    </>
  );
}