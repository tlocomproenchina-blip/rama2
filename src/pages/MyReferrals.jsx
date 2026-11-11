import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Gift, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ClientPageHero from '@/components/client-portal/ClientPageHero';
import ReferrerRegisterCard from '@/components/referrals/ReferrerRegisterCard';
import ReferralCodeCard from '@/components/referrals/ReferralCodeCard';
import ReferredList from '@/components/referrals/ReferredList';
import LinkReferrerCard from '@/components/referrals/LinkReferrerCard';
import ProgressCard from '@/components/referrals/ProgressCard';
import PayoutRequestDialog from '@/components/referrals/PayoutRequestDialog';
import ShipmentsList from '@/components/referrals/ShipmentsList';
import PayoutRequestsList from '@/components/referrals/PayoutRequestsList';
import ReferralTerms from '@/components/referrals/ReferralTerms';
import StatusPill from '@/components/referrals/StatusPill';
import { PROFILE_STATUS } from '@/lib/referralTerms';

export default function MyReferrals() {
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const load = async () => {
    const [u, res] = await Promise.all([base44.auth.me(), base44.functions.invoke('referralProgram', { action: 'me' })]);
    setMe(u); setData(res.data);
  };
  useEffect(() => { load(); }, []);

  if (!data) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const p = data.profile;
  const active = p?.status === 'activo';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ClientPageHero
        icon={Gift}
        eyebrow="Programa de referidos"
        title="Mis Referidos"
        description="Gana $50 USD por cada 1 CBM de flete marítimo que tus referidos paguen. Las fracciones se acumulan sin vencimiento."
        badges={[`${data.referred.length} referidos`, `Conteo desde ${new Date(data.program_start || '2026-11-10T04:00:00.000Z').toLocaleDateString('es-VE', { timeZone: 'America/Caracas' })}`]}
        action={<Button variant="outline" onClick={() => setTermsOpen(true)}>Términos y condiciones</Button>}
      />

      {data.my_code && <ReferralCodeCard code={data.my_code} />}
      <ReferredList referred={data.referred} />
      <LinkReferrerCard referrer={data.referrer} onDone={load} />
      {p?.status === 'suspendido' && (
        <Card><CardContent className="p-6 text-sm">Tu participación está suspendida.{p.review_notes ? ` ${p.review_notes}` : ''}</CardContent></Card>
      )}
      <ProgressCard balance={data.balance} canRequest={p?.status !== 'suspendido'} onRequest={() => setPayOpen(true)} />
      <ShipmentsList shipments={data.shipments} />
      <PayoutRequestsList requests={data.requests} />

      <PayoutRequestDialog open={payOpen} onOpenChange={setPayOpen} maxBlocks={data.balance?.blocks || 1} onDone={load} />
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Términos y Condiciones · Programa de Referidos</DialogTitle></DialogHeader>
          <ReferralTerms />
        </DialogContent>
      </Dialog>
    </div>
  );
}