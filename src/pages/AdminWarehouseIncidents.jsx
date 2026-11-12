import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHero from '@/components/common/PageHero';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Loader2, PackageOpen, ClipboardCheck, Camera } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import InventoryReviewCard from '@/components/warehouse/incidents/InventoryReviewCard';
import ReviewPhotoHistory from '@/components/warehouse/incidents/ReviewPhotoHistory';
import IncidentList from '@/components/warehouse/incidents/IncidentList';
import IncidentSortControls from '@/components/warehouse/incidents/IncidentSortControls';
import IncidentFilterBar, { EMPTY_FILTERS, applyIncidentFilters } from '@/components/warehouse/incidents/IncidentFilterBar';
import { downloadWarehouseIncidents } from '@/lib/warehouseIncidentsExport';

const PAGE_SIZE = 200;

// Incidencias de almacén: paquetes que llegan abiertos desde China dentro de un
// contenedor. Uso interno: se registra la foto, el N° de contenedor y el cliente
// con su código, y el historial se puede editar y exportar a Excel.
export default function AdminWarehouseIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [sortMode, setSortMode] = useState('type');
  const [dateDir, setDateDir] = useState('desc');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [labelByBulto, setLabelByBulto] = useState({});
  const [cursor, setCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const sortField = dateDir === 'asc' ? 'reported_date' : '-reported_date';
  const filtered = applyIncidentFilters(incidents, filters, labelByBulto);

  // Códigos de etiqueta de los bultos de las incidencias, para poder buscarlos.
  useEffect(() => {
    const ids = [...new Set(incidents.map((i) => i.bulto_id).filter(Boolean))];
    if (ids.length === 0) { setLabelByBulto({}); return; }
    let cancelled = false;
    base44.entities.Bulto.filter({ id: { $in: ids } }, { limit: 500 }).then((page) => {
      if (cancelled) return;
      const map = {};
      (page?.items || []).forEach((b) => { map[b.id] = b.label_code; });
      setLabelByBulto(map);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [incidents]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await base44.entities.WarehouseIncident.list({ sort: sortField, limit: PAGE_SIZE });
      setIncidents(page?.items || []);
      setCursor(page?.has_more ? page.next_cursor : null);
    } finally {
      setLoading(false);
    }
  }, [sortField]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await base44.entities.WarehouseIncident.list({ sort: sortField, limit: PAGE_SIZE, cursor });
      setIncidents((prev) => [...prev, ...(page?.items || [])]);
      setCursor(page?.has_more ? page.next_cursor : null);
    } finally {
      setLoadingMore(false);
    }
  };

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

      <Tabs defaultValue="revision" className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="revision" className="gap-1.5"><ClipboardCheck className="h-4 w-4" /> Revisión de inventario</TabsTrigger>
          <TabsTrigger value="incidencias" className="gap-1.5"><PackageOpen className="h-4 w-4" /> Incidencias</TabsTrigger>
          <TabsTrigger value="fotos" className="gap-1.5"><Camera className="h-4 w-4" /> Fotos de revisiones</TabsTrigger>
        </TabsList>

        <TabsContent value="revision">
          <InventoryReviewCard onChanged={load} />
        </TabsContent>

        <TabsContent value="incidencias" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Historial</h2>
              <span className="text-xs text-muted-foreground">{filtered.length === incidents.length ? `${incidents.length} incidencia(s)` : `${filtered.length} de ${incidents.length} incidencia(s)`}</span>
            </div>
            <IncidentSortControls mode={sortMode} dir={dateDir} onModeChange={setSortMode} onDirChange={setDateDir} />
          </div>
          <IncidentFilterBar filters={filters} onChange={setFilters} />
          <IncidentList incidents={filtered} loading={loading} onChanged={load} groupByType={sortMode === 'type'} />
          {cursor && !loading && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cargar más incidencias
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="fotos">
          <ReviewPhotoHistory refreshKey={incidents} />
        </TabsContent>
      </Tabs>

    </div>
  );
}