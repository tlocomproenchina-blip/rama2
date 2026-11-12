import React from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { money } from '@/lib/fiscalCalc';
import { fmtDate } from '@/lib/fiscalStatus';
import FiscalStatusBadge from '@/components/fiscal/FiscalStatusBadge';
import FiscalPdfButton from '@/components/fiscal/FiscalPdfButton';

const Mark = ({ value }) => (
  <span className="inline-block rounded-md bg-secondary px-2 py-1 font-mono text-xs font-bold text-secondary-foreground">{value || 'Sin mark'}</span>
);

export default function FiscalAdminTable({ rows, onOpen }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {['Solicitud', 'Fecha', 'Shipping Mark', 'Cliente', 'Factura original', 'Razón social', 'RIF', 'Subtotal', 'IVA', 'Total', 'Estado', 'Acciones'].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2.5 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-accent/30">
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold">{r.request_number}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{fmtDate(r.created_date)}</td>
                <td className="px-3 py-2.5"><Mark value={r.shipping_mark} /></td>
                <td className="whitespace-nowrap px-3 py-2.5">{r.client_name || r.client_email}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{r.invoice_number || '-'}</td>
                <td className="px-3 py-2.5">{r.legal_name || '-'}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{r.rif || '-'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{money(r.subtotal)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{money(r.vat_amount)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums">{money(r.total)}</td>
                <td className="px-3 py-2.5"><FiscalStatusBadge status={r.status} /></td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={() => onOpen(r.id)}><Eye className="h-4 w-4" /> Gestionar</Button>
                    {r.total > 0 ? <FiscalPdfButton request={r} label="PDF" /> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <Mark value={r.shipping_mark} />
                <FiscalStatusBadge status={r.status} />
              </div>
              <p className="text-sm font-semibold">{r.request_number} - {r.client_name || r.client_email}</p>
              <p className="text-xs text-muted-foreground">Factura {r.invoice_number || '-'} - {fmtDate(r.created_date)}</p>
              <p className="text-sm">{r.legal_name || '-'} {r.rif ? `(${r.rif})` : ''}</p>
              <p className="text-sm">Subtotal {money(r.subtotal)} - IVA {money(r.vat_amount)} - <span className="font-bold">Total {money(r.total)}</span></p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => onOpen(r.id)}><Eye className="h-4 w-4" /> Gestionar</Button>
                {r.total > 0 ? <FiscalPdfButton request={r} label="PDF" /> : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}