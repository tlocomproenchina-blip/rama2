import React, { useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateDispatchOrderPdf } from '@/lib/dispatchOrderPdf';

export default function DispatchOrderButton({ group, email, onCreated }) {
  const [generating, setGenerating] = useState(false);

  const generateOrder = async () => {
    setGenerating(true);
    try {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
      const appName = configs?.[0]?.app_name || 'TLEC CARGO';

      const client = group.items.find((i) => i.client)?.client || {};
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
      const orderNumber = `OD-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${rand}`;

      const orderData = {
        order_number: orderNumber,
        client_email: email,
        client_name: client.full_name || group.name || email,
        shipping_mark: group.mark || client.shipping_mark || '',
        client_snapshot: {
          full_name: client.full_name || '',
          email: client.email || email,
          cedula: client.cedula || '',
          whatsapp: client.whatsapp || '',
          address: client.address || '',
          city: client.city || '',
          state: client.state || '',
          shipping_mark: client.shipping_mark || '',
        },
        items: group.items.map((i) => ({
          tracking_number: i.package?.tracking_number || '',
          description: i.package?.description || '',
        })),
        status: 'emitida',
        dispatched_date: now.toISOString(),
      };

      await base44.entities.DispatchOrder.create(orderData);
      await generateDispatchOrderPdf(orderData, appName);
      toast.success(`Orden ${orderNumber} generada y guardada en el historial`);
      onCreated?.();
    } catch (error) {
      console.error('Error generando orden:', error);
      toast.error('Error al generar la orden de despacho');
    }
    setGenerating(false);
  };

  return (
    <Button variant="outline" size="sm" onClick={generateOrder} disabled={generating}>
      {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
      Orden de Despacho
    </Button>
  );
}