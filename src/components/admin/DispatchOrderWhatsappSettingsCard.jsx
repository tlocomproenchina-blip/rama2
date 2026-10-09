import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MessageCircle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { cleanWhatsappPhone } from '@/lib/dispatchOrderTxt';

// Número de WhatsApp del teléfono del almacén: lo usa la pantalla Orden de Despacho
// para mandar en un clic la orden de las facturas pagadas del período.
export default function DispatchOrderWhatsappSettingsCard() {
  const [record, setRecord] = useState(null);
  const [phone, setPhone] = useState('');
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const rows = await base44.entities.DispatchOrderConfig
      .filter({ config_key: 'main' }, '-updated_date', 1)
      .catch(() => []);
    const found = rows?.[0] || null;
    setRecord(found);
    setPhone(found?.warehouse_whatsapp_phone || '');
    setLabel(found?.warehouse_label || '');
    setLoading(false);
  }

  async function handleSave() {
    const digits = cleanWhatsappPhone(phone);
    if (digits.length < 10) {
      toast.error('Escribe el número con código de país, sin + ni espacios (ej: 584121234567)');
      return;
    }
    setSaving(true);
    const payload = { config_key: 'main', warehouse_whatsapp_phone: digits, warehouse_label: label.trim() };
    try {
      const saved = record
        ? await base44.entities.DispatchOrderConfig.update(record.id, payload)
        : await base44.entities.DispatchOrderConfig.create(payload);
      setRecord(saved || record);
      setPhone(digits);
      toast.success('Número de WhatsApp del almacén guardado');
    } catch (error) {
      toast.error('No se pudo guardar el número del almacén');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="rounded-xl border border-border/70 bg-muted/30 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4 text-primary" /> Orden de despacho por WhatsApp
        </CardTitle>
        <CardDescription>
          Teléfono del almacén que recibe la orden con las facturas pagadas del período que elijas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="warehouse-whatsapp">Número de WhatsApp del almacén</Label>
            <Input
              id="warehouse-whatsapp"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="584121234567"
              inputMode="tel"
            />
            <p className="text-xs text-muted-foreground">Con código de país, sin +, espacios ni guiones.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="warehouse-label">Nombre del teléfono (opcional)</Label>
            <Input
              id="warehouse-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Almacén Venezuela"
            />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar número
        </Button>
      </CardContent>
    </Card>
  );
}