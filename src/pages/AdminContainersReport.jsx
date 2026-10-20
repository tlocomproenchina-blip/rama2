import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Download, Loader2, Printer, RefreshCw, Search, Boxes } from 'lucide-react';
import { toast } from 'sonner';
import { groupContainersByClient, containerKey, buildSelectionGroups } from '@/lib/containersByClientReport';
import { generateContainersReportPdf } from '@/lib/containersReportPdf';
import ClientContainersCard from '@/components/containers-by-client/ClientContainersCard';

// Pantalla administrativa: contenedores agrupados por cliente. Permite buscar,
// seleccionar clientes completos o contenedores sueltos y exportar solo eso.
export default function AdminContainersReport() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await base44.functions.invoke('getContainersReport', {});
    setRows(res?.data?.rows || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => groupContainersByClient(rows), [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter((group) =>
      [group.name, group.shipping_mark, group.email, ...group.containers.map((row) => row.container)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [groups, search]);

  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  // Solo los contenedores marcados, con totales recalculados para el informe.
  const selectedGroups = useMemo(() => buildSelectionGroups(groups, selectedKeys), [groups, selectedKeys]);

  const selectedContainersOf = (group) =>
    group.containers
      .filter((row) => selectedSet.has(containerKey(group.key, row.container)))
      .map((row) => row.container);

  const toggleContainer = (groupKey, container) => {
    const key = containerKey(groupKey, container);
    setSelectedKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  };

  const exportSelection = async (mode = 'save') => {
    if (!selectedGroups.length) {
      toast.error('Selecciona al menos un contenedor');
      return;
    }
    setExporting(true);
    await generateContainersReportPdf(selectedGroups, 'TLEC CARGO', mode);
    setExporting(false);
    if (mode === 'save') {
      const containersCount = selectedGroups.reduce((sum, group) => sum + group.totalContainers, 0);
      toast.success(`PDF generado con ${containersCount} contenedor(es) de ${selectedGroups.length} cliente(s)`);
    }
  };

  const totalContainers = groups.reduce((sum, group) => sum + group.totalContainers, 0);
  const totalBultos = groups.reduce((sum, group) => sum + group.totalBultos, 0);
  const selectedContainers = selectedGroups.reduce((sum, group) => sum + group.totalContainers, 0);
  const selectedBultos = selectedGroups.reduce((sum, group) => sum + group.totalBultos, 0);

  const stats = [
    { label: 'Clientes', value: groups.length },
    { label: 'Contenedores', value: totalContainers },
    { label: 'Bultos en guías de despacho', value: totalBultos },
    { label: 'Seleccionados', value: `${selectedGroups.length} clientes · ${selectedContainers} cont.` },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">Contenedores por cliente</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Los números de contenedor se agrupan por cliente y los bultos son los que quedaron registrados en las guías de
            despacho. Busca, abre el cliente y marca a mano los contenedores que quieras y exporta solo eso.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Recargar
          </Button>
          <Button variant="outline" onClick={() => exportSelection('print')} disabled={!selectedGroups.length || exporting}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
          <Button onClick={() => exportSelection('save')} disabled={!selectedGroups.length || exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Generar PDF ({selectedContainers} cont.)
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            <p className="text-sm font-bold text-foreground">{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card className="border-border p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por cliente, shipping mark, email o contenedor"
              className="pl-9"
            />
          </div>
          {selectedKeys.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedKeys([])}>
              Limpiar selección
            </Button>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-border px-4 py-14 text-center">
          <Boxes className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {groups.length === 0 ? 'No hay contenedores registrados.' : 'Ningún cliente coincide con la búsqueda.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((group) => (
            <ClientContainersCard
              key={group.key}
              group={group}
              selectedContainers={selectedContainersOf(group)}
              onToggleContainer={toggleContainer}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Selección actual: {selectedGroups.length} cliente(s) · {selectedContainers} contenedor(es) · {selectedBultos} bulto(s).
        El PDF lista en secuencia continua cada contenedor con su cliente, shipping mark, número, bultos y descripción.
      </p>
    </div>
  );
}