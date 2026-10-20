import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronRight, Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Client360Section from './Client360Section';
import Client360InvoicePdfButton from './Client360InvoicePdfButton';
import { billableTotal } from '@/lib/storageLines';

const STATUS = {
  pendiente: 'bg-amber-100 text-amber-700',
  revision: 'bg-blue-100 text-blue-700',
  pagada: 'bg-green-100 text-green-700',
  vencida: 'bg-red-100 text-red-700',
  cancelada: 'bg-slate-100 text-slate-600'
};

export default function Client360Invoices({ invoices, recibos = [] }) {
  const [expanded, setExpanded] = useState({});

  const recibosByInvoiceId = React.useMemo(() => {
    const map = {};
    recibos.forEach((r) => {
      const key = r.billed_invoice_id;
      if (!key) return;
      (map[key] = map[key] || []).push(r);
    });
    return map;
  }, [recibos]);

  return (
    <Client360Section icon={FileText} title="Facturas" count={invoices.length}>
      {invoices.map((inv) => {
        const linked = recibosByInvoiceId[inv.id] || [];
        const isOpen = expanded[inv.id];
        return (
          <div key={inv.id} className="px-3 py-2">
            <div className="flex items-center gap-2">
              {linked.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExpanded((p) => ({ ...p, [inv.id]: !p[inv.id] }))}
                  className="text-slate-400 hover:text-slate-600 shrink-0"
                  aria-label="Ver recibos"
                >
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs text-slate-800 truncate">{inv.invoice_number || inv.id}</p>
                <p className="text-xs text-slate-500">
                  {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('es-VE') : ''}
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                ${billableTotal(inv).toFixed(2)}
              </span>
              <Badge className={`text-[10px] ${STATUS[inv.status] || 'bg-slate-100 text-slate-600'}`}>
                {inv.status}
              </Badge>
              <Client360InvoicePdfButton invoice={inv} />
            </div>

            {isOpen && linked.length > 0 && (
              <div className="mt-2 ml-6 space-y-1 border-l border-slate-200 pl-3">
                {linked.map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <Receipt className="h-3 w-3 text-slate-400 shrink-0" />
                    <p className="font-mono text-[11px] text-slate-700 truncate">
                      {r.invoice_number ? `Recibo ${r.invoice_number}` : (r.descripcion || 'Sin referencia')}
                    </p>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                      {Number(r.cbm || 0).toFixed(4)} CBM
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </Client360Section>
  );
}