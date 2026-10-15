import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { FileText, CreditCard, Calendar, DollarSign, ChevronDown, Wallet, Eye } from 'lucide-react';
import { format } from 'date-fns';
import InvoicePDFGenerator from './InvoicePDFGenerator';
import InvoiceAbonosList from './InvoiceAbonosList';
import InvoiceCbmOrders from './InvoiceCbmOrders';
import InvoiceCreditApply from './InvoiceCreditApply';
import useFileViewer from '@/hooks/useFileViewer';
import { getFileKind } from '@/components/common/FileViewerModal';

function InvoiceCard({ invoice, user, onPay, onDownload, showPayButton = false, onOtherPay, showOtherMethodsButton = false, onPayPal, showPayPalButton = false, onAbono, showAbonoButton = false, extraActions = null, selectionControl = null, showInsuranceBreakdown = false, isAdmin = false, onRefresh }) {
  const [abonosOpen, setAbonosOpen] = useState(false);
  const fileViewer = useFileViewer();
  const total = Number(invoice.total || 0);
  const paidAmount = Number(invoice.paid_amount || 0);
  const balance = Math.max(0, total - paidAmount);
  const hasAbonos = paidAmount > 0 || invoice.status === 'pendiente';
  const assistedDetails = invoice.items?.find((item) => item?.details)?.details || {};
  const isAssistedPayment = assistedDetails.request_type === 'assisted_payment' || String(invoice.consolidation_tracking || '').startsWith('AP-') || String(invoice.notes || '').toLowerCase().includes('pago asistido');
  const providerLabel = {
    alibaba: 'Alibaba',
    wechat: 'WeChat',
    alipay: 'Alipay',
    otro: 'Otro',
  }[assistedDetails.provider] || assistedDetails.provider || 'Pago asistido';

  const statusColors = {
    pendiente: 'bg-yellow-100 text-yellow-800',
    revision: 'bg-blue-100 text-blue-800',
    pagada: 'bg-green-100 text-green-800',
    vencida: 'bg-red-100 text-red-800',
    cancelada: 'bg-slate-100 text-slate-800'
  };

  const statusLabels = {
    pendiente: 'Pendiente',
    revision: 'En revisión',
    pagada: 'Pagada',
    vencida: 'Vencida',
    cancelada: 'Cancelada'
  };

  const invoiceItems = Array.isArray(invoice.items) ? invoice.items : [];
  const getItemTotal = (item) => Number(item?.total || 0);
  const isInsuranceItem = (item) => {
    const description = String(item?.description || '').toLowerCase();
    return description.includes('seguro') || description.includes('insurance') || Number(item?.details?.fob_value) > 0 || Number(item?.details?.insured_packages) > 0;
  };
  const insuranceTotal = invoiceItems.filter(isInsuranceItem).reduce((sum, item) => sum + getItemTotal(item), 0);
  const isConsolidationFeeItem = (item) => {
    const description = String(item?.description || '').toLowerCase().trim();
    return description.startsWith('servicio de consolidación') || description.startsWith('consolidación de carga') || description.includes('$1 por paquete');
  };
  const consolidationTotal = invoiceItems.filter(isConsolidationFeeItem).reduce((sum, item) => sum + getItemTotal(item), 0);
  const shippingTotal = Math.max(0, Number(invoice.total || 0) - insuranceTotal - consolidationTotal);

  const daysSinceInvoice = invoice.invoice_date
    ? Math.floor((Date.now() - new Date(invoice.invoice_date).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const daysBadgeClass = daysSinceInvoice === null ? ''
    : daysSinceInvoice >= 45 ? 'bg-red-100 text-red-700'
    : daysSinceInvoice >= 30 ? 'bg-orange-100 text-orange-700'
    : daysSinceInvoice >= 20 ? 'bg-amber-100 text-amber-700'
    : 'bg-slate-100 text-slate-600';

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0">
          {selectionControl && <div className="pt-1 shrink-0">{selectionControl}</div>}
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg text-slate-800 break-words">{invoice.invoice_number || 'Factura'}</CardTitle>
              {isAssistedPayment ? (
                <div className="mt-1 space-y-2 text-sm text-slate-500">
                  <p>Pago asistido · {providerLabel}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">Cliente: {user?.full_name || user?.email || invoice.client_email}</Badge>
                    {assistedDetails.link_url && (
                      <a href={assistedDetails.link_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline underline-offset-2">Ver enlace</a>
                    )}
                    {assistedDetails.qr_url && (
                      <a href={assistedDetails.qr_url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline underline-offset-2">Ver QR</a>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-500 mt-1 break-words">
                    Consolidación: {invoice.consolidation_tracking}
                  </p>
                  {(invoice.shipping_mark || invoice.client_first_name || invoice.client_last_name || invoice.client_whatsapp) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {invoice.shipping_mark && (
                        <Badge variant="outline" className="font-mono text-xs">
                          {invoice.shipping_mark}
                        </Badge>
                      )}
                      {(invoice.client_first_name || invoice.client_last_name) && (
                        <span className="text-xs text-slate-600">
                          {`${invoice.client_first_name || ''} ${invoice.client_last_name || ''}`.trim()}
                        </span>
                      )}
                      {invoice.client_whatsapp && (
                        <span className="text-xs text-slate-500">· {invoice.client_whatsapp}</span>
                      )}
                    </div>
                  )}
                </>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(invoice.invoice_date), 'dd/MM/yyyy')}
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  ${invoice.total.toFixed(2)}
                </span>
                {daysSinceInvoice !== null && invoice.status === 'pendiente' && (
                  <Badge className={`text-xs ${daysBadgeClass}`}>
                    {daysSinceInvoice} día{daysSinceInvoice === 1 ? '' : 's'}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge className={`${statusColors[invoice.status]} whitespace-nowrap`}>
              {statusLabels[invoice.status]}
            </Badge>
            {invoice.dispatched && (
              <Badge className="bg-blue-100 text-blue-800">
                🚚 Despachada{invoice.dispatched_date ? ` · ${format(new Date(invoice.dispatched_date), 'dd/MM/yyyy')}` : ''}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-4">
          {invoiceItems.map((item, idx) => (
            <div key={idx} className="flex justify-between gap-4 text-sm">
              <span className="text-slate-600 min-w-0 break-all">{item.description}</span>
              <span className="font-medium text-slate-800 shrink-0">${getItemTotal(item).toFixed(2)}</span>
            </div>
          ))}
          {showInsuranceBreakdown && insuranceTotal > 0 && (
            <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 space-y-1 text-sm">
              <div className="flex justify-between gap-4 text-slate-700">
                <span>Subtotal envío</span>
                <span className="font-semibold shrink-0">${shippingTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4 text-emerald-700">
                <span>Seguro cobrado</span>
                <span className="font-semibold shrink-0">${insuranceTotal.toFixed(2)}</span>
              </div>
              {consolidationTotal > 0 && (
                <div className="flex justify-between gap-4 text-slate-700">
                  <span>Servicio de consolidación</span>
                  <span className="font-semibold shrink-0">${consolidationTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
          <div className="border-t pt-2 flex justify-between font-semibold text-slate-800">
            <span>Total</span>
            <span>${Number(invoice.total || 0).toFixed(2)}</span>
          </div>
          {paidAmount > 0 && (
            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-2 space-y-1 text-sm">
              <div className="flex justify-between text-emerald-700">
                <span>Abonos aprobados</span>
                <span className="font-semibold">${paidAmount.toFixed(2)}</span>
              </div>
              {balance > 0 && invoice.status !== 'pagada' && (
                <div className="flex justify-between text-amber-700">
                  <span>Saldo pendiente</span>
                  <span className="font-semibold">${balance.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CBM de cada contenedor y total de la factura */}
        <InvoiceCbmOrders invoice={invoice} />

        {/* Sección colapsable de abonos */}
        {hasAbonos && (
          <Collapsible open={abonosOpen} onOpenChange={setAbonosOpen} className="mb-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-slate-600 hover:text-slate-800">
                <span className="flex items-center gap-2">
                  <Wallet className="h-3.5 w-3.5" /> Ver abonos
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${abonosOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <InvoiceAbonosList invoice={invoice} isAdmin={isAdmin} onRefresh={onRefresh} />
            </CollapsibleContent>
          </Collapsible>
        )}

        <InvoiceCreditApply invoice={invoice} onApplied={onRefresh} />

        {invoice.status === 'revision' && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-sm">
            Pago enviado. Tu comprobante está en revisión por un administrador.
          </div>
        )}

         <div className="flex gap-2 flex-wrap">
          {showPayPalButton && invoice.status === 'pendiente' && (
            <Button 
              onClick={() => onPayPal?.(invoice)}
              variant="outline"
              className="flex-1"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Pagar con Débito / Crédito
            </Button>
          )}

          {/* Si está pagada o en revisión, nunca mostrar botones de pago */}
          {showOtherMethodsButton && invoice.status === 'pendiente' && (
            <Button
              onClick={() => onOtherPay?.(invoice)}
              variant="outline"
              className="flex-1"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Pagar Consolidación
            </Button>
          )}

          {showAbonoButton && invoice.status === 'pendiente' && (
            <Button
              onClick={() => onAbono?.(invoice)}
              variant="outline"
              className="flex-1"
            >
              <Wallet className="h-4 w-4 mr-2" />
              Registrar Abono
            </Button>
          )}
          {/* Oculta acciones cuando está en revisión o pagada */}
          {(invoice.status === 'revision' || invoice.status === 'pagada') && null}
          <div className="flex-1 min-w-40">
            <InvoicePDFGenerator invoice={invoice} user={user} />
          </div>
          {extraActions}
        </div>

        {invoice.status === 'pagada' && invoice.payment_date && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-100 space-y-2">
            <p className="text-sm text-green-800">
              <strong>Pagada:</strong> {format(new Date(invoice.payment_date), 'dd/MM/yyyy HH:mm')}
            </p>
            {invoice.payment_reference && (() => {
              const refKind = getFileKind(invoice.payment_reference);
              const isMediaUrl = typeof invoice.payment_reference === 'string' && /^https?:\/\//i.test(invoice.payment_reference) && (refKind === 'image' || refKind === 'pdf');
              if (isMediaUrl && refKind === 'image') {
                return (
                  <button
                    type="button"
                    onClick={() => fileViewer.open(invoice.payment_reference, 'Comprobante de pago')}
                    className="block group"
                    title="Ver comprobante"
                  >
                    <img
                      src={invoice.payment_reference}
                      alt="Comprobante de pago"
                      className="h-24 w-auto rounded-lg border border-green-200 bg-white object-cover group-hover:border-green-400 transition-colors"
                    />
                  </button>
                );
              }
              if (isMediaUrl && refKind === 'pdf') {
                return (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-green-800 border-green-200 hover:bg-green-100"
                    onClick={() => fileViewer.open(invoice.payment_reference, 'Comprobante de pago')}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" /> Ver comprobante (PDF)
                  </Button>
                );
              }
              return (
                <p className="text-xs text-green-700 mt-1 break-words">
                  Ref: {invoice.payment_reference}
                </p>
              );
            })()}
          </div>
        )}
        {fileViewer.modal}
      </CardContent>
    </Card>
  );
}

export default React.memo(InvoiceCard);