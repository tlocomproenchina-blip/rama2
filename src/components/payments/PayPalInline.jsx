import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

function loadPayPalSdk({ clientId, currency = 'USD', intent = 'capture' }) {
  return new Promise((resolve, reject) => {
    if (window.paypal) return resolve(window.paypal);
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&components=buttons&enable-funding=card&currency=${currency}&intent=${intent}&commit=true`;
    script.onload = () => resolve(window.paypal);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

export default function PayPalInline({ invoice, onSuccess, onClose }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg = await base44.functions.invoke('getPayPalConfig', {});
        if (cfg.status !== 200 || !cfg.data?.clientId) {
          throw new Error(cfg.data?.error || 'No se pudo cargar PayPal');
        }
        const paypal = await loadPayPalSdk({ clientId: cfg.data.clientId, currency: cfg.data.currency || 'USD', intent: cfg.data.intent || 'capture' });
        if (!mounted) return;

        const buttons = paypal.Buttons({
          style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
          createOrder: async () => {
            const res = await base44.functions.invoke('createPaypalOrder', {
              invoice_id: invoice.id,
              currency: cfg.data.currency || 'USD',
            });
            if (res.status === 200 && res.data?.order_id) return res.data.order_id;
            throw new Error(res.data?.error || 'No se pudo crear la orden');
          },
          onApprove: async (data) => {
            try {
              const cap = await base44.functions.invoke('capturePaypalOrder', {
                order_id: data?.orderID,
                invoice_id: invoice.id,
              });
              if (cap.status === 200 && cap.data?.success) {
                toast.success('Pago confirmado');
                onSuccess?.();
              } else {
                throw new Error(cap.data?.error || 'No se pudo confirmar el pago');
              }
            } catch (e) {
              setError(e.message || 'Error al confirmar pago');
            }
          },
          onError: (err) => {
            setError(err?.message || 'Error en PayPal');
          }
        });
        buttons.render(containerRef.current);
        setLoading(false);
      } catch (e) {
        setError(e.message || 'No se pudo inicializar PayPal');
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [invoice?.id]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Tarjeta o PayPal</h3>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      {loading && (
        <div className="flex items-center justify-center py-8 text-slate-600">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Cargando checkout...
        </div>
      )}
      {error && (
        <div className="mb-3 p-3 rounded border border-rose-200 text-rose-700 text-sm">{error}</div>
      )}
      <div ref={containerRef} />
    </div>
  );
}