import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, FileText, MessageCircle } from 'lucide-react';

function sentLabel(value) {
  const date = new Date(value || '');
  if (!value || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function DispatchOrderActions({ sheet, phone, warehouseLabel, onWhatsapp, onDownload, onCopy }) {
  const sent = sentLabel(sheet?.whatsapp_sent_date);

  return (
    <Card className="border-border/70 shadow-card">
      <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">Enviar la orden al almacén</p>
          <p className="text-sm text-muted-foreground">
            {phone
              ? `${warehouseLabel || 'Almacén'} · WhatsApp ${phone}`
              : 'Todavía no hay número de WhatsApp del almacén configurado.'}
          </p>
          {sent ? (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Enviada el {sent}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onWhatsapp} disabled={!phone}>
            <MessageCircle className="h-4 w-4 mr-2" /> Enviar por WhatsApp
          </Button>
          <Button variant="outline" onClick={onDownload}>
            <FileText className="h-4 w-4 mr-2" /> Descargar TXT
          </Button>
          <Button variant="outline" onClick={onCopy}>
            <Copy className="h-4 w-4 mr-2" /> Copiar mensaje
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}