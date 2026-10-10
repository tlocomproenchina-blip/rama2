import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

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

// Cómo quedó la emisión: el número de factura, los montos y a quién le llegó
// el correo con su parte.
export default function WholesalerBillingResult({ result }) {
  if (!result) return null;
  return (
    <Card className="rounded-2xl border-0 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          Factura {result.invoice_number}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{result.totals?.clients || 0} cliente(s)</span>
          <span>·</span>
          <span>{result.totals?.bultos || 0} bulto(s)</span>
          <span>·</span>
          <span>{result.totals?.received_trackings || 0} tracking(s) recibido(s)</span>
          <span>·</span>
          <span className="font-semibold text-foreground">Total ${Number(result.totals?.total || 0).toFixed(2)}</span>
        </div>

        <div className="space-y-1.5">
          {(result.clientes || []).map((client) => (
            <div key={client.client_email} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{client.client_name || client.client_email}</p>
                <p className="truncate text-xs text-muted-foreground">{client.client_email}</p>
                {client.email_error && (
                  <p className="text-xs text-destructive">{client.email_error}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-medium text-foreground">${Number(client.total || 0).toFixed(2)}</span>
                <Badge variant={EMAIL_VARIANT[client.email_status] || 'outline'}>
                  {EMAIL_LABEL[client.email_status] || client.email_status}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {(result.warnings || []).length > 0 && (
          <div className="space-y-1 rounded-xl border border-amber-300/60 bg-amber-50/60 p-3 text-xs text-amber-900">
            {(result.warnings || []).map((warning, index) => (
              <p key={index} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{warning}</span>
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}