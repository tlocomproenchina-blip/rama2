import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHero from '@/components/common/PageHero';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Loader2, PackageOpen } from 'lucide-react';
import IncidentFormCard from '@/components/warehouse/incidents/IncidentFormCard';
import InventoryReviewCard from '@/components/warehouse/incidents/InventoryReviewCard';
import IncidentList from '@/components/warehouse/incidents/IncidentList';
import { downloadWarehouseIncidents } from '@/lib/warehouseIncidentsExport';

// Incidencias de almacén: paquetes que llegan abiertos desde China dentro de un
// contenedor. Uso interno: se registra la foto, el N° de contenedor y el cliente
// con su código, y el historial se puede editar y exportar a Excel.
export default function AdminWarehouseIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await base44.entities.WarehouseIncident.list({ sort: '-reported_date', limit: 200 });
      setIncidents(page?.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const exportExcel = async () => {
    setExporting(true);
    try {
      await downloadWarehouseIncidents(incidents);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHero
        icon={PackageOpen}
        badge="Incidencias de almacén"
        title="Paquetes abiertos"
        description="Registra los paquetes que llegan abiertos desde China con su foto, el N° de contenedor y el cliente. El historial se puede editar y descargar en Excel."
        actions={
          <Button variant="outline" onClick={exportExcel} disabled={exporting || incidents.length === 0}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Exportar a Excel
          </Button>
        }
      />

      <InventoryReviewCard onChanged={load} />

      <IncidentFormCard onSaved={load} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Historial</h2>
          <span className="text-xs text-muted-foreground">{incidents.length} incidencia(s)</span>
        </div>
        <IncidentList incidents={incidents} loading={loading} onChanged={load} />
      </div>
    </div>
  );
}