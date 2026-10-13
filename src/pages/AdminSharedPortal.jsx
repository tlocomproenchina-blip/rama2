import React, { useCallback, useEffect, useState } from 'react';
import { Link2, Plus, Share2, TriangleAlert, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import PageHero from '@/components/common/PageHero';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import AdminPortalLinkCard from '@/components/shared-portal/AdminPortalLinkCard';
import AdminPortalActivityList from '@/components/shared-portal/AdminPortalActivityList';
import PortalLinkFormDialog from '@/components/shared-portal/PortalLinkFormDialog';
import { copyText, portalLinkUrl } from '@/lib/sharedPortalFormat';

const CONFIRMATIONS = {
  revoke: {
    title: '¿Revocar este enlace?',
    description: 'Quien lo tenga abierto dejará de poder consultar de inmediato. Puedes reactivarlo después.',
  },
  regenerate: {
    title: '¿Regenerar el enlace?',
    description: 'El enlace actual deja de funcionar al instante y se genera uno nuevo que solo se muestra una vez.',
  },
  delete: {
    title: '¿Eliminar este enlace?',
    description: 'El enlace desaparece del panel y deja de funcionar. El historial de consultas se conserva.',
  },
};

export default function AdminSharedPortal() {
  const [state, setState] = useState({ loading: true, links: [], logs: [], wholesalers: [] });
  const [dialog, setDialog] = useState({ open: false, link: null });
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState(null);
  const [tokens, setTokens] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [activity, setActivity] = useState({ linkId: '', logs: [], loading: false });

  const call = useCallback(async (payload) => {
    const res = await base44.functions.invoke('sharedPortalAdmin', payload);
    return res?.data || null;
  }, []);

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const data = await call({ action: 'list' });
      if (!data?.ok) throw new Error(data?.error || 'No se pudo cargar los enlaces');
      setState({ loading: false, links: data.links || [], logs: data.logs || [], wholesalers: data.wholesalers || [] });
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false }));
      toast.error(error?.response?.data?.error || error?.message || 'No se pudieron cargar los enlaces');
    }
  }, [call]);

  useEffect(() => {
    load();
  }, [load]);

  const searchClients = useCallback(
    async (q) => {
      try {
        const data = await call({ action: 'options', q });
        return data?.clients || [];
      } catch {
        return [];
      }
    },
    [call]
  );

  const handleSubmit = async (form) => {
    setSaving(true);
    try {
      if (dialog.link) {
        const data = await call({ action: 'update', id: dialog.link.id, ...form });
        if (!data?.ok) throw new Error(data?.error || 'No se pudo guardar');
        toast.success('Enlace actualizado');
      } else {
        const data = await call({ action: 'create', ...form });
        if (!data?.ok) throw new Error(data?.error || 'No se pudo generar el enlace');
        setRevealed({ token: data.token, label: data.link?.label || form.label });
        if (data.link?.id) setTokens((prev) => ({ ...prev, [data.link.id]: data.token }));
        toast.success('Enlace generado');
      }
      setDialog({ open: false, link: null });
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || 'No se pudo guardar el enlace');
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action, link) => {
    if (action === 'reactivate') {
      await call({ action: 'reactivate', id: link.id }).catch(() => null);
      toast.success('Enlace reactivado');
      await load();
      return;
    }
    setConfirm({ action, link });
  };

  const runConfirmed = async () => {
    const target = confirm;
    if (!target) return;
    setSaving(true);
    try {
      const data = await call({ action: target.action, id: target.link.id });
      if (!data?.ok) throw new Error(data?.error || 'No se pudo completar la acción');
      if (target.action === 'regenerate') {
        setRevealed({ token: data.token, label: data.link?.label || target.link.label });
        setTokens((prev) => ({ ...prev, [target.link.id]: data.token }));
      }
      toast.success(
        target.action === 'revoke' ? 'Enlace revocado' : target.action === 'delete' ? 'Enlace eliminado' : 'Enlace regenerado'
      );
      setConfirm(null);
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || 'No se pudo completar la acción');
    } finally {
      setSaving(false);
    }
  };

  const toggleActivity = async (link) => {
    if (activity.linkId === link.id) {
      setActivity({ linkId: '', logs: [], loading: false });
      return;
    }
    setActivity({ linkId: link.id, logs: [], loading: true });
    try {
      const data = await call({ action: 'activity', link_id: link.id });
      setActivity({ linkId: link.id, logs: data?.logs || [], loading: false });
    } catch {
      setActivity({ linkId: link.id, logs: [], loading: false });
      toast.error('No se pudo cargar la actividad del enlace');
    }
  };

  const copyUrl = async (token) => {
    await copyText(portalLinkUrl(token));
    toast.success('Enlace copiado');
  };

  return (
    <div className="space-y-5">
      <PageHero
        icon={Share2}
        badge="Portal compartido"
        title="Portal de Consulta Compartido"
        description="Entrega el tracking a aliados y clientes mayoristas sin darles acceso al sistema: enlaces de solo lectura, con alcance, vencimiento y registro de cada consulta y exportación."
        loadingLabel={state.loading ? 'Cargando enlaces…' : null}
        actions={
          <Button
            type="button"
            onClick={() => setDialog({ open: true, link: null })}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            <Plus className="mr-2 h-4 w-4" /> Generar enlace
          </Button>
        }
      />

      {revealed ? (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Guarda este enlace ahora: no se vuelve a mostrar</p>
              <p className="text-xs text-amber-800">
                Enlace de {revealed.label}. Si lo pierdes, genera uno nuevo desde el enlace del panel.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={portalLinkUrl(revealed.token)} className="font-mono text-xs" />
            <Button type="button" onClick={() => copyUrl(revealed.token)} className="shrink-0 bg-slate-900 text-white hover:bg-slate-800">
              <Copy className="mr-2 h-4 w-4" /> Copiar
            </Button>
          </div>
          <button type="button" onClick={() => setRevealed(null)} className="text-xs font-semibold text-amber-900 underline-offset-4 hover:underline">
            Ya lo guardé, ocultar
          </button>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Enlaces generados</h2>
            <p className="text-xs text-muted-foreground">
              La fecha de recepción queda vacía mientras el tracking no se haya recibido en el almacén; el estado lo refleja.
            </p>
          </div>
        </div>

        {state.loading && state.links.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Cargando enlaces…
          </p>
        ) : null}

        {!state.loading && state.links.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card px-4 py-10 text-center">
            <Link2 className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Todavía no hay enlaces</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Genera un enlace para tus aliados o clientes mayoristas y define qué registros pueden consultar.
            </p>
          </div>
        ) : null}

        {state.links.map((link) => (
          <AdminPortalLinkCard
            key={link.id}
            link={link}
            token={tokens[link.id] || ''}
            activity={activity.linkId === link.id ? activity.logs : null}
            activityLoading={activity.linkId === link.id ? activity.loading : false}
            onEdit={(item) => setDialog({ open: true, link: item })}
            onAction={handleAction}
            onCopy={copyUrl}
            onToggleActivity={toggleActivity}
          />
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="font-display text-lg font-bold text-foreground">Actividad del portal</h2>
        <p className="mb-2 text-xs text-muted-foreground">Últimas consultas, exportaciones y rechazos de todos los enlaces.</p>
        <AdminPortalActivityList logs={state.logs} emptyText="Todavía no hay movimientos registrados." />
      </section>

      <PortalLinkFormDialog
        open={dialog.open}
        link={dialog.link}
        wholesalers={state.wholesalers}
        onSearchClients={searchClients}
        onClose={() => setDialog({ open: false, link: null })}
        onSubmit={handleSubmit}
        saving={saving}
      />

      <AlertDialog open={!!confirm} onOpenChange={(value) => (!value ? setConfirm(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm ? CONFIRMATIONS[confirm.action]?.title : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm ? CONFIRMATIONS[confirm.action]?.description : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirmed} disabled={saving}>
              {saving ? 'Procesando…' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}