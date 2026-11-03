import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

const EMAIL_LABEL = {
  enviado: 'Correo enviado',
  fallido: 'Correo con error',
  omitido: 'Correo omitido',
  sin_correo: 'Sin correo',
  pendiente: 'Pendiente',
};

const EMAIL_VARIANT = {
  enviado: 'secondary',
  fallido: 'destructive',
  omitido: 'outline',
  sin_correo: 'outline',
  pendiente: 'outline',
};

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-VE', {
      timeZone: 'America/Caracas',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_) {
    return '';
  }
}

// Las facturas ya emitidas al mayorista, con lo que pagó cada cliente y cómo
// quedó el correo que se le mandó.
export default function WholesalerBillingHistory({ invoices, loading }) {
  const [openId, setOpenId] = useState(null);

  return (
    <Card className="rounded-2xl border-0 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">Facturas emitidas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando facturas…
          </div>
        ) : !invoices.length ? (
          <p className="py-3 text-sm text-muted-foreground">Todavía no se le ha facturado a este mayorista.</p>
        ) : (
          invoices.map((invoice) => {
            const open = openId === invoice.id;
            return (
              <div key={invoice.id} className="rounded-xl border border-border/70">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : invoice.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm text-foreground">{invoice.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(invoice.emitted_date)} · {invoice.totals?.clients || 0} cliente(s)
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      ${Number(invoice.totals?.total || 0).toFixed(2)}
                    </span>
                    <Badge variant={invoice.emails_failed ? 'destructive' : 'secondary'}>
                      {invoice.emails_sent || 0} enviado(s){invoice.emails_failed ? ` / ${invoice.emails_failed} error` : ''}
                    </Badge>
                    {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {open && (
                  <div className="space-y-2 border-t border-border/60 p-3">
                    {(invoice.clients || []).map((client) => (
                      <div key={client.client_email} className="rounded-xl bg-accent/40 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-foreground">{client.client_name || client.client_email}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {String(Number(client.cbm || 0).toFixed(4)).replace(/\.?0+$/, '') || '0'} CBM ·{' '}
                              {client.bultos || 0} bulto(s) · {client.received_trackings || 0} tracking(s) recibido(s)
                              {client.rate_per_cbm !== undefined
                                ? ` · envío $${Number(client.rate_per_cbm || 0).toFixed(2)}/CBM · puerta a puerta $${Number(client.rate_per_bulto || 0).toFixed(2)}/bulto`
                                : ''}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-sm font-medium text-foreground">${Number(client.total || 0).toFixed(2)}</span>
                            <Badge variant={EMAIL_VARIANT[client.email_status] || 'outline'}>
                              {EMAIL_LABEL[client.email_status] || client.email_status}
                            </Badge>
                          </div>
                        </div>
                        {(client.orders || []).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {client.orders.map((order) => (
                              <Badge key={order.order_number} variant="outline" className="font-mono text-[11px]">
                                {order.order_number} · {order.bultos || 0} bulto(s) · {order.received_trackings || 0} recibido(s)
                              </Badge>
                            ))}
                          </div>
                        )}
                        {client.email_error && <p className="mt-1 text-xs text-destructive">{client.email_error}</p>}
                      </div>
                    ))}

                    {(invoice.warnings || []).length > 0 && (
                      <div className="space-y-1 rounded-xl border border-amber-300/60 bg-amber-50/60 p-3 text-xs text-amber-900">
                        {(invoice.warnings || []).map((warning, index) => (
                          <p key={index}>{warning}</p>
                        ))}
                      </div>
                    )}

                    {invoice.notes && <p className="text-xs text-muted-foreground">Nota: {invoice.notes}</p>}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}