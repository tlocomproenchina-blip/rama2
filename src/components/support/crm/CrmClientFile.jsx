import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import useSupportClientCases from '@/hooks/useSupportClientCases';
import SupportClientProfileCard from '@/components/support/client-file/SupportClientProfileCard';
import SupportClientCasesCard from '@/components/support/client-file/SupportClientCasesCard';
import SupportNotesPanel from '@/components/support/client-file/SupportNotesPanel';
import SupportFollowUpPanel from '@/components/support/client-file/SupportFollowUpPanel';
import ClientSupport360 from '@/components/support/client360/ClientSupport360';
import CrmActivityTimeline from './CrmActivityTimeline';

// Expediente del cliente en cinco pestañas.
export default function CrmClientFile({ client, user }) {
  const { cases } = useSupportClientCases(client.email);
  const name = client.full_name || [client.first_name, client.last_name].filter(Boolean).join(' ') || client.email;

  return (
    <Tabs defaultValue="resumen" className="min-w-0">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="actividad">Actividad</TabsTrigger>
        <TabsTrigger value="paquetes">Paquetes</TabsTrigger>
        <TabsTrigger value="notas">Notas</TabsTrigger>
        <TabsTrigger value="tareas">Tareas</TabsTrigger>
      </TabsList>
      <TabsContent value="resumen" className="space-y-4">
        <SupportClientProfileCard client={client} />
        <SupportClientCasesCard clientEmail={client.email} />
      </TabsContent>
      <TabsContent value="actividad"><CrmActivityTimeline clientEmail={client.email} /></TabsContent>
      <TabsContent value="paquetes"><ClientSupport360 clientEmail={client.email} hideTickets /></TabsContent>
      <TabsContent value="notas">
        <SupportNotesPanel clientEmail={client.email} clientName={name} clientCedula={client.cedula} user={user} title="Notas internas del cliente" />
      </TabsContent>
      <TabsContent value="tareas">
        <SupportFollowUpPanel clientEmail={client.email} clientName={name} clientCedula={client.cedula} shippingMark={client.shipping_mark} cases={cases} user={user} />
      </TabsContent>
    </Tabs>
  );
}