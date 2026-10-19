import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, PackageX, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import useOrphanPackages from '@/hooks/useOrphanPackages';
import AssistantOrphanRow from '@/components/support/orphans/AssistantOrphanRow';
import OrphanAssignDialog from '@/components/support/orphans/OrphanAssignDialog';
import ImageViewerModal from '@/components/common/ImageViewerModal';

// Pestaña del ATC para las cargas que llegaron sin titular: las consulta, ve su
// foto de recepción y las asigna a su cliente. Al asignarlas salen de la lista.
export default function AssistantOrphanPanel() {
  const { search, setSearch, rows, loading, loadingMore, hasMore, loadMore, refresh, remove } = useOrphanPackages();
  const [target, setTarget] = useState(null);
  const [photo, setPhoto] = useState(null);

  const handleAssigned = ({ orphan, client, result }) => {
    remove(orphan.id);
    const extra = [];
    if (result?.consolidated) extra.push('pre-alerta del cliente unificada');
    if (result?.recibido) extra.push('quedó recibida en almacén');
    toast.success(`Carga ${orphan.tracking_number} asignada a ${client.email}${extra.length ? ` · ${extra.join(' · ')}` : ''}`);
  };

  return (
    <section className="space-y-5 rounded-3xl border border-border/70 bg-card/40 p-3 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <PackageX className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Paquetes huérfanos</h2>
            <p className="text-xs text-muted-foreground">
              Cargas recibidas en almacén sin pre-alerta y sin cliente. Busca su tracking o su shipping mark y asígnalas a su titular: en cuanto quedan asignadas salen de esta lista.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Actualizar
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por tracking o shipping mark…"
            className="pl-10"
          />
        </div>
        {!loading ? (
          <Badge variant="secondary" className="shrink-0">
            {rows.length} sin titular{hasMore ? '+' : ''}
          </Badge>
        ) : null}
      </div>

      {loading ? (
        <Card className="border-border/70 shadow-card">
          <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando los paquetes sin cliente…
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="border-dashed border-border shadow-none">
          <CardContent className="space-y-2 py-8 text-center text-sm text-muted-foreground">
            <PackageX className="mx-auto h-6 w-6" />
            <p className="font-medium text-foreground">
              {search ? 'No hay coincidencias con esa búsqueda' : 'No hay paquetes sin cliente'}
            </p>
            <p className="text-xs">
              {search
                ? 'Prueba con otro tracking o con el shipping mark del cliente.'
                : 'Cuando llegue una carga sin pre-alerta aparecerá aquí para que la asignes.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((orphan) => (
            <AssistantOrphanRow key={orphan.id} orphan={orphan} onAssign={setTarget} onViewPhoto={setPhoto} />
          ))}
          {hasMore ? (
            <div className="flex justify-center pt-1">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="gap-2">
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Cargar más
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <OrphanAssignDialog
        orphan={target}
        open={!!target}
        onOpenChange={(value) => { if (!value) setTarget(null); }}
        onAssigned={handleAssigned}
      />
      <ImageViewerModal
        open={!!photo}
        imageUrl={photo}
        onClose={() => setPhoto(null)}
        title="Foto de la carga"
      />
    </section>
  );
}