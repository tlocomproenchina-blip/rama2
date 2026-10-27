import React, { useState } from 'react';
import { Loader2, PackageOpen } from 'lucide-react';
import IncidentCard from './IncidentCard';
import IncidentEditDialog from './IncidentEditDialog';

// Historial de incidencias registradas, de la más reciente a la más antigua.
export default function IncidentList({ incidents = [], loading, onChanged }) {
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

      <IncidentEditDialog
        incident={editing}
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSaved={onChanged}
      />
    </>
  );
}