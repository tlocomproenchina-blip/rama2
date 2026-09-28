import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2, Search, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

// Confirmación del cliente dueño de la etiqueta escaneada.
// Primero propone el cliente deducido del shipping mark del código; si el empleado
// necesita otro, permite buscarlo por shipping mark, correo, nombre o cédula.
export default function ScanClientPicker({ candidateClient, selectedClient, deviceId, onSelect }) {
  const [showSearch, setShowSearch] = useState(!candidateClient);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    const value = query.trim();
    if (value.length < 2) {
      toast.error('Escribe al menos 2 caracteres');
      return;
    }
    setSearching(true);
    try {
      const res = await base44.functions.invoke('bultoScanLookup', {
        action: 'clients',
        query: value,
        device_id: deviceId,
      });
      const clients = res?.data?.clients || [];
      setResults(clients);
      if (!clients.length) toast.error('Sin resultados');
    } catch (e) {
      toast.error('Error al buscar clientes');
    } finally {
      setSearching(false);
    }
  };

  if (selectedClient) {
    return (
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="pt-4 space-y-1">
          <p className="text-xs font-medium text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Cliente confirmado
          </p>
          <p className="text-base font-semibold text-slate-800">{selectedClient.full_name || selectedClient.email}</p>
          <p className="text-xs text-slate-600 font-mono break-all">{selectedClient.shipping_mark} · {selectedClient.email}</p>
          <Button variant="ghost" size="sm" className="mt-1 -ml-2 text-slate-600" onClick={() => { setShowSearch(true); setResults([]); }}>
            <Search className="h-3.5 w-3.5" /> Cambiar cliente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-slate-800">
          <UserCheck className="h-4 w-4" /> Cliente del bulto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {candidateClient && !showSearch ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-card px-3 py-2">
              <p className="text-sm font-semibold text-slate-800">{candidateClient.full_name || candidateClient.email}</p>
              <p className="text-xs text-slate-500 font-mono break-all">{candidateClient.shipping_mark}</p>
              <p className="text-xs text-slate-500 break-all">{candidateClient.email}</p>
              {(candidateClient.city || candidateClient.state) && (
                <p className="text-xs text-slate-500">{[candidateClient.city, candidateClient.state].filter(Boolean).join(', ')}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onSelect(candidateClient)} className="bg-blue-600 hover:bg-blue-700">
                <CheckCircle2 className="h-4 w-4" /> Confirmar cliente
              </Button>
              <Button variant="outline" onClick={() => setShowSearch(true)}>
                <Search className="h-4 w-4" /> Buscar otro cliente
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {!candidateClient && (
              <p className="text-xs text-amber-700">
                El shipping mark del código no coincide con ningún cliente. Busca al cliente por shipping mark, correo, nombre o cédula.
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Shipping mark, correo, nombre o cédula"
              />
              <Button variant="outline" onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
              </Button>
            </div>
            {results.length > 0 && (
              <div className="space-y-2">
                {results.map((c) => (
                  <button
                    key={c.email}
                    type="button"
                    onClick={() => onSelect(c)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <p className="text-sm font-semibold text-slate-800">{c.full_name || c.email}</p>
                    <p className="text-xs text-slate-500 font-mono break-all">{c.shipping_mark}</p>
                    <p className="text-xs text-slate-500 break-all">{c.email}</p>
                  </button>
                ))}
              </div>
            )}
            {candidateClient && (
              <Button variant="ghost" size="sm" className="-ml-2 text-slate-600" onClick={() => setShowSearch(false)}>
                Volver al cliente sugerido
              </Button>
            )}
          </div>
        )}
        {selectedClient === null && candidateClient === null && (
          <Badge variant="outline" className="text-amber-700">Sin cliente confirmado</Badge>
        )}
      </CardContent>
    </Card>
  );
}