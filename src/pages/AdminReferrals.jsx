import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Gift, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHero from '@/components/common/PageHero';
import AdminProfilesList from '@/components/referrals/AdminProfilesList';
import PayoutRequestsList from '@/components/referrals/PayoutRequestsList';
import ShipmentsList from '@/components/referrals/ShipmentsList';
import ReferralTerms from '@/components/referrals/ReferralTerms';

const call = async (payload) => {
  const { data } = await base44.functions.invoke('referralProgram', payload).catch((e) => ({ data: e?.response?.data || { error: 'Error' } }));
  if (data?.error) { toast.error(data.error); return null; }
  return data;
};

export default function AdminReferrals() {
  const [data, setData] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const load = async () => setData(await call({ action: 'admin_list' }));
  useEffect(() => { load(); }, []);

  const decideProfile = async (p, decision) => {
    const notes = decision === 'activo' ? '' : (window.prompt('Motivo (opcional)') || '');
    if (await call({ action: 'admin_review_profile', id: p.id, decision, notes })) { toast.success('Registro actualizado'); load(); }
  };
  const decidePayout = async (r, decision) => {
    let payment_reference = '';
    if (decision === 'pagada') { payment_reference = window.prompt('Referencia del pago') || ''; if (!payment_reference) return; }
    const notes = decision === 'rechazada' ? (window.prompt('Motivo del rechazo') || '') : '';
    if (await call({ action: 'admin_review_payout', id: r.id, decision, notes, payment_reference })) { toast.success('Solicitud actualizada'); load(); }
  };
  const sync = async () => {
    setSyncing(true);
    const r = await call({ action: 'admin_sync' });
    setSyncing(false);
    if (r) { toast.success(`${r.processed} facturas revisadas`); load(); }
  };

  if (!data) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  const pendingProfiles = data.profiles.filter((p) => p.status === 'pendiente').length;
  const pendingReqs = data.requests.filter((r) => ['pendiente', 'aprobada'].includes(r.status)).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHero icon={Gift} title="Programa de referidos" description="Registros, envíos computables y solicitudes de cobro ($50 por cada 1 CBM)."
        actions={<Button variant="outline" onClick={sync} disabled={syncing}>{syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />} Recalcular envíos</Button>} />
      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Cobros ({pendingReqs})</TabsTrigger>
          <TabsTrigger value="profiles">Referidores ({pendingProfiles})</TabsTrigger>
          <TabsTrigger value="shipments">Envíos</TabsTrigger>
          <TabsTrigger value="terms">Términos</TabsTrigger>
        </TabsList>
        <TabsContent value="requests" className="mt-4">
          <PayoutRequestsList requests={data.requests} renderActions={(r) => (
            <>
              {r.status === 'pendiente' && <Button size="sm" onClick={() => decidePayout(r, 'aprobada')}>{r.method === 'credito' ? 'Aprobar y acreditar' : 'Aprobar'}</Button>}
              {r.status === 'pendiente' && <Button size="sm" variant="outline" onClick={() => decidePayout(r, 'rechazada')}>Rechazar</Button>}
              {r.status === 'aprobada' && <Button size="sm" onClick={() => decidePayout(r, 'pagada')}>Registrar pago</Button>}
            </>
          )} />
        </TabsContent>
        <TabsContent value="profiles" className="mt-4"><AdminProfilesList profiles={data.profiles} onDecide={decideProfile} /></TabsContent>
        <TabsContent value="shipments" className="mt-4"><ShipmentsList shipments={data.shipments} showReferrer /></TabsContent>
        <TabsContent value="terms" className="mt-4 rounded-xl border bg-card p-6"><ReferralTerms /></TabsContent>
      </Tabs>
    </div>
  );
}