import React, { useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plug, Plus, Loader2, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import IntegratedAppCard from '@/components/integrated-apps/IntegratedAppCard';
import IntegratedAppFormDialog from '@/components/integrated-apps/IntegratedAppFormDialog';
import IntegratedAppKeyDialog from '@/components/integrated-apps/IntegratedAppKeyDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function AdminIntegratedApps() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [keyInfo, setKeyInfo] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const loadApps = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await base44.functions.invoke('manageIntegratedApps', { action: 'list' });
      setApps(data?.apps || []);
    } catch (_) {
      toast.error('No se pudieron cargar las apps integradas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);

  const handleCreate = async (payload) => {
    setSaving(true);
    try {
      const { data } = await base44.functions.invoke('manageIntegratedApps', { action: 'create', ...payload });
      if (!data?.ok) throw new Error(data?.error || 'No se pudo crear la app integrada');
      setShowForm(false);
      setKeyInfo({ app: data.app, key: data.key });
      await loadApps();
    } catch (error) {
      toast.error(error?.message || 'No se pudo crear la app integrada');
    } finally {
      setSaving(false);
    }
  };

  const handleRotate = async (app) => {
    try {
      const { data } = await base44.functions.invoke('manageIntegratedApps', { action: 'rotate', app_id: app.id });
      if (!data?.ok) throw new Error(data?.error || 'No se pudo rotar la clave');
      setKeyInfo({ app: data.app, key: data.key });
      await loadApps();
    } catch (error) {
      toast.error(error?.message || 'No se pudo rotar la clave');
    }
  };

  const handleToggle = async (app) => {
    try {
      const { data } = await base44.functions.invoke('manageIntegratedApps', {
        action: 'toggle',
        app_id: app.id,
        active: !app.active
      });
      if (!data?.ok) throw new Error(data?.error || 'No se pudo cambiar el estado');
      toast.success(data.app.active ? 'App integrada activada' : 'App integrada desactivada');
      await loadApps();
    } catch (error) {
      toast.error(error?.message || 'No se pudo cambiar el estado');
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      const { data } = await base44.functions.invoke('manageIntegratedApps', { action: 'delete', app_id: pendingDelete.id });
      if (!data?.ok) throw new Error(data?.error || 'No se pudo eliminar la conexión');
      toast.success('Conexión eliminada');
      setPendingDelete(null);
      await loadApps();
    } catch (error) {
      toast.error(error?.message || 'No se pudo eliminar la conexión');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Plug className="h-6 w-6 text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Apps Integradas</h1>
          </div>
          <p className="text-sm text-slate-500">
            Conexiones de las copias de TLEC CARGO que guardan sus clientes, pre-alertas, facturas y cobros en esta base de datos. Cada copia solo ve y edita lo que ella misma registró.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Nueva app integrada
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : apps.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center shadow-card">
          <Server className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-700">Todavía no hay apps integradas</p>
          <p className="text-sm text-slate-500 mt-1">
            Crea una para generar su clave de acceso y conectarla con esta base de datos.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {apps.map((app) => (
            <IntegratedAppCard
              key={app.id}
              app={app}
              onRotate={handleRotate}
              onToggle={handleToggle}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      <IntegratedAppFormDialog
        open={showForm}
        saving={saving}
        onClose={() => setShowForm(false)}
        onSubmit={handleCreate}
      />

      <IntegratedAppKeyDialog
        open={!!keyInfo}
        app={keyInfo?.app}
        apiKey={keyInfo?.key}
        onClose={() => setKeyInfo(null)}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la conexión de {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              La copia pierde el acceso al instante y su clave deja de funcionar. Los registros que ya guardó (clientes, pre-alertas, facturas y cobros) siguen en TLEC CARGO.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700">
              Eliminar conexión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}