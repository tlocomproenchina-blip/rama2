import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import PortalScopePicker from '@/components/shared-portal/PortalScopePicker';
import { portalExpiryInput } from '@/lib/sharedPortalFormat';

const emptyForm = {
  label: '',
  scope_mode: 'global',
  scope_wholesaler_keys: [],
  scope_wholesaler_names: [],
  scope_client_emails: [],
  scope_shipping_marks: [],
  expires_at: '',
  notes: '',
};

export default function PortalLinkFormDialog({ open, link, wholesalers, onSearchClients, onClose, onSubmit, saving }) {
  const [form, setForm] = useState(emptyForm);
  const [code, setCode] = useState('');
  const [clearCode, setClearCode] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setCode('');
    setClearCode(false);
    setError('');
    setForm(
      link
        ? {
            label: link.label || '',
            scope_mode: link.scope_mode === 'limitado' ? 'limitado' : 'global',
            scope_wholesaler_keys: link.scope_wholesaler_keys || [],
            scope_wholesaler_names: link.scope_wholesaler_names || [],
            scope_client_emails: link.scope_client_emails || [],
            scope_shipping_marks: link.scope_shipping_marks || [],
            expires_at: portalExpiryInput(link.expires_at),
            notes: link.notes || '',
          }
        : emptyForm
    );
  }, [open, link]);

  const limitado = form.scope_mode === 'limitado';
  const hasScope =
    (form.scope_wholesaler_keys || []).length > 0 ||
    (form.scope_client_emails || []).length > 0 ||
    (form.scope_shipping_marks || []).length > 0;

  const submit = () => {
    if (!form.label.trim()) {
      setError('Ponle un nombre al enlace para reconocerlo');
      return;
    }
    if (limitado && !hasScope) {
      setError('Un enlace limitado necesita al menos un mayorista, cliente o Shipping Mark');
      return;
    }
    setError('');
    onSubmit({
      ...form,
      label: form.label.trim(),
      notes: form.notes.trim(),
      code: code.trim(),
      clear_code: clearCode,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (!value ? onClose() : null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{link ? 'Editar enlace del portal' : 'Generar enlace del portal'}</DialogTitle>
          <DialogDescription>
            Solo entrega los registros que indiques. El enlace es de solo lectura y se puede vencer o revocar cuando quieras.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="portal-label" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Nombre del enlace
            </Label>
            <Input
              id="portal-label"
              value={form.label}
              onChange={(event) => setForm({ ...form, label: event.target.value })}
              placeholder="Ej: Aliado logístico Panamá"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Alcance</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, scope_mode: 'global' })}
                className={
                  limitado
                    ? 'rounded-xl border border-border bg-card p-3 text-left text-sm text-foreground hover:bg-secondary'
                    : 'rounded-xl border border-primary bg-primary/10 p-3 text-left text-sm font-semibold text-foreground'
                }
              >
                Todos los registros
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  Ve todos los mayoristas y los registros directos de TLEC CARGO
                </span>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, scope_mode: 'limitado' })}
                className={
                  limitado
                    ? 'rounded-xl border border-primary bg-primary/10 p-3 text-left text-sm font-semibold text-foreground'
                    : 'rounded-xl border border-border bg-card p-3 text-left text-sm text-foreground hover:bg-secondary'
                }
              >
                Alcance limitado
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  Solo los mayoristas, clientes y Shipping Marks que elijas
                </span>
              </button>
            </div>
          </div>

          {limitado ? (
            <PortalScopePicker
              value={form}
              onChange={(next) => setForm({ ...form, ...next })}
              wholesalers={wholesalers}
              onSearchClients={onSearchClients}
            />
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="portal-code" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Código de acceso (opcional)
              </Label>
              <Input
                id="portal-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder={link?.access_code_set ? 'Nuevo código (vacío = dejarlo igual)' : 'Ej: 4821'}
                disabled={clearCode}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="portal-expires" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Vence el (opcional)
              </Label>
              <Input
                id="portal-expires"
                type="date"
                value={form.expires_at}
                onChange={(event) => setForm({ ...form, expires_at: event.target.value })}
              />
            </div>
          </div>

          {link?.access_code_set ? (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={clearCode} onCheckedChange={(value) => setClearCode(!!value)} />
              Quitar el código de acceso de este enlace
            </label>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="portal-notes" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Nota interna (opcional)
            </Label>
            <Textarea
              id="portal-notes"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Para quién es este enlace y con qué fin"
              rows={2}
            />
          </div>

          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={saving} className="bg-slate-900 text-white hover:bg-slate-800">
            {saving ? 'Guardando…' : link ? 'Guardar cambios' : 'Generar enlace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}