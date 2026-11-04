import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { piCall, money } from '@/lib/providerInvoicesApi';

export default function ProviderRateCard({ flatRate, onSaved }) {
  const [val, setVal] = useState('');
  const save = async () => {
    try { await piCall('setRate', { flat_rate: Number(val) }); toast.success('Tarifa actualizada'); setVal(''); onSaved?.(); }
    catch (err) { toast.error(err?.response?.data?.error || 'Error'); }
  };
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <p className="text-sm">Tarifa plana actual: <b className="font-display text-lg">{money(flatRate)}</b> / CBM</p>
        <Input className="w-36" type="number" step="0.01" placeholder="Nueva tarifa" value={val} onChange={(e) => setVal(e.target.value)} />
        <Button size="sm" onClick={save} disabled={!(Number(val) > 0)}>Guardar</Button>
        <p className="w-full text-xs text-muted-foreground">Las facturas ya creadas conservan la tarifa con la que se registraron.</p>
      </CardContent>
    </Card>
  );
}