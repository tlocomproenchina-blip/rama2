import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FileDown, Printer, Pencil, Trash2, Ban, Package as PackageIcon, Receipt, CheckCircle2, FileText, DollarSign, AlertCircle, Copy } from 'lucide-react';
import { groupItemsByReceipt } from '@/lib/dispatchOrderGroups';
import { toast } from 'sonner';

export default function DispatchOrderCard({ order, liveReceiptTotals, invoiceInfo, onEdit, onDelete, onCancel, onDownload, onPrint, onToggleDespachado, togglingDespachado, selectable, selected, onSelectToggle }) {
  const items = Array.isArray(order.items) ? order.items : [];
  const cancelled = order.status === 'cancelada';
  const despachado = order.status === 'despachado';
  const receiptGroups = groupItemsByReceipt(items);
  const hasReceipts = receiptGroups.some((g) => g.receipt !== 'Sin recibo');
  // Totales en vivo desde CbmIngreso (prioridad); fallback al snapshot guardado
  const receiptTotals = { ...(order.receipt_totals || {}), ...(liveReceiptTotals || {}) };

  // Texto de estado de factura/pago para el encabezado de la info copiable
  const snap = order.client_snapshot || {};
  const statusHeader = !invoiceInfo?.hasInvoice
    ? 'Sin Factura'
    : invoiceInfo.isPaid
      ? 'Factura Pagada'
      : 'Factura No Pagada';

  const clientInfoText = [
    statusHeader,
    `Shipping Mark: ${order.shipping_mark || snap.shipping_mark || ''}`,
    `Nombre: ${snap.full_name || order.client_name || ''}`,
    `Ciudad: ${snap.city || ''}`,
    `Dirección: ${snap.address || ''}`,
    `Contacto: ${snap.whatsapp || ''}`,
  ].join('\n');

  const handleCopyInfo = () => {
    navigator.clipboard?.writeText(clientInfoText).then(
      () => toast.success('Información del cliente copiada'),
      () => toast.error('No se pudo copiar')
    );
  };

  const statusBadge = cancelled
    ? <Badge className="bg-rose-600 text-white">Cancelada</Badge>
    : despachado
      ? <Badge className="bg-blue-600 text-white flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Despachada</Badge>
      : <Badge className="bg-emerald-600 text-white">Emitida</Badge>;

  return (
    <Card className={cancelled ? 'border-rose-200 bg-rose-50/50' : despachado ? 'border-blue-200 bg-blue-50/40' : ''}>
      <CardContent className="p-4 space-y-3">
        {selectable && (
          <label className="flex items-center gap-2 cursor-pointer select-none pb-2 border-b border-slate-100">
            <Checkbox
              checked={!!selected}
              onCheckedChange={() => onSelectToggle?.(order.id)}
            />
            <span className="text-xs font-medium text-slate-600">Seleccionar para fusionar</span>
          </label>
        )}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-slate-800 break-all">{order.order_number || '—'}</p>
            <p className="text-sm text-slate-700 break-words">{order.client_name || order.client_email}</p>
            <p className="text-xs text-slate-500 break-all">
              {order.shipping_mark ? `${order.shipping_mark} · ` : ''}
              {order.dispatched_date ? new Date(order.dispatched_date).toLocaleString('es-VE') : ''}
            </p>
            {despachado && order.dispatched_confirmed_date && (
              <p className="text-xs text-blue-600 mt-0.5">
                Despachado: {new Date(order.dispatched_confirmed_date).toLocaleString('es-VE')}
              </p>
            )}
          </div>
          {statusBadge}
        </div>

        {/* Badges de factura / pago */}
        {invoiceInfo && (
          <div className="flex flex-wrap items-center gap-2">
            {invoiceInfo.hasInvoice ? (
              <Badge variant="outline" className="text-xs gap-1 border-violet-300 bg-violet-50 text-violet-700">
                <FileText className="h-3 w-3" />
                Factura: {invoiceInfo.invoices.map((inv) => inv.number || '—').join(', ')}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs gap-1 border-slate-300 bg-slate-50 text-slate-500">
                <AlertCircle className="h-3 w-3" />
                Sin factura
              </Badge>
            )}
            {invoiceInfo.hasInvoice && (
              invoiceInfo.isPaid ? (
                <Badge variant="outline" className="text-xs gap-1 border-emerald-300 bg-emerald-50 text-emerald-700">
                  <DollarSign className="h-3 w-3" />
                  Pagada
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs gap-1 border-amber-300 bg-amber-50 text-amber-700">
                  <DollarSign className="h-3 w-3" />
                  Pendiente de pago
                </Badge>
              )
            )}
          </div>
        )}

        {/* Bloque de info del cliente copiable */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Info del cliente</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={handleCopyInfo}>
              <Copy className="h-3 w-3" /> Copiar
            </Button>
          </div>
          <pre className="select-text whitespace-pre-wrap break-words text-xs text-slate-700 font-sans leading-relaxed">{clientInfoText}</pre>
        </div>

        {/* Casilla de despachado */}
        {!cancelled && (
          <label className="flex items-center gap-2 cursor-pointer select-none py-1">
            <Checkbox
              checked={despachado}
              disabled={togglingDespachado}
              onCheckedChange={() => onToggleDespachado?.(order)}
            />
            <span className={`text-sm font-medium ${despachado ? 'text-blue-700' : 'text-slate-600'}`}>
              {despachado ? 'Despachado confirmado' : 'Marcar como despachado'}
            </span>
          </label>
        )}

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <PackageIcon className="h-4 w-4 shrink-0" />
          <span>{items.length} paquete{items.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Agrupación por recibo */}
        <div className="space-y-2">
          {receiptGroups.map((group) => {
            const receiptKey = group.receipt !== 'Sin recibo' ? group.receipt : '';
            const totalForReceipt = receiptKey && receiptTotals[receiptKey] ? receiptTotals[receiptKey] : null;
            const hasTotal = totalForReceipt != null && totalForReceipt > 0;
            const missing = hasTotal ? Math.max(0, totalForReceipt - group.count) : 0;
            const complete = hasTotal && missing === 0;
            return (
              <div key={group.receipt} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <Receipt className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span className="text-xs font-semibold text-slate-700">
                    {hasReceipts && group.receipt !== 'Sin recibo' ? `Recibo ${group.receipt}` : group.receipt}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {group.count} paquete{group.count !== 1 ? 's' : ''}
                  </Badge>
                  {hasTotal && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${complete ? 'text-emerald-700 border-emerald-300 bg-emerald-50' : 'text-rose-600 border-rose-300 bg-rose-50'}`}
                    >
                      {complete ? `Completo: ${group.count}/${totalForReceipt}` : `Faltan: ${missing} de ${totalForReceipt}`}
                    </Badge>
                  )}
                </div>
                <ul className="space-y-0.5 pl-5">
                  {group.items.map((item, idx) => (
                    <li key={idx} className="text-xs font-mono text-slate-600 break-all">
                      {item.tracking_number}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onDownload(order)}>
            <FileDown className="h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="text-blue-700 border-blue-300" onClick={() => onPrint(order)}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          {!despachado && (
            <Button variant="outline" size="sm" onClick={() => onEdit(order)}>
              <Pencil className="h-4 w-4" /> Modificar
            </Button>
          )}
          {!cancelled && (
            <Button variant="outline" size="sm" className="text-amber-700 border-amber-300" onClick={() => onCancel(order)}>
              <Ban className="h-4 w-4" /> Cancelar
            </Button>
          )}
          <Button variant="outline" size="sm" className="text-rose-600 border-rose-300" onClick={() => onDelete(order)}>
            <Trash2 className="h-4 w-4" /> Borrar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}