import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Pencil, Trash2 } from 'lucide-react';
import IncidentPhotoThumb from './IncidentPhotoThumb';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('es-VE');
};

export default function IncidentCard({ incident, onEdit, onDeleted }) {
  const remove = async () => {
    await base44.entities.WarehouseIncident.delete(incident.id);
    onDeleted?.();
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
        <IncidentPhotoThumb uri={incident.photo_uri} />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">{incident.container_number}</Badge>
            {incident.client_code ? (
              <Badge variant="secondary" className="text-xs">Código {incident.client_code}</Badge>
            ) : null}
            <span className="text-xs text-muted-foreground">{formatDate(incident.reported_date || incident.created_date)}</span>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">{incident.client_name || 'Cliente sin asignar'}</p>
            {incident.client_email ? <p className="text-xs text-muted-foreground">{incident.client_email}</p> : null}
          </div>

          {incident.notes ? <p className="text-sm text-muted-foreground">{incident.notes}</p> : null}

          {incident.reported_by_name || incident.reported_by ? (
            <p className="text-xs text-muted-foreground">Registró: {incident.reported_by_name || incident.reported_by}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-start gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit?.(incident)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar la incidencia?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se borrará el registro del contenedor {incident.container_number}. La foto dejará de estar disponible en la lista.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={remove}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}