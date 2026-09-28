import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

function CheckoutInner({ onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setMessage('');

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      setMessage(error.message || 'No se pudo procesar el pago');
    } else if (paymentIntent) {
      if (paymentIntent.status === 'succeeded') {
        onSuccess?.(paymentIntent);
      } else if (paymentIntent.status === 'processing') {
        setMessage('Tu pago está en procesamiento, te notificaremos cuando se confirme.');
      } else {
        setMessage('El pago no se completó, intenta nuevamente.');
      }
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {message && <p className="text-sm text-rose-600">{message}</p>}
      <Button type="submit" disabled={!stripe || submitting} className="w-full">
        {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/> Procesando...</> : 'Pagar'}
      </Button>
    </form>
  );
}

export default function StripeCheckout({ clientSecret, publishableKey, onSuccess }) {
  const [stripe, setStripe] = useState(null);

  useEffect(() => {
    let mounted = true;
    if (publishableKey) {
      loadStripe(publishableKey).then((s) => { if (mounted) setStripe(s); });
    }
    return () => { mounted = false; };
  }, [publishableKey]);

  if (!clientSecret || !publishableKey) return null;

  return (
    <Elements stripe={stripe} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
      <CheckoutInner onSuccess={onSuccess} />
    </Elements>
  );
}