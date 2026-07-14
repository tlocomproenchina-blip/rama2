import React from 'react';
import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Client360Section from './Client360Section';

const STATUS = {
  pendiente: 'bg-amber-100 text-amber-700',
  revision: 'bg-blue-100 text-blue-700',
  pagada: 'bg-green-100 text-green-700',
  vencida: 'bg-red-100 text-red-700',
  cancelada: 'bg-slate-100 text-slate-600'
};

export default function Client360Invoices({ invoices }) {
  return (
    <Client360Section icon={FileText} title="Facturas" count={invoices.length}>
      {invoices.map((inv) => (
        <div key={inv.id} className="flex items-center gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-slate-800 truncate">{inv.invoice_number || inv.id}</p>
            <p className="text-xs text-slate-500">
              {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('es-VE') : ''}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
            ${Number(inv.total || 0).toFixed(2)}
          </span>
          <Badge className={`text-[10px] ${STATUS[inv.status] || 'bg-slate-100 text-slate-600'}`}>
            {inv.status}
          </Badge>
        </div>
      ))}
    </Client360Section>
  );
}