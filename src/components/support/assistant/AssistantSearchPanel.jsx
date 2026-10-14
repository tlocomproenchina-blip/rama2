import React, { useEffect } from 'react';
import { Search, Loader2, Phone, BadgeCheck, MapPin, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Buscador del cliente que escribe por WhatsApp: teléfono, Shipping Mark,
// cédula, correo o nombre.
export default function AssistantSearchPanel({ query, onQueryChange, onSearch, searching, results, client, onSelect, onClear }) {
  useEffect(() => {
    if (query.trim().length < 3) return undefined;
    const timer = setTimeout(() => onSearch(query), 500);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-4 w-4 text-primary" /> Buscar cliente
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Por número de teléfono, Shipping Mark, cédula, correo o nombre.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Ej: +58 0412-2615724 o N3-TLEC-52397"
            className="pl-9 pr-9"
          />
          {query ? (
            <button
              type="button"
              onClick={() => { onQueryChange(''); onClear?.(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition hover:bg-accent"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {searching ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando cliente…
          </p>
        ) : null}

        {results.length > 0 ? (
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {results.map((item) => {
              const active = client?.email === item.email;
              return (
                <li key={item.email}>
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      active ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
                    }`}
                  >
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {item.full_name || item.email}
                      {item.shipping_mark ? <BadgeCheck className="h-3.5 w-3.5 text-primary" /> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{item.email}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {item.whatsapp ? (
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{item.whatsapp}</span>
                      ) : null}
                      {item.shipping_mark ? <span className="font-medium text-foreground">{item.shipping_mark}</span> : null}
                      {item.city ? (
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{item.city}{item.state ? `, ${item.state}` : ''}</span>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {!searching && query.trim().length >= 3 && results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            Sin coincidencias. Prueba con el número completo del cliente (con o sin código de país) o con su Shipping Mark.
          </div>
        ) : null}

        {client ? (
          <Button variant="outline" size="sm" className="w-full" onClick={onClear}>
            Cambiar de cliente
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}