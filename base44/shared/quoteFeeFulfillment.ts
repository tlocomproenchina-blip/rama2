// Lógica compartida para fulfill de pagos de tarifa de presupuesto.
// Usado por confirmQuoteFeePayment (PayPal y métodos manuales).

export function generateQuoteToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * Marca un QuoteFeePayment como pagado, genera un Quote con token único y número PR-XXXX,
 * copia los datos del cliente y envía el email con el enlace al cliente.
 * Idempotente: si ya tiene generated_quote_id, no regenera.
 */
export async function fulfillQuoteFeePayment(base44, paymentId, transactionRef = null) {
  const payments = await base44.asServiceRole.entities.QuoteFeePayment.filter({ id: paymentId });
  const payment = payments && payments[0];
  if (!payment) throw new Error('QuoteFeePayment no encontrado');

  // Idempotencia: si ya se generó el quote, solo actualizar referencia si falta
  if (payment.status === 'pagado' && payment.generated_quote_id) {
    return { payment, quote_id: payment.generated_quote_id, already: true };
  }

  // 1. Marcar como pagado
  const now = new Date().toISOString();
  const updateData = {
    status: 'pagado',
    paid_date: now,
  };
  if (transactionRef) {
    updateData.payment_reference = transactionRef;
  }
  await base44.asServiceRole.entities.QuoteFeePayment.update(paymentId, updateData);

  // 2. Generar número de quote (max existente + 1)
  const existingQuotes = await base44.asServiceRole.entities.Quote.list('-created_date', 200);
  const maxNum = (existingQuotes || []).reduce((max, q) => {
    const m = /PR-(\d+)/i.exec(q.quote_number || '');
    const n = m ? parseInt(m[1], 10) : 0;
    return n > max ? n : max;
  }, 0);
  const quoteNumber = `PR-${String(maxNum + 1).padStart(4, '0')}`;
  const token = generateQuoteToken();

  // 3. Obtener config para conversion_rate y plantilla de email
  const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
  const config = (configs && configs[0]) || {};
  const globalRate = config.quote_conversion_rate || 0.15;

  // 4. Crear Quote
  const quote = await base44.asServiceRole.entities.Quote.create({
    token,
    quote_number: quoteNumber,
    client_first_name: payment.client_first_name,
    client_last_name: payment.client_last_name,
    client_email: payment.client_email,
    client_city: payment.client_city,
    client_phone: payment.client_phone,
    shipping_mark: payment.shipping_mark || '',
    notes: payment.notes || '',
    items: [],
    service_percentage: 15,
    conversion_rate: globalRate,
    status: 'esperando_cliente',
    created_by_email: 'sistema@tleccargo.app'
  });

  // 5. Vincular quote al pago
  await base44.asServiceRole.entities.QuoteFeePayment.update(paymentId, {
    generated_quote_id: quote.id,
    generated_quote_token: token,
    generated_quote_number: quoteNumber,
  });

  // 6. Enviar email al cliente con el enlace
  const origin = 'https://tleccargo.base44.app';
  const quoteUrl = `${origin}/Quote/${token}`;
  const clientName = `${payment.client_first_name || ''} ${payment.client_last_name || ''}`.trim() || 'cliente';

  let emailSubject = config.quote_fee_email_subject || '🎉 Tu enlace de presupuesto está listo';
  let emailBody = config.quote_fee_email_body ||
    `Hola {cliente_nombre},\n\n¡Gracias por tu pago! Tu solicitud de presupuesto fue recibida.\n\nN° de presupuesto: {numero_presupuesto}\n\nCompleta tus productos en el siguiente enlace:\n{enlace_presupuesto}\n\nTLEC CARGO`;

  emailSubject = emailSubject.replace(/\{cliente_nombre\}/g, clientName).replace(/\{numero_presupuesto\}/g, quoteNumber).replace(/\{enlace_presupuesto\}/g, quoteUrl);
  emailBody = emailBody
    .replace(/\{cliente_nombre\}/g, clientName)
    .replace(/\{numero_presupuesto\}/g, quoteNumber)
    .replace(/\{enlace_presupuesto\}/g, quoteUrl);

  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: payment.client_email,
      subject: emailSubject,
      body: emailBody,
    });
    await base44.asServiceRole.entities.QuoteFeePayment.update(paymentId, { email_sent: true });
  } catch (e) {
    console.error('Error enviando email de enlace de presupuesto:', e);
  }

  return { payment, quote_id: quote.id, quote_token: token, quote_number: quoteNumber, already: false };
}