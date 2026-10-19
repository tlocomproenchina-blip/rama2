import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Loader2, Search, UserCheck } from 'lucide-react';
import useClientSearch from '@/hooks/useClientSearch';
import { useEnabledShippingTypes } from '@/components/ShippingTypeFilter';

// Asignación de una carga sin titular a su cliente desde el panel del ATC. Si el
// sistema encuentra la pre-alerta de ese cliente con el mismo tracking, los une en
// lugar de dejar dos registros del mismo envío.
export default function OrphanAssignDialog({ orphan, open, onOpenChange, onAssigned }) {
  const enabledTypes = useEnabledShippingTypes();
  const { query, setQuery, results, setResults, searching } = useClientSearch();
  const [client, setClient] = useState(null);
  const [shippingType, setShippingType] = useState('maritimo');
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');
  const defaultTypeRef = useRef('maritimo');

  useEffect(() => {
    defaultTypeRef.current = enabledTypes.maritimo ? 'maritimo' : 'aereo';
  }, [enabledTypes.maritimo, enabledTypes.aereo]);

  // Al abrir se empieza de cero: la carga y el envío se eligen en cada asignación.
  useEffect(() => {
    if (!open) return;
    setClient(null);
    setQuery('');
    setResults([]);
    setError('');
    setShippingType(defaultTypeRef.current);
  }, [open, setQuery, setResults]);

  const assign = async () => {
    if (!orphan?.id || !client) return;
    setAssigning(true);
    setError('');
    try {
      const { data } = await base44.functions.invoke('assignOrphanPackage', {
        package_id: orphan.id,
        client_email: client.email,
        shipping_mark: client.shipping_mark || undefined,
        shipping_type: shippingType,
      });
      if (data?.error) throw new Error(data.error);
      onAssigned({ orphan, client, result: data });
      onOpenChange(false);
    } catch (e) {
      setError(e?.message || 'No se pudo asignar la carga');
    }
    setAssigning(false);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !assigning && onOpenChange(value)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-5 w-5 text-primary" /> Asignar la carga a su cliente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 px-3 py-2">
            <span className="break-all font-mono text-sm font-semibold text-foreground">
              {orphan?.tracking_number || 'Sin tracking'}
            </span>
            {orphan?.shipping_mark ? <Badge variant="outline">SM: {orphan.shipping_mark}</Badge> : null}
          </div>

          {!client ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Buscar el cliente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nombre, email, shipping mark o cédula…"
                  className="pl-10"
                  autoFocus
                />
                {searching ? (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
                ) : null}
              </div>

              {results.length > 0 ? (
                <div className="max-h-60 divide-y overflow-y-auto rounded-2xl border border-border/70">
                  {results.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { setClient(item); setQuery(''); setResults([]); }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-muted/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {item.full_name || [item.first_name, item.last_name].filter(Boolean).join(' ') || item.email}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{item.email}</span>
                      </span>
                      {item.shipping_mark ? (
                        <Badge variant="outline" className="shrink-0 text-[10px]">{item.shipping_mark}</Badge>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}

              {query.trim().length >= 2 && !searching && results.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">No se encontraron clientes con esa búsqueda.</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2 rounded-2xl border border-border/70 bg-muted/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {client.full_name || [client.first_name, client.last_name].filter(Boolean).join(' ') || client.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {client.email}{client.shipping_mark ? ` · ${client.shipping_mark}` : ''}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setClient(null)} className="shrink-0">
                  Cambiar
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo de envío</Label>
                <Select value={shippingType} onValueChange={setShippingType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {enabledTypes.aereo ? <SelectItem value="aereo">Aéreo</SelectItem> : null}
                    {enabledTypes.maritimo ? <SelectItem value="maritimo">Marítimo</SelectItem> : null}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={assigning}>Cancelar</Button>
          <Button onClick={assign} disabled={!client || assigning} className="gap-2">
            {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
            Asignar carga
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}