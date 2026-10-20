import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, Loader2, RefreshCw, Search, Warehouse } from 'lucide-react';
import StorageChargeDetailPanel from './StorageChargeDetailPanel';
import {
  asArray,
  fetchStorageTotals,
  formatDate,
  invoiceNotices,
  invoiceStorageLines,
  money,
} from '@/lib/storageAudit';

// Vista separada de auditoría: qué facturas llevan cargos automáticos de
// almacenamiento y retraso, cuánto se les ha sumado y cómo van los avisos.
export default function StorageChargesAuditDialog({ open, onOpenChange, focusInvoiceId }) {
  const [invoices, setInvoices] = useState([]);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [invoicePage, totalsMap] = await Promise.all([
      base44.entities.Invoice.list('-invoice_date', 300).catch(() => []),
      fetchStorageTotals(),
    ]);
    setInvoices(asArray(invoicePage));
    setTotals(totalsMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    setExpandedId(focusInvoiceId || null);
    load();
  }, [open, focusInvoiceId, load]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const summary = totals[invoice.id];
      const lines = invoiceStorageLines(invoice);
      const hasNotices = invoiceNotices(invoice).some((notice) => notice.sent);
      const relevant = (Number(summary?.total) || 0) > 0 || lines.total > 0 || hasNotices;
      if (!relevant) return false;
      if (!term) return true;
      return [invoice.invoice_number, invoice.client_email, invoice.client_first_name, invoice.shipping_mark]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [invoices, totals, search]);

  const summaryTotals = useMemo(() => rows.reduce((acc, invoice) => {
    const summary = totals[invoice.id];
    const lines = invoiceStorageLines(invoice);
    const notices = invoiceNotices(invoice);
    return {
      registered: acc.registered + (Number(summary?.total) || 0),
      onInvoice: acc.onInvoice + lines.total,
      noticed: acc.noticed + (summary?.notifiedDate ? 1 : 0),
      pending: acc.pending + (summary?.notifiedDate ? 0 : 1),
      contractNotices: acc.contractNotices + notices.filter((notice) => notice.sent).length,
    };
  }, { registered: 0, onInvoice: 0, noticed: 0, pending: 0, contractNotices: 0 }), [rows, totals]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Cargos de almacenamiento y avisos por factura
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Lo que el proceso automático ha sumado a cada factura por almacenamiento y custodia desde el día 8, más el
            estado y la fecha de los avisos enviados al cliente.
          </p>

          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Facturas con cargos</p>
              <p className="text-sm font-bold text-slate-800">{rows.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Registrado y sumado</p>
              <p className="text-sm font-bold text-slate-800">{money(summaryTotals.registered)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">En las facturas hoy</p>
              <p className="text-sm font-bold text-slate-800">{money(summaryTotals.onInvoice)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Avisos</p>
              <p className="text-sm font-bold text-slate-800">
                {summaryTotals.noticed} enviados · {summaryTotals.pending} pendientes
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por factura, cliente o shipping mark..."
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
              Actualizar
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
            </div>
          ) : rows.length === 0 ? (
            <p className="rounded-lg bg-slate-50 py-10 text-center text-sm text-slate-500">
              Ninguna factura tiene cargos de almacenamiento ni avisos registrados todavía.
            </p>
          ) : (
            <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
              {rows.map((invoice) => {
                const summary = totals[invoice.id] || {};
                const lines = invoiceStorageLines(invoice);
                const isOpen = expandedId === invoice.id;
                return (
                  <div key={invoice.id} className="rounded-xl border border-slate-200 bg-card">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : invoice.id)}
                      className="flex w-full flex-wrap items-center gap-2 p-3 text-left"
                    >
                      <div className="min-w-[190px] flex-1">
                        <p className="text-sm font-semibold text-slate-800">{invoice.invoice_number || invoice.id}</p>
                        <p className="text-[11px] text-slate-500">{invoice.client_email}</p>
                      </div>
                      <Badge variant="outline" className="text-[11px]">{invoice.status}</Badge>
                      <span className="text-[11px] text-slate-600">
                        Registrado <strong className="text-slate-800">{money(summary.total)}</strong>
                        {summary.days ? ` · ${summary.days} día(s)` : ''}
                      </span>
                      <span className="text-[11px] text-slate-600">
                        En factura <strong className="text-slate-800">{money(lines.total)}</strong>
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[11px] ${summary.notifiedDate ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-500'}`}
                      >
                        {summary.notifiedDate ? `Aviso ${formatDate(summary.notifiedDate)}` : 'Aviso pendiente'}
                      </Badge>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </button>
                    {isOpen && (
                      <div className="border-t border-slate-200 p-3">
                        <StorageChargeDetailPanel invoice={invoice} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}