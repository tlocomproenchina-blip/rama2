import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, UserPlus, X } from 'lucide-react';
import CampaignRecipientRow from '@/components/delivery-proof/CampaignRecipientRow';
import useClientRecipientSearch from '@/hooks/useClientRecipientSearch';

export default function CampaignRecipientPicker({ selected, onChange, disabled }) {
  const [query, setQuery] = useState('');
  const { clients, total, loading, limit } = useClientRecipientSearch(query);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const emailsOnScreen = clients.map((client) => client.email);
  const allOnScreenSelected = emailsOnScreen.length > 0 && emailsOnScreen.every((email) => selectedSet.has(email));

  const toggle = (email) =>
    onChange(selectedSet.has(email) ? selected.filter((item) => item !== email) : [...selected, email]);

  const toggleAllOnScreen = () => {
    if (allOnScreenSelected) {
      const onScreen = new Set(emailsOnScreen);
      onChange(selected.filter((email) => !onScreen.has(email)));
      return;
    }
    onChange([...new Set([...selected, ...emailsOnScreen])]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seleccionar clientes</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-xs text-primary hover:bg-transparent"
          onClick={toggleAllOnScreen}
          disabled={disabled || !clients.length}
        >
          {allOnScreenSelected ? 'Quitar todos' : 'Seleccionar todos'}
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre, email, teléfono, cédula o Shipping Mark…"
          className="pl-9"
          disabled={disabled}
        />
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-2">
          <Badge variant="secondary" className="text-xs">
            <UserPlus className="mr-1 h-3 w-3" /> {selected.length} seleccionado{selected.length === 1 ? '' : 's'}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => onChange([])}
            disabled={disabled}
          >
            <X className="mr-1 h-3 w-3" /> Quitar selección
          </Button>
        </div>
      ) : null}

      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : clients.length ? (
          clients.map((client) => (
            <CampaignRecipientRow
              key={client.email}
              client={client}
              checked={selectedSet.has(client.email)}
              onToggle={toggle}
              disabled={disabled}
            />
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Sin clientes para esa búsqueda.
          </p>
        )}
      </div>

      {!loading && total > limit ? (
        <p className="text-xs text-muted-foreground">
          Mostrando {clients.length} de {total} clientes. Afina la búsqueda para llegar a los demás.
        </p>
      ) : null}
    </div>
  );
}