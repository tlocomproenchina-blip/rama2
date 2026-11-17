import React, { useState } from 'react';
import { toast } from 'sonner';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { piCall } from '@/lib/providerInvoicesApi';
import { withoutExcluded } from '@/lib/excludedAccounts';
import { generatePaidProviderReportPdf } from '@/lib/providerPaidReportPdf';

// Exporta las facturas pagadas al proveedor usando el cliente y el período (fecha de pago) de los filtros.
export default function ProviderPaidReportButton({ filters }) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const data = await piCall('paidReport', { client: filters.client, from: filters.from, to: filters.to });
      const items = withoutExcluded(data.items);
      if (!items.length) { toast.info('No hay facturas pagadas para exportar con esos filtros.'); return; }
      await generatePaidProviderReportPdf(items, filters);
      toast.success(`Informe generado con ${items.length} factura(s)`);
    } catch (e) {
      toast.error(e?.message || 'No se pudo generar el informe');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" onClick={run} disabled={busy} title="Facturas pagadas; el período se aplica a la fecha de pago">
      {busy ? <Loader2 className="animate-spin" /> : <FileDown />} Informe PDF pagadas
    </Button>
  );
}