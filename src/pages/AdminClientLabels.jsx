import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import useSupportClientSearch from '@/hooks/useSupportClientSearch';
import SupportClientSearchPanel from '@/components/support/client-file/SupportClientSearchPanel';
import SupportClientProfileCard from '@/components/support/client-file/SupportClientProfileCard';
import SupportClientLabelsPanel from '@/components/support/client-labels/SupportClientLabelsPanel';

// Panel independiente para generar y descargar etiquetas de cualquier cliente.
// Su acceso se activa o desactiva por rol desde Roles (módulo "Etiquetas de Cliente").
export default function AdminClientLabels() {
  const [client, setClient] = useState(null);
  const search = useSupportClientSearch(client);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Etiquetas de Cliente</h1>
        <p className="text-sm text-muted-foreground">
          Busca a un cliente por cédula, nombre, correo o Shipping Mark para generar y descargar sus etiquetas de paquetes y bultos.
        </p>
      </div>

      {!client ? (
        <SupportClientSearchPanel
          query={search.query}
          onQueryChange={search.setQuery}
          results={search.results}
          total={search.total}
          searching={search.searching}
          searched={search.searched}
          onSelect={setClient}
        />
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setClient(null);
              search.setQuery('');
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Buscar otro cliente
          </Button>
          <SupportClientProfileCard client={client} />
          <SupportClientLabelsPanel client={client} />
        </>
      )}
    </div>
  );
}