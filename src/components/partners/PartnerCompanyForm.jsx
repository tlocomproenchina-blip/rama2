import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeCompanyCode, DEFAULT_COMPANY_CODE } from '@/lib/companyScope';

const EMPTY = {
  company_code: '',
  company_name: '',
  legal_name: '',
  tagline: '',
  brand_color: '#0ea5e9',
  logo_url: '',
  shipping_mark_prefix: '',
  label_prefix: '',
  order_prefix: '',
  contact_name: '',
  contact_email: '',
  contact_whatsapp: '',
  city: '',
  state: '',
  country: 'Venezuela',
  is_active: true,
  notes: '',
  service_key: '',
};

function generateKey(code) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const random = Array.from({ length: 24 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  const prefix = normalizeCompanyCode(code).slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'SOCIA';
  return `PSK-${prefix}-${random}`;
}

// Alta y edición de una empresa socia (marca blanca que opera sobre TLEC CARGO).
export default function PartnerCompanyForm({ company, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const isEdit = !!company?.id;

  useEffect(() => {
    setForm(company ? { ...EMPTY, ...company } : { ...EMPTY, service_key: generateKey('nueva') });
  }, [company]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    const code = normalizeCompanyCode(form.company_code);
    const name = String(form.company_name || '').trim();

    if (!code) { toast.error('El código de empresa es obligatorio'); return; }
    if (code === DEFAULT_COMPANY_CODE) { toast.error(`El código "${DEFAULT_COMPANY_CODE}" está reservado para TLEC CARGO`); return; }
    if (!/^[a-z0-9_-]+$/.test(code)) { toast.error('El código solo admite letras, números, guion y guion bajo'); return; }
    if (!name) { toast.error('El nombre de la empresa es obligatorio'); return; }
    if (!form.service_key) { toast.error('Genera la llave de servicio'); return; }

    setSaving(true);
    try {
      const existing = await base44.entities.PartnerCompany.filter({ company_code: code }, '-created_date', 5);
      const conflict = (existing || []).find((c) => c.id !== company?.id);
      if (conflict) {
        toast.error('Ya existe una empresa con ese código');
        setSaving(false);
        return;
      }

      const payload = {
        company_code: code,
        company_name: name,
        legal_name: String(form.legal_name || '').trim(),
        tagline: String(form.tagline || '').trim(),
        brand_color: String(form.brand_color || '#0ea5e9').trim(),
        logo_url: String(form.logo_url || '').trim(),
        shipping_mark_prefix: String(form.shipping_mark_prefix || '').trim(),
        label_prefix: String(form.label_prefix || '').trim(),
        order_prefix: String(form.order_prefix || '').trim(),
        contact_name: String(form.contact_name || '').trim(),
        contact_email: String(form.contact_email || '').trim(),
        contact_whatsapp: String(form.contact_whatsapp || '').trim(),
        city: String(form.city || '').trim(),
        state: String(form.state || '').trim(),
        country: String(form.country || '').trim(),
        is_active: form.is_active !== false,
        notes: String(form.notes || '').trim(),
        service_key: String(form.service_key).trim(),
      };

      const saved = isEdit
        ? await base44.entities.PartnerCompany.update(company.id, payload)
        : await base44.entities.PartnerCompany.create({ ...payload, created_by_email: (await base44.auth.me())?.email || '' });

      toast.success(isEdit ? 'Empresa socia actualizada' : 'Empresa socia creada');
      onSaved?.(saved);
    } catch (e) {
      toast.error('No se pudo guardar la empresa: ' + (e?.message || 'error'));
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-0 md:p-4 md:pt-16" onClick={() => !saving && onClose()}>
      <Card className="w-full md:max-w-2xl shadow-xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">{isEdit ? 'Editar empresa socia' : 'Nueva empresa socia'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={saving}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Código de empresa *</Label>
              <Input
                value={form.company_code}
                onChange={(e) => set('company_code', normalizeCompanyCode(e.target.value))}
                placeholder="ej: enviosxyz"
                disabled={isEdit}
              />
              <p className="text-xs text-slate-500">Con este código se separan sus datos en paquetes, bultos y facturas.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nombre comercial *</Label>
              <Input value={form.company_name} onChange={(e) => set('company_name', e.target.value)} placeholder="ej: Envíos XYZ" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Razón social</Label>
              <Input value={form.legal_name} onChange={(e) => set('legal_name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Eslogan</Label>
              <Input value={form.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="ej: Carga China–Venezuela" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Color del distintivo</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.brand_color || '#0ea5e9'}
                  onChange={(e) => set('brand_color', e.target.value)}
                  className="h-10 w-12 rounded-lg border border-input bg-transparent p-1"
                />
                <Input value={form.brand_color} onChange={(e) => set('brand_color', e.target.value)} placeholder="#0ea5e9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">URL del logo</Label>
              <Input value={form.logo_url} onChange={(e) => set('logo_url', e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Prefijo de Shipping Mark</Label>
              <Input value={form.shipping_mark_prefix} onChange={(e) => set('shipping_mark_prefix', e.target.value)} placeholder="ej: XYZ-" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Prefijo de etiqueta</Label>
              <Input value={form.label_prefix} onChange={(e) => set('label_prefix', e.target.value)} placeholder="ej: XYZ" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Prefijo de bultos y órdenes</Label>
              <Input value={form.order_prefix} onChange={(e) => set('order_prefix', e.target.value)} placeholder="ej: X" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">País</Label>
              <Input value={form.country} onChange={(e) => set('country', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Ciudad</Label>
              <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Estado</Label>
              <Input value={form.state} onChange={(e) => set('state', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Contacto</Label>
              <Input value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email de contacto</Label>
              <Input value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-sm font-medium">WhatsApp de contacto</Label>
              <Input value={form.contact_whatsapp} onChange={(e) => set('contact_whatsapp', e.target.value)} placeholder="584121234567" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Llave de servicio (para su app secundaria)</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input value={form.service_key} onChange={(e) => set('service_key', e.target.value)} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                className="gap-2 shrink-0"
                onClick={() => set('service_key', generateKey(form.company_code))}
              >
                <RefreshCw className="h-4 w-4" /> Generar
              </Button>
            </div>
            <p className="text-xs text-slate-500">Se entrega solo a esa empresa. Con ella su app consulta y envía datos de su propio código.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Notas internas</Label>
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-slate-700">Empresa activa</p>
              <p className="text-xs text-slate-500">Si se desactiva, su llave deja de funcionar y no aparece como destino de asignación.</p>
            </div>
            <Switch checked={form.is_active !== false} onCheckedChange={(v) => set('is_active', v)} />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEdit ? 'Guardar cambios' : 'Crear empresa'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}