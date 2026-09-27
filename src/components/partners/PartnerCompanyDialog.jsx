import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const EMPTY_FORM = {
  company_code: '', name: '', legal_name: '', contact_name: '', contact_email: '', contact_phone: '',
  app_name: '', app_tagline: '', brand_color: '#2563eb', app_logo_url: '', favicon_url: '',
  app_public_url: '', custom_domain: '',
  invoice_company_name: '', invoice_company_phone: '', invoice_company_email: '',
  invoice_company_address: '', invoice_company_city_zip: '', invoice_company_country: '', invoice_logo_url: '',
  notes: '',
};

function Field({ label, hint, span, children }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

export default function PartnerCompanyDialog({ open, company, saving, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const editing = !!company;

  useEffect(() => {
    if (open) setForm({ ...EMPTY_FORM, ...(company || {}) });
  }, [open, company]);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar empresa socia' : 'Nueva empresa socia'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <section className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Identidad</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Código de empresa" hint="Separa los datos de esta socia (ej. SOCIA1)">
                <Input value={form.company_code || ''} onChange={set('company_code')} disabled={editing} placeholder="SOCIA1" />
              </Field>
              <Field label="Nombre comercial">
                <Input value={form.name || ''} onChange={set('name')} placeholder="Envíos Caribe C.A." />
              </Field>
              <Field label="Razón social">
                <Input value={form.legal_name || ''} onChange={set('legal_name')} />
              </Field>
              <Field label="Responsable">
                <Input value={form.contact_name || ''} onChange={set('contact_name')} />
              </Field>
              <Field label="Correo de contacto">
                <Input type="email" value={form.contact_email || ''} onChange={set('contact_email')} />
              </Field>
              <Field label="Teléfono de contacto">
                <Input value={form.contact_phone || ''} onChange={set('contact_phone')} />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Marca de su app</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre en su app">
                <Input value={form.app_name || ''} onChange={set('app_name')} placeholder="Envíos Caribe" />
              </Field>
              <Field label="Eslogan">
                <Input value={form.app_tagline || ''} onChange={set('app_tagline')} />
              </Field>
              <Field label="Color de marca">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.brand_color || '#2563eb'}
                    onChange={set('brand_color')}
                    className="h-11 w-14 rounded-xl border border-border/80 bg-white p-1"
                  />
                  <Input value={form.brand_color || ''} onChange={set('brand_color')} placeholder="#2563eb" />
                </div>
              </Field>
              <Field label="Enlace de su app">
                <Input value={form.app_public_url || ''} onChange={set('app_public_url')} placeholder="https://..." />
              </Field>
              <Field label="Logo (URL)">
                <Input value={form.app_logo_url || ''} onChange={set('app_logo_url')} />
              </Field>
              <Field label="Favicon (URL)">
                <Input value={form.favicon_url || ''} onChange={set('favicon_url')} />
              </Field>
              <Field label="Dominio propio">
                <Input value={form.custom_domain || ''} onChange={set('custom_domain')} placeholder="envioscaribe.com" />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Datos de facturación</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre en facturas">
                <Input value={form.invoice_company_name || ''} onChange={set('invoice_company_name')} />
              </Field>
              <Field label="Teléfono en facturas">
                <Input value={form.invoice_company_phone || ''} onChange={set('invoice_company_phone')} />
              </Field>
              <Field label="Correo en facturas">
                <Input type="email" value={form.invoice_company_email || ''} onChange={set('invoice_company_email')} />
              </Field>
              <Field label="Ciudad y código postal">
                <Input value={form.invoice_company_city_zip || ''} onChange={set('invoice_company_city_zip')} />
              </Field>
              <Field label="Dirección" span>
                <Input value={form.invoice_company_address || ''} onChange={set('invoice_company_address')} />
              </Field>
              <Field label="País">
                <Input value={form.invoice_company_country || ''} onChange={set('invoice_company_country')} />
              </Field>
              <Field label="Logo de facturas (URL)">
                <Input value={form.invoice_logo_url || ''} onChange={set('invoice_logo_url')} />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Notas internas</p>
            <textarea
              value={form.notes || ''}
              onChange={set('notes')}
              rows={3}
              className="w-full rounded-xl border border-border/80 bg-white/90 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
            />
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {editing ? 'Guardar cambios' : 'Crear empresa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}