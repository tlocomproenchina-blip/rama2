import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Calendar, MapPin, Package, UserCheck } from 'lucide-react';

const fdate = (value) => (value
  ? new Date(value).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '');

// Una carga sin titular tal como la ve el ATC: su tracking, su foto de recepción y
// lo que se sabe de ella en almacén, con la asignación al cliente al alcance.
export default function AssistantOrphanRow({ orphan, onAssign, onViewPhoto }) {
  const photos = Array.isArray(orphan.package_image_urls) ? orphan.package_image_urls : [];

  return (
    <Card className="border-border/70 shadow-card">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Package className={`h-4 w-4 shrink-0 ${orphan.ai_unreadable ? 'text-red-500' : 'text-primary'}`} />
            <span className="break-all font-mono text-sm font-semibold text-foreground">
              {orphan.tracking_number || 'Sin tracking'}
            </span>
            {orphan.shipping_type ? (
              <Badge variant="secondary">{orphan.shipping_type === 'maritimo' ? 'Marítimo' : 'Aéreo'}</Badge>
            ) : null}
            {orphan.shipping_mark ? <Badge variant="outline">SM: {orphan.shipping_mark}</Badge> : null}
            {orphan.ai_unreadable ? (
              <Badge className="gap-1 bg-red-100 text-red-600">
                <AlertTriangle className="h-3 w-3" /> No legible por IA
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {orphan.warehouse_name ? (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {orphan.warehouse_name}
                {orphan.warehouse_location_code ? ` · ${orphan.warehouse_location_code}` : ''}
              </span>
            ) : null}
            {orphan.actual_weight_kg ? <span>{orphan.actual_weight_kg} kg</span> : null}
            {orphan.actual_cbm ? <span>{Number(orphan.actual_cbm).toFixed(4)} CBM</span> : null}
            {orphan.received_date ? (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {fdate(orphan.received_date)}
              </span>
            ) : null}
          </div>

          {orphan.description ? <p className="text-xs text-muted-foreground">{orphan.description}</p> : null}

          {photos.length > 0 ? (
            <div className="flex gap-1.5">
              {photos.map((url, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => onViewPhoto(url)}
                  className="overflow-hidden rounded-lg border border-border/70 transition hover:ring-2 hover:ring-primary/40"
                  title="Ver foto de la carga"
                >
                  <img src={url} alt={`Foto ${index + 1}`} className="h-12 w-12 object-cover" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sin foto de recepción</p>
          )}
        </div>

        <Button onClick={() => onAssign(orphan)} className="shrink-0 gap-2">
          <UserCheck className="h-4 w-4" /> Asignar
        </Button>
      </CardContent>
    </Card>
  );
}