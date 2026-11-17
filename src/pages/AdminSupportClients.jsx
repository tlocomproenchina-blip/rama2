import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import useSupportClientSearch from '@/hooks/useSupportClientSearch';
import SupportClientSearchPanel from '@/components/support/client-file/SupportClientSearchPanel';
import SupportClientProfileCard from '@/components/support/client-file/SupportClientProfileCard';
import SupportClientCasesCard from '@/components/support/client-file/SupportClientCasesCard';
import SupportNotesPanel from '@/components/support/client-file/SupportNotesPanel';
import ClientSupport360 from '@/components/support/client360/ClientSupport360';
import SupportClientLabelsPanel from '@/components/support/client-labels/SupportClientLabelsPanel';
import SupportPackageEditCard from '@/components/support/package-edit/SupportPackageEditCard';

// Ficha única de cliente del área de Soporte: se abre desde el buscador global
// (por cédula, sin depender de un ticket) y reúne sus datos de contacto, sus
// casos, sus notas internas y su historial operativo ya existente.
export default function AdminSupportClients({ user }) {
  const [client, setClient] = useState(null);
  const { query, setQuery, results, total, searching, searched } = useSupportClientSearch(client);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Ficha de cliente</h1>
        <p className="text-sm text-muted-foreground">
          Busca a cualquier cliente por cédula, nombre, correo o Shipping Mark y reúne sus datos, casos, notas y etiquetas en un solo lugar.
        </p>
      </div>

      {!client ? (
        <SupportClientSearchPanel
          query={query}
          onQueryChange={setQuery}
          results={results}
          total={total}
          searching={searching}
          searched={searched}
          onSelect={setClient}
        />
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setClient(null);
              setQuery('');
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Buscar otro cliente
          </Button>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6">
              <SupportClientProfileCard client={client} />
              <SupportNotesPanel
                clientEmail={client.email}
                clientName={client.full_name || [client.first_name, client.last_name].filter(Boolean).join(' ')}
                clientCedula={client.cedula}
                user={user}
                title="Notas internas del cliente"
              />
            </div>
            <div className="space-y-6 lg:col-span-2">
              <SupportClientCasesCard clientEmail={client.email} />
              <SupportClientLabelsPanel client={client} />
              <SupportPackageEditCard
                clientEmail={client.email}
                clientName={client.full_name || [client.first_name, client.last_name].filter(Boolean).join(' ')}
                shippingMark={client.shipping_mark || ''}
                user={user}
              />
              <ClientSupport360 clientEmail={client.email} hideTickets />
            </div>
          </div>
        </>
      )}
    </div>
  );
}