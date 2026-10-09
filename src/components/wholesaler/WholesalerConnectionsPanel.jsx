import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Link2 } from 'lucide-react';
import WholesalerConnectionStatusCard from '@/components/wholesaler/WholesalerConnectionStatusCard';
import WholesalerConnectionDialog from '@/components/wholesaler/WholesalerConnectionDialog';
import DeleteWholesalerConfirmDialog from '@/components/wholesaler/DeleteWholesalerConfirmDialog';

// Sección «Conexiones»: una tarjeta por mayorista, con su estado, su prueba y su
// edición. Cada conexión guarda sus propias direcciones y claves.
export default function WholesalerConnectionsPanel({ connections = [], loading, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [probingId, setProbingId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const remove = async () => {
    try {
      await base44.entities.WholesalerSync.delete(deleting.id);
      toast.success('Conexión eliminada.');
      setDeleting(null);
      await onRefresh();
    } catch (err) {
      toast.error(err?.message || 'No se pudo eliminar la conexión.');
    }
  };

  const probe = async (connection) => {
    setProbingId(connection.id);
    try {
      const res = await base44.functions.invoke('testWholesalerConnection', { connection_id: connection.id });
      const data = res?.data || {};
      if (data.ok) toast.success(data.mensaje || 'Conectado.');
      else toast.error(data.mensaje || data.error || 'No se pudo conectar con ese mayorista.');
      await onRefresh();
    } catch (err) {
      toast.error(err?.message || 'No se pudo probar la conexión.');
    } finally {
      setProbingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
            <Link2 className="h-4 w-4 text-primary" />
            Conexiones
          </h2>
          <p className="text-sm text-muted-foreground">
            Un mayorista por conexión: su nombre, sus direcciones y sus claves. El corte diario recorre todas.
          </p>
        </div>
        <Button onClick={() => setEditing({})} className="gap-2">
          <Plus className="h-4 w-4" />
          Agregar conexión
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : connections.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {connections.map((connection) => (
            <WholesalerConnectionStatusCard
              key={connection.id}
              connection={connection}
              probing={probingId === connection.id}
              onProbe={probe}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Todavía no hay conexiones. Agrega la primera con su nombre, sus direcciones y sus claves.
        </div>
      )}

      <WholesalerConnectionDialog
        open={!!editing}
        connection={editing?.id ? editing : null}
        onClose={() => setEditing(null)}
        onSaved={onRefresh}
      />

      <DeleteWholesalerConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={`Eliminar la conexión ${deleting?.wholesaler_name || 'Cliente mayorista'}`}
        description="Se borra esta conexión con su nombre, sus direcciones y sus claves: el corte diario deja de recorrerla. Los clientes y movimientos ya traídos de ese mayorista se conservan."
        onConfirm={remove}
      />
    </div>
  );
}