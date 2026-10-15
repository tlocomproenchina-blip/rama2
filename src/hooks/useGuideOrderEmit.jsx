import { useCallback, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';
import { generateDispatchGuidePdf } from '@/lib/dispatchGuidePdf';

// Emite la guía con las contenedores marcados (tengan o no bulto registrado),
// genera sola la orden de despacho de cada cliente y descarga el PDF para imprimir.
export default function useGuideOrderEmit({ appName, onGenerated }) {
  const [emitting, setEmitting] = useState(false);

  const emit = useCallback(
    async (orders) => {
      const list = Array.isArray(orders) ? orders : [];
      if (!list.length) {
        toast.error('Marca al menos una contenedor');
        return false;
      }

      setEmitting(true);
      try {
        const res = await base44.functions.invoke('createDispatchGuide', {
          orders: list.map((order) => ({
            client_email: order.client_email,
            order_number: order.order_number,
          })),
          with_orders: true,
        });
        const data = res?.data || res || {};
        if (data.error) throw new Error(data.error);

        const guide = data.guide || {};
        toast.success(
          `Guía ${guide.guide_number || ''} emitida · ${(data.orders || []).length} orden(es) de despacho generada(s)`
        );

        if (data.skipped_orders?.length) {
          toast.warning(
            `No entraron ${data.skipped_orders.length} orden(es): ${data.skipped_orders
              .map((item) => `${item.order_number} (${item.reason})`)
              .join(' · ')}`
          );
        }
        if (data.orders_failed?.length) {
          toast.warning(
            `${data.orders_failed.length} cliente(s) sin orden automática: ${data.orders_failed
              .map((item) => item.client)
              .join(', ')}`
          );
        }

        if (guide.clients?.length) {
          await generateDispatchGuidePdf({
            clients: guide.clients,
            appName,
            mode: 'save',
            guideNumber: guide.guide_number,
            emittedAt: guide.emitted_date,
          });
        }

        onGenerated?.();
        return true;
      } catch (error) {
        toast.error(error?.message || 'No se pudo emitir la guía');
        return false;
      } finally {
        setEmitting(false);
      }
    },
    [appName, onGenerated]
  );

  return { emit, emitting };
}