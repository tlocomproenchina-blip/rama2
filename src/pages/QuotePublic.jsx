import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check, FileText, Package } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import QuoteProductForm from '@/components/quotes/QuoteProductForm';
import QuoteSummary from '@/components/quotes/QuoteSummary';

export default function QuotePublic() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [contractText, setContractText] = useState('');
  const [contractFileUrl, setContractFileUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const { toast } = useToast();

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await base44.functions.invoke('getPublicQuote', { token });
        const data = res.data || res;
        setQuote(data.quote);
        setContractText(data.contract_text || '');
        setContractFileUrl(data.contract_file_url || data.quote?.contract_file_url || '');
        if (data.quote) {
          setFirstName(data.quote.client_first_name || '');
          setLastName(data.quote.client_last_name || '');
          setEmail(data.quote.client_email || '');
          setCity(data.quote.client_city || '');
          setPhone(data.quote.client_phone || '');
          setNotes(data.quote.notes || '');
          setItems(data.quote.items || []);
        }
      } catch (err) {
        console.error('Error loading quote:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const isClientStage = quote?.status === 'esperando_cliente';
  const isCompleted = quote?.status === 'completado' || quote?.status === 'enviado';

  const handleSubmit = async () => {
    if (!firstName || !lastName || !city || !phone) {
      toast({ title: 'Completa todos los campos', variant: 'destructive' });
      return;
    }
    const validItems = items.filter(it => it.link || it.image_url);
    if (validItems.length === 0) {
      toast({ title: 'Agrega al menos un producto', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      const res = await base44.functions.invoke('submitPublicQuote', {
        token,
        client_first_name: firstName,
        client_last_name: lastName,
        client_email: email,
        client_city: city,
        client_phone: phone,
        notes,
        items: validItems
      });
      const data = res.data || res;
      setQuote(data.quote);
      toast({ title: '¡Datos enviados!', description: 'El equipo te contactará pronto con tu presupuesto' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptContract = async () => {
    try {
      const res = await base44.functions.invoke('acceptQuoteContract', { token });
      const data = res.data || res;
      setQuote(data.quote);
      setAccepted(true);
      toast({ title: 'Contrato aceptado', description: 'Gracias por confirmar' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-lg font-semibold text-gray-700">Presupuesto no encontrado</p>
          <p className="mt-2 text-sm text-gray-500">El enlace no es válido o ha expirado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Header */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
          <h1 className="text-xl font-bold text-gray-800">Presupuesto {quote.quote_number}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isClientStage
              ? 'Completa tus datos y los productos que deseas cotizar'
              : 'Tu presupuesto está listo'}
          </p>
        </div>

        {/* Datos del Cliente */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-bold" style={{ color: '#c52899' }}>Datos del Cliente</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-gray-600">Nombre *</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} readOnly={isCompleted} placeholder="Tu nombre" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Apellido *</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} readOnly={isCompleted} placeholder="Tu apellido" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} readOnly={isCompleted} placeholder="tu@email.com" className="mt-1" />
              {isCompleted && quote.shipping_mark && (
                <p className="mt-1 text-xs font-medium text-green-600">
                  ✓ Shipping Mark: {quote.shipping_mark}
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-600">Ciudad de Despacho *</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} readOnly={isCompleted} placeholder="Ej: Caracas, Venezuela" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Número de Contacto *</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} readOnly={isCompleted} placeholder="Ej: +58 412 1234567" className="mt-1" />
            </div>
          </div>
          <div className="mt-4">
            <Label className="text-xs text-gray-600">Notas para el Administrador</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} readOnly={isCompleted} placeholder="Agrega información adicional..." className="mt-1" />
          </div>
        </div>

        {/* Productos */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold" style={{ color: '#c52899' }}>
            <Package className="h-4 w-4" /> Productos
          </h3>
          {isClientStage ? (
            <QuoteProductForm items={items} onChange={setItems} />
          ) : (
            <div className="space-y-3">
              {(quote.items || []).map((item, idx) => (
                <div key={idx} className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  {item.image_url && <img src={item.image_url} alt="producto" className="h-16 w-16 rounded-lg object-cover" />}
                  <div className="min-w-0 flex-1">
                    {item.link && (
                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-blue-600 hover:underline">
                        {item.link}
                      </a>
                    )}
                    <p className="text-xs text-gray-500">Cantidad: {item.quantity} {item.size ? `| Talla: ${item.size}` : ''}</p>
                    {isCompleted && (
                      <p className="mt-1 text-sm font-semibold text-gray-700">
                        {item.currency === 'USD' ? '$' : '¥'}{(item.unit_price || 0).toFixed(2)} c/u → Total: ${(item.total_usd || 0).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumen (solo si está completado) */}
        {isCompleted && (
          <QuoteSummary
            subtotalCny={quote.subtotal_cny}
            serviceTotalCny={quote.service_total_cny}
            totalCny={quote.total_cny}
            totalUsd={quote.total_usd}
            servicePercentage={quote.service_percentage}
            conversionRate={quote.conversion_rate}
          />
        )}

        {/* Contrato (solo si está completado) */}
        {isCompleted && (contractText || contractFileUrl) && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <button
              onClick={() => setShowContract(!showContract)}
              className="flex w-full items-center justify-between"
            >
              <h3 className="flex items-center gap-2 text-sm font-bold" style={{ color: '#c52899' }}>
                <FileText className="h-4 w-4" /> Contrato
              </h3>
              <span className="text-xs text-gray-500">{showContract ? 'Ocultar' : 'Ver contrato'}</span>
            </button>
            {showContract && (
              <div className="mt-3 space-y-3">
                {contractFileUrl && (
                  <a
                    href={contractFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
                  >
                    <FileText className="h-4 w-4" /> Descargar contrato
                  </a>
                )}
                {contractText && (
                  <div className="max-h-64 overflow-y-auto rounded-lg bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-wrap">
                    {contractText}
                  </div>
                )}
              </div>
            )}
            <div className="mt-4">
              {quote.contract_accepted ? (
                <p className="flex items-center gap-2 text-sm font-medium text-green-600">
                  <Check className="h-4 w-4" /> Contrato aceptado
                </p>
              ) : (
                <Button onClick={handleAcceptContract} style={{ backgroundColor: '#8b5cf6' }} className="text-white hover:opacity-90">
                  Aceptar Contrato
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Submit button (solo si está en etapa cliente) */}
        {isClientStage && (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ backgroundColor: '#8b5cf6' }}
            className="w-full text-white hover:opacity-90"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enviar Datos al Administrador
          </Button>
        )}
      </div>
    </div>
  );
}