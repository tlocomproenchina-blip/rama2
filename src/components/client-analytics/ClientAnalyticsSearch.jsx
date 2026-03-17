import React, { useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function ClientAnalyticsSearch({
  clients,
  searchTerm,
  setSearchTerm,
  selectedClient,
  onSelectClient
}) {
  const filteredClients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];

    return clients
      .filter((client) => {
        const name = String(client.full_name || '').toLowerCase();
        const email = String(client.email || '').toLowerCase();
        const shippingMark = String(client.shipping_mark || '').toLowerCase();
        return name.includes(term) || email.includes(term) || shippingMark.includes(term);
      })
      .slice(0, 8);
  }, [clients, searchTerm]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar cliente por nombre, email o shipping mark"
          className="h-11 rounded-xl border-slate-200 bg-white pl-10 pr-10 shadow-sm"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {searchTerm && filteredClients.length > 0 && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {filteredClients.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => {
                onSelectClient(client);
                setSearchTerm('');
              }}
              className="flex w-full flex-col items-start gap-1 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
            >
              <span className="font-medium text-slate-800">{client.full_name || 'Sin nombre'}</span>
              <span className="text-sm text-slate-500">{client.email}</span>
              {client.shipping_mark && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                  {client.shipping_mark}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {selectedClient && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
            {selectedClient.full_name || 'Sin nombre'}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1">{selectedClient.email}</span>
          {selectedClient.shipping_mark && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
              {selectedClient.shipping_mark}
            </span>
          )}
        </div>
      )}
    </div>
  );
}