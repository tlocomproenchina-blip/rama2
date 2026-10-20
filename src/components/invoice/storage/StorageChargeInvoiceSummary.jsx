import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, Warehouse } from 'lucide-react';
import {
  contractDay,
  formatDate,
  invoiceNotices,
  invoiceStorageLines,
} from '@/lib/storageAudit';

// Resumen por factura de los cargos automáticos de almacenamiento y custodia, con
// el estado de los avisos al cliente. Solo aparece cuando la factura tiene algo
// que mostrar: cargos registrados, líneas activas o avisos ya enviados.
export default function StorageChargeInvoiceSummary({ invoice, summary, onOpenDetail }) {
  const lines = invoiceStorageLines(invoice);
  const notices = invoiceNotices(invoice);
  const registered = Number(summary?.total) || 0;
  const days = Number(summary?.days) || 0;
  const forklift = Number(summary?.forklift) || 0;
  const anyNotice = notices.some((notice) => notice.sent);

  if (!registered && !lines.total && !anyNotice) return null;

  const day = contractDay(invoice?.invoice_date);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
          <Warehouse className="h-3.5 w-3.5" />
          Almacenamiento automático
        </span>
        {day > 0 && <Badge variant="outline" className="border-amber-300 bg-white text-[10px] text-amber-800">Día {day} del contrato</Badge>}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-7 px-2 text-[11px] text-amber-800 hover:bg-amber-100"
          onClick={() => onOpenDetail?.(invoice)}
        >
          <History className="mr-1 h-3.5 w-3.5" />
          Ver detalle
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-[11px] text-slate-600">
          {days ? `${days} día(s) cobrados` : 'sin días cobrados'}
          {forklift > 0 ? ' · con montacargas' : ''}
        </p>
        <p className="text-[11px] text-slate-600">
          Aviso de cargos: <span className="font-semibold text-slate-800">{summary?.notifiedDate ? `enviado ${formatDate(summary.notifiedDate)}` : 'pendiente'}</span>
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Avisos contractuales:</span>
        {notices.map((notice) => (
          <Badge
            key={notice.key}
            variant="outline"
            className={`text-[10px] ${notice.sent ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-500'}`}
          >
            {notice.days} días {notice.sent ? 'enviado' : 'pendiente'}
          </Badge>
        ))}
      </div>
    </div>
  );
}