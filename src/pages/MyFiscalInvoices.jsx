import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, ReceiptText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ClientPageHero from '@/components/client-portal/ClientPageHero';
import FiscalRequestCard from '@/components/fiscal/FiscalRequestCard';
import NewFiscalRequestCard from '@/components/fiscal/NewFiscalRequestCard';

export default function MyFiscalInvoices({ user }) {
  const [requests, setRequests] = useState(null);
  const [invoices, setInvoices] = useState([]);

  const load = useCallback(async () => {
    const [reqs, invs] = await Promise.all([
      base44.entities.FiscalInvoiceRequest.filter({ client_email: user.email }, '-created_date', 100),
      base44.entities.Invoice.filter({ client_email: user.email }, '-invoice_date', 100),
    ]);
    setRequests(reqs || []);
    setInvoices(invs || []);
  }, [user.email]);

  useEffect(() => { load(); }, [load]);

  if (!requests) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const available = invoices.filter(
    (inv) => ['pagada', 'revision'].includes(inv.status) && !requests.some((r) => r.invoice_id === inv.id && r.status !== 'rechazada')
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <ClientPageHero
        icon={ReceiptText}
        title="Mis facturas fiscales"
        description="Consulta tus solicitudes, el estado de cada una, completa pagos pendientes del IVA y descarga tus documentos."
      />
      <NewFiscalRequestCard invoices={available} />
      {requests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aún no tienes solicitudes. Al pagar una factura, elige SÍ en "¿Deseas solicitar una factura fiscal?".
        </p>
      ) : (
        <div className="grid gap-3">
          {requests.map((r) => <FiscalRequestCard key={r.id} request={r} />)}
        </div>
      )}
    </div>
  );
}