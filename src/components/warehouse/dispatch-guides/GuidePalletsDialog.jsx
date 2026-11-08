import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/components/api/ApiQueueManager';
import { buildPalletEntries, palletClientKey, palletCountFor, palletsTotalOf } from '@/lib/guidePallets';
import GuidePalletsInputs from './GuidePalletsInputs';

// Anota o corrige las paletas físicas de una guía ya emitida. Solo toca las paletas:
// los bultos y cajas de la guía quedan igual.
export default function GuidePalletsDialog({ guide, open, onOpenChange, onSaved }) {
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  const clients = useMemo(
    () =>
      (Array.isArray(guide?.clients) ? guide.clients : []).map((client) => ({
        key: palletClientKey(client),
        client_email: client.client_email || '',
        client_name: String(client.client_name || client.client_email || '').replace(/^Sin registrar(?= —|$)/i, 'Cliente'),
        shipping_mark: client.shipping_mark || client.client?.shipping_mark || '',
        bultos: Number(client.totals?.bultos) || (client.bultos || []).length,
      })),
    [guide]
  );

  useEffect(() => {
    if (!open) return;
    const initial = {};
    clients.forEach((client) => {
      const count = palletCountFor(guide?.pallets, client);
      initial[client.key] = count ? String(count) : '';
    });
    setValues(initial);
  }, [open, clients, guide]);

  const save = async () => {
    setSaving(true);
    try {
      const me = await base44.auth.me();
      const pallets = buildPalletEntries(clients, values);
      await base44.entities.DispatchGuide.update(guide.id, {
        pallets,
        pallets_total: palletsTotalOf(pallets),
        pallets_updated_by: me?.email || '',
        pallets_updated_date: new Date().toISOString(),
      });
      toast.success('Paletas guardadas en la guía');
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast.error(error?.message || 'No se pudieron guardar las paletas');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Paletas de la guía {guide?.guide_number}</DialogTitle>
          <DialogDescription>
            Lo que cuenta el transporte. Los bultos de cada cliente siguen igual en la guía.
          </DialogDescription>
        </DialogHeader>
        <GuidePalletsInputs clients={clients} values={values} onChange={setValues} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar paletas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}