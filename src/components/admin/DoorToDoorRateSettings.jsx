import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { loadDoorToDoorConfig, DEFAULT_DOOR_RATE_PER_CBM } from '@/lib/doorToDoorRate';

export default function DoorToDoorRateSettings() {
  const [record, setRecord] = useState(null);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDoorToDoorConfig().then((cfg) => {
      setRecord(cfg);
      setValue(String(cfg?.rate_per_cbm ?? DEFAULT_DOOR_RATE_PER_CBM));
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    const rate = Number(value);
    if (value === '' || !Number.isFinite(rate) || rate < 0) {
      setError('Ingresa un monto válido, igual o mayor a 0.');
      return;
    }
    setError('');
    setSaving(true);
    const me = await base44.auth.me();
    const data = { config_key: 'main', rate_per_cbm: rate, updated_by: me?.email };
    const saved = record
      ? await base44.entities.DoorToDoorConfig.update(record.id, data)
      : await base44.entities.DoorToDoorConfig.create(data);
    setRecord(saved);
    setSaving(false);
    toast.success('Tarifa puerta a puerta guardada');
  };

  return (
    <Card className="rounded-2xl border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-primary" /> Envío puerta a puerta</CardTitle>
        <CardDescription>Costo por CBM que suman las calculadoras cuando el cliente elige entrega puerta a puerta.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 md:p-6 md:pt-0">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <>
            <div className="space-y-2">
              <Label>Costo puerta a puerta (USD por CBM)</Label>
              <Input type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <p className="text-xs text-muted-foreground">Se multiplica por el volumen facturable de la cotización.</p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar tarifa puerta a puerta
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}