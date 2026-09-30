import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Boxes, Loader2, RefreshCw, Search, Users } from 'lucide-react';
import { matchesBultoCode } from '@/lib/bultoSearch';
import PendingBillingClientCard from './PendingBillingClientCard';

// Panel de clientes con mercancía pendiente de facturar, agrupada por cliente y
// ordenada por su N° de orden/envío, con la casilla de marcado manual.
export default function PendingBillingPanel({
  clients = [],
  loading,
  error,
  selectedEmail,
  markingId,
  onRetry,
  onSelectClient,
  onMarkBulto,
}) {
  const [term, setTerm] = useState('');

  const filtered = useMemo(() => {
    const query = term.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((c) => {
      const haystack = [
        c.client_name, c.client_email, c.shipping_mark, c.city, c.state, c.whatsapp,
        ...(c.bultos || []).map((b) => b.label),
        ...(c.bultos || []).flatMap((b) => b.order_numbers || []),
        ...(c.bultos || []).flatMap((b) => b.trackings || []),
        ...(c.receipts || []).map((r) => r.label),
      ].filter(Boolean).join(' ').toLowerCase();
      if (haystack.includes(query)) return true;
      // Los últimos caracteres del código de bulto bastan para encontrar la carga.
      return [...(c.bultos || []).map((b) => b.label), ...(c.receipts || []).map((r) => r.label)]
        .some((label) => matchesBultoCode(label, term));
    });
  }, [clients, term]);

  const totals = useMemo(() => ({
    clients: filtered.length,
    bultos: filtered.reduce((sum, c) => sum + (c.bultos || []).length, 0),
  }), [filtered]);

  return (
    <Card className="border-border/70 shadow-card flex flex-col lg:max-h-[calc(100vh-3rem)]">
      <CardContent className="p-4 flex flex-col min-h-0 gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Carga pendiente de facturar</h2>
          <p className="text-xs text-slate-500">Bultos con mercancía sin factura, agrupados por cliente y N° de orden/envío.</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {totals.clients} cliente(s)
          </Badge>
          <Badge variant="secondary" className="inline-flex items-center gap-1">
            <Boxes className="h-3 w-3" /> {totals.bultos} bulto(s)
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={onRetry}
            disabled={loading}
            title="Actualizar el panel"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Cliente, email, mark, N° de orden o código…"
            className="pl-9"
          />
        </div>

        <div className="min-h-0 lg:flex-1 lg:overflow-y-auto pr-1">
          {loading && clients.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-8 w-8 text-rose-400 mb-2" />
              <p className="text-sm font-medium text-rose-600">No se pudo cargar la carga pendiente</p>
              <p className="text-xs text-slate-500 mt-1">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Reintentar</Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {clients.length === 0
                ? 'No hay clientes con carga pendiente de facturar.'
                : 'Ningún cliente coincide con la búsqueda.'}
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((c) => (
                <PendingBillingClientCard
                  key={c.client_email}
                  client={c}
                  selected={selectedEmail === c.client_email}
                  markingId={markingId}
                  onSelect={onSelectClient}
                  onMarkBulto={onMarkBulto}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}