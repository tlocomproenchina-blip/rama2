import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { FilePlus2, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useUnlinkedProviderInvoices from '@/hooks/useUnlinkedProviderInvoices';
import { createReceiptFromProviderInvoice, missingReceiptFields } from '@/lib/receiptFromProviderInvoice';

// Facturas de proveedor sin recibo: permite crear el recibo con sus datos y vincularlo en un clic.
export default function UnlinkedProviderInvoices({ client, version, onCreated }) {
  const { items, remove } = useUnlinkedProviderInvoices(client, version);
  const [busyId, setBusyId] = useState(null);
  const inFlight = useRef(new Set());

  if (!items.length) return null;

  const handleCreate = async (pi) => {
    if (inFlight.current.has(pi.id)) return;
    inFlight.current.add(pi.id);
    setBusyId(pi.id);
    try {
      await createReceiptFromProviderInvoice(pi, client);
      remove(pi.id);
      toast.success(`Recibo ${pi.invoice_code} creado y vinculado`);
      onCreated?.();
    } catch (e) {
      toast.error(e?.message || 'No se pudo crear el recibo');
    } finally {
      inFlight.current.delete(pi.id);
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-primary/25 bg-accent/40 p-4 space-y-3">
      <div>
        <p className="font-display text-sm font-semibold text-foreground">Facturas de proveedor sin recibo ({items.length})</p>
        <p className="text-xs text-muted-foreground">Crea el recibo con los datos de la factura y quedará listo para facturar.</p>
      </div>
      {items.map((pi) => {
        const missing = missingReceiptFields(pi, client);
        return (
          <div key={pi.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
            <div className="min-w-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground"><FileText className="h-4 w-4 text-primary" /> Factura {pi.invoice_code}</span>
              <span className="font-display font-bold text-primary">{Number(pi.cbm || 0)} CBM</span>
              <span className="text-xs text-muted-foreground">{pi.client_name || pi.shipping_mark}{pi.load_date ? ` · Carga ${pi.load_date}` : ''}</span>
              {missing.length > 0 && <span className="text-xs text-destructive">Falta: {missing.join(', ')}</span>}
            </div>
            <Button size="sm" disabled={busyId === pi.id || missing.length > 0} onClick={() => handleCreate(pi)}>
              {busyId === pi.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
              Crear recibo
            </Button>
          </div>
        );
      })}
    </div>
  );
}