import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader2, RefreshCw, Search } from 'lucide-react';
import { matchesBultoCode } from '@/lib/bultoSearch';
import PendingBillingClientRow from './PendingBillingClientRow';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Cola de facturación: los clientes con carga en el almacén que todavía espera su
// factura. Solo se listan —y solo se cuentan— los bultos pendientes: en cuanto el
// último bulto de un cliente se marca como facturado, el cliente sale de la lista,
// de los contadores y de la búsqueda del panel, sin recargar nada.
export default function PendingBillingPanel({
  clients = [],
  loading,
  error,
  selectedEmail,
  onRetry,
  onSelectClient,
}) {
  const [term, setTerm] = useState('');

  const queue = useMemo(() => clients
    .map((client) => ({
      client,
      pendingBultos: (client.bultos || []).filter((b) => !b.billing_marked),
    }))
    .filter((entry) => entry.pendingBultos.length > 0)
    .sort((a, b) => {
      const cbmA = a.pendingBultos.reduce((sum, x) => sum + num(x.cbm), 0);
      const cbmB = b.pendingBultos.reduce((sum, x) => sum + num(x.cbm), 0);
      if (cbmB !== cbmA) return cbmB - cbmA;
      return String(a.client.client_name || a.client.client_email)
        .localeCompare(String(b.client.client_name || b.client.client_email));
    }), [clients]);

  const filtered = useMemo(() => {
    const query = term.trim().toLowerCase();
    if (!query) return queue;
    return queue.filter(({ client }) => {
      const haystack = [
        client.client_name, client.client_email, client.shipping_mark, client.city, client.state, client.whatsapp,
        ...(client.bultos || []).map((b) => b.label),
        ...(client.bultos || []).flatMap((b) => b.order_numbers || []),
        ...(client.bultos || []).flatMap((b) => b.trackings || []),
        ...(client.receipts || []).map((r) => r.label),
      ].filter(Boolean).join(' ').toLowerCase();
      if (haystack.includes(query)) return true;
      // Los últimos caracteres del código de bulto bastan para encontrar la carga.
      return [...(client.bultos || []).map((b) => b.label), ...(client.receipts || []).map((r) => r.label)]
        .some((label) => matchesBultoCode(label, term));
    });
  }, [queue, term]);

  const totals = useMemo(() => ({
    clients: filtered.length,
    bultos: filtered.reduce((sum, entry) => sum + entry.pendingBultos.length, 0),
  }), [filtered]);

  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-slate-900/60 lg:max-h-[calc(100vh-5rem)]">
      <div className="space-y-3 border-b border-white/10 p-4">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">
            Carga pendiente de facturar
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Clientes con mercancía sin factura en el almacén. Al facturarlo todo, el cliente sale de esta lista.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-200 ring-1 ring-inset ring-white/10">
            {totals.clients} cliente(s)
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2 py-0.5 font-semibold text-sky-300 ring-1 ring-inset ring-sky-500/30">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-400" />
            </span>
            {totals.bultos} bulto(s)
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            onClick={onRetry}
            disabled={loading}
            title="Actualizar el panel"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Cliente, email, mark, N° de orden o código…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {loading && queue.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="mb-2 h-8 w-8 text-rose-400" />
            <p className="text-sm font-medium text-rose-300">No se pudo cargar la carga pendiente</p>
            <p className="mt-1 text-xs text-slate-400">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={onRetry}
            >
              Reintentar
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {queue.length === 0
              ? 'No hay clientes con carga pendiente de facturar.'
              : 'Ningún cliente coincide con la búsqueda.'}
          </p>
        ) : (
          filtered.map(({ client, pendingBultos }) => (
            <PendingBillingClientRow
              key={client.client_email}
              client={client}
              pendingBultos={pendingBultos}
              selected={selectedEmail === client.client_email}
              onSelect={onSelectClient}
            />
          ))
        )}
      </div>
    </div>
  );
}