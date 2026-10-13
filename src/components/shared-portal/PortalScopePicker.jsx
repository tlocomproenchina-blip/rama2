import React, { useEffect, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

function Chip({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-foreground">
      {children}
      <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-foreground">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export default function PortalScopePicker({ value, onChange, wholesalers, onSearchClients }) {
  const [clientQuery, setClientQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState([]);
  const [markInput, setMarkInput] = useState('');

  useEffect(() => {
    const term = clientQuery.trim();
    if (term.length < 3) {
      setFound([]);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const rows = await onSearchClients(term);
      if (active) {
        setFound(rows || []);
        setSearching(false);
      }
    }, 450);
    return () => {
      active = false;
      clearTimeout(timer);
      setSearching(false);
    };
  }, [clientQuery, onSearchClients]);

  const keys = value.scope_wholesaler_keys || [];
  const names = value.scope_wholesaler_names || [];
  const emails = value.scope_client_emails || [];
  const marks = value.scope_shipping_marks || [];

  const toggleWholesaler = (item) => {
    const index = keys.indexOf(item.key);
    if (index === -1) {
      onChange({ ...value, scope_wholesaler_keys: [...keys, item.key], scope_wholesaler_names: [...names, item.name || item.key] });
    } else {
      onChange({
        ...value,
        scope_wholesaler_keys: keys.filter((key) => key !== item.key),
        scope_wholesaler_names: names.filter((name) => name !== (item.name || item.key)),
      });
    }
  };

  const addClient = (email) => {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean || emails.includes(clean)) return;
    onChange({ ...value, scope_client_emails: [...emails, clean] });
  };

  const addMark = () => {
    const clean = markInput.trim().toUpperCase();
    if (!clean || marks.includes(clean)) return;
    onChange({ ...value, scope_shipping_marks: [...marks, clean] });
    setMarkInput('');
  };

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-secondary/40 p-4">
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Mayoristas</Label>
        <div className="flex flex-wrap gap-2">
          {(wholesalers || []).map((item) => {
            const active = keys.includes(item.key);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleWholesaler(item)}
                className={
                  active
                    ? 'rounded-full border border-primary bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground'
                    : 'rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary'
                }
              >
                {item.name || item.key}
              </button>
            );
          })}
          {(wholesalers || []).length === 0 ? <p className="text-xs text-muted-foreground">No hay conexiones mayoristas registradas.</p> : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Clientes del mayorista</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={clientQuery}
            onChange={(event) => setClientQuery(event.target.value)}
            placeholder="Busca por correo, nombre o Shipping Mark"
            className="pl-9"
          />
        </div>
        {searching ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Buscando clientes…
          </p>
        ) : null}
        {!searching && clientQuery.trim().length >= 3 && found.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin clientes mayoristas para esa búsqueda.</p>
        ) : null}
        <div className="space-y-1">
          {found.map((client) => (
            <div key={client.email} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{client.full_name || client.email}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {client.email}{client.shipping_mark ? ` · ${client.shipping_mark}` : ''}
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => addClient(client.email)} className="shrink-0">
                Agregar
              </Button>
            </div>
          ))}
        </div>
        {emails.length ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {emails.map((email) => (
              <Chip key={email} onRemove={() => onChange({ ...value, scope_client_emails: emails.filter((item) => item !== email) })}>
                {email}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Shipping Marks</Label>
        <div className="flex gap-2">
          <Input
            value={markInput}
            onChange={(event) => setMarkInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addMark();
              }
            }}
            placeholder="Ej: N7-INDP-60008"
          />
          <Button type="button" variant="outline" onClick={addMark} className="shrink-0">Agregar</Button>
        </div>
        {marks.length ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {marks.map((mark) => (
              <Chip key={mark} onRemove={() => onChange({ ...value, scope_shipping_marks: marks.filter((item) => item !== mark) })}>
                {mark}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}