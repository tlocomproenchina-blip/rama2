import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export default function ClientAnalyticsSelector({
  clients,
  search,
  onSearchChange,
  selectedClient,
  onSelectClient
}) {
  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients.slice(0, 12);
    return clients
      .filter((client) =>
        [client.full_name, client.email, client.shipping_mark]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      )
      .slice(0, 12);
  }, [clients, search]);

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle>Buscar cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre, email o shipping mark"
            className="pl-9"
          />
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {filteredClients.map((client) => {
            const active = selectedClient?.id === client.id;
            return (
              <button
                key={client.id}
                onClick={() => onSelectClient(client)}
                className={`w-full rounded-xl border p-3 text-left transition ${active ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
              >
                <p className="font-medium text-slate-800">{client.full_name || 'Cliente sin nombre'}</p>
                <p className="text-sm text-slate-500">{client.email}</p>
                {client.shipping_mark && <p className="mt-1 text-xs text-slate-500">Shipping Mark: {client.shipping_mark}</p>}
              </button>
            );
          })}

          {!filteredClients.length && (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              No se encontraron clientes.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}