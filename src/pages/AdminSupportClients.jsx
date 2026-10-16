import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import SupportClientSearchPanel from '@/components/support/client-file/SupportClientSearchPanel';
import SupportClientProfileCard from '@/components/support/client-file/SupportClientProfileCard';
import SupportClientCasesCard from '@/components/support/client-file/SupportClientCasesCard';
import SupportNotesPanel from '@/components/support/client-file/SupportNotesPanel';
import ClientSupport360 from '@/components/support/client360/ClientSupport360';
import SupportPackageEditCard from '@/components/support/package-edit/SupportPackageEditCard';

// Ficha única de cliente del área de Soporte: se abre desde el buscador global
// (por cédula, sin depender de un ticket) y reúne sus datos de contacto, sus
// casos, sus notas internas y su historial operativo ya existente.
export default function AdminSupportClients({ user }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [client, setClient] = useState(null);

  const term = query.trim();

  useEffect(() => {
    if (client || term.length < 3) {
      setResults([]);
      setTotal(0);
      setSearched(false);
      setSearching(false);
      return undefined;
    }

    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke('listClientsForSupport', {
          q: term,
          limit: 30,
          skip: 0,
          includeCounts: false,
        });
        if (!active) return;
        setResults(res?.data?.data || []);
        setTotal(Number(res?.data?.total) || 0);
        setSearched(true);
      } catch {
        if (!active) return;
        setResults([]);
        setTotal(0);
        setSearched(true);
        toast.error('No se pudo buscar clientes');
      } finally {
        if (active) setSearching(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term, client]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Ficha de cliente</h1>
        <p className="text-sm text-muted-foreground">
          Busca al cliente por su cédula y reúne sus datos, sus casos y sus notas internas en un solo lugar.
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