import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import FiscalField from '@/components/fiscal/FiscalField';

// Datos del emisor: nombre, dirección y contacto vienen de los datos de factura
// que ya existen en Ajustes; aquí solo se agregan el RIF y la información fiscal.
export default function FiscalIssuerSettings() {
  const [cfg, setCfg] = useState(null);
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.AppConfig.filter({ config_key: 'main' }),
      base44.entities.FiscalSettings.filter({ config_key: 'main' }),
    ]).then(([c, s]) => {
      setCfg(c[0] || {});
      setSettings(s[0] || { config_key: 'main', issuer_rif: '', issuer_extra_info: '', footer_note: '' });
    });
  }, []);

  if (!settings) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const { id, created_date, updated_date, created_by_id, is_sample, last_request_seq, ...data } = settings;
      const saved = id ? await base44.entities.FiscalSettings.update(id, data) : await base44.entities.FiscalSettings.create(data);
      setSettings(saved);
      toast.success('Datos del emisor guardados');
    } catch (_) {
      toast.error('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    ['Nombre', cfg.invoice_company_name || cfg.app_name], ['Dirección', cfg.invoice_company_address], ['Ciudad / código postal', cfg.invoice_company_city_zip],
    ['País', cfg.invoice_company_country], ['Teléfono', cfg.invoice_company_phone], ['Correo', cfg.invoice_company_email],
  ];

  return (
    <div className="max-w-2xl space-y-5">
      <div className="space-y-2 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Datos actuales del emisor (de Ajustes → Factura)</p>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v || '-'}</dd></div>)}
        </dl>
      </div>
      <FiscalField label="RIF del emisor" hint="Obligatorio para que el PDF muestre la identificación fiscal de la empresa."><Input value={settings.issuer_rif || ''} onChange={(e) => set('issuer_rif', e.target.value.toUpperCase())} maxLength={14} placeholder="J-12345678-9" /></FiscalField>
      <FiscalField label="Información fiscal adicional del emisor"><Input value={settings.issuer_extra_info || ''} onChange={(e) => set('issuer_extra_info', e.target.value)} maxLength={160} /></FiscalField>
      <FiscalField label="Nota al pie de los documentos" hint="Datos fiscales obligatorios adicionales según el mecanismo de facturación autorizado de la empresa."><Textarea rows={3} value={settings.footer_note || ''} onChange={(e) => set('footer_note', e.target.value)} maxLength={400} /></FiscalField>
      <Button type="button" disabled={saving} onClick={save}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Guardar</Button>
    </div>
  );
}