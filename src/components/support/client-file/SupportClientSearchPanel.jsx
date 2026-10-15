import React from 'react';
import { Search, Loader2, Phone, MapPin, BadgeCheck, X, IdCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// Buscador global de clientes del área de Soporte: encuentra al cliente por su
// cédula (u otro dato) sin depender de que tenga un ticket abierto y abre su ficha.
export default function SupportClientSearchPanel({ query, onQueryChange, results, total, searching, searched, onSelect }) {
  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-4 w-4 text-primary" /> Buscar cliente
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Por cédula, número de teléfono, correo, nombre o Shipping Mark. No hace falta que el cliente tenga un ticket abierto.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <IdCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Ej: V-12345678, 0412-2615724 o N3-TLEC-52397"
            className="min-h-[48px] pl-9 pr-9"
            autoFocus
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange('')}
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

        {query.trim().length > 0 && query.trim().length < 3 ? (
          <p className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            Escribe al menos 3 caracteres para buscar.
          </p>
        ) : null}

        {results.length > 0 ? (
          <>
            <p className="text-xs text-muted-foreground">
              {total > results.length
                ? `Mostrando ${results.length} de ${total} coincidencias. Afina la búsqueda con la cédula completa.`
                : `${total} coincidencia${total === 1 ? '' : 's'}.`}
            </p>
            <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {results.map((item) => (
                <li key={item.id || item.email}>
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    className="w-full rounded-2xl border border-border p-3 text-left transition hover:border-primary hover:bg-accent"
                  >
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {item.full_name || [item.first_name, item.last_name].filter(Boolean).join(' ') || item.email}
                      {item.shipping_mark ? <BadgeCheck className="h-3.5 w-3.5 text-primary" /> : null}
                      {item.is_active === false ? <span className="text-[11px] font-medium text-amber-700">Inactivo</span> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{item.email}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {item.cedula ? <span className="font-medium text-foreground">CI {item.cedula}</span> : <span>Sin cédula</span>}
                      {item.whatsapp ? (
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{item.whatsapp}</span>
                      ) : null}
                      {item.shipping_mark ? <span className="font-medium text-foreground">{item.shipping_mark}</span> : null}
                      {item.city ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{item.city}{item.state ? `, ${item.state}` : ''}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {searched && !searching && query.trim().length >= 3 && results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            Sin coincidencias. Prueba con la cédula sin puntos ni guiones, o el número completo del cliente.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}