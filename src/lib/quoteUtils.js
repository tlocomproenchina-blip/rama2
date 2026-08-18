// Utilidades compartidas para el módulo de presupuestos

export function generateQuoteToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function formatCurrency(amount, currency) {
  const value = Number(amount) || 0;
  if (currency === 'CNY') return `¥${value.toFixed(2)}`;
  return `$${value.toFixed(2)}`;
}

// Calcula totales de un item basado en precio unitario, cantidad, moneda y % de servicio
export function calcItemTotals(item, servicePercentage, conversionRate) {
  const qty = Number(item.quantity) || 0;
  const unitPrice = Number(item.unit_price) || 0;
  const currency = item.currency || 'CNY';
  const svcPct = Number(servicePercentage) || 0;
  const rate = Number(conversionRate) || 0.15;

  const subtotal = qty * unitPrice;
  const serviceAmount = subtotal * (svcPct / 100);
  const total = subtotal + serviceAmount;

  // Convertir a USD: si está en CNY, multiplicar por rate; si está en USD, ya está
  const totalUsd = currency === 'CNY' ? total * rate : total;

  return {
    subtotal: round2(subtotal),
    service_amount: round2(serviceAmount),
    total: round2(total),
    total_usd: round2(totalUsd)
  };
}

// Calcula los totales generales del presupuesto
export function calcQuoteTotals(items, servicePercentage, conversionRate) {
  const svcPct = Number(servicePercentage) || 0;
  const rate = Number(conversionRate) || 0.15;

  let subtotalCny = 0;
  let serviceTotalCny = 0;
  let totalCny = 0;
  let totalUsd = 0;

  (items || []).forEach((item) => {
    const qty = Number(item.quantity) || 0;
    const unitPrice = Number(item.unit_price) || 0;
    const currency = item.currency || 'CNY';
    const subtotal = qty * unitPrice;
    const serviceAmount = subtotal * (svcPct / 100);
    const total = subtotal + serviceAmount;
    const itemUsd = currency === 'CNY' ? total * rate : total;

    // Para el resumen en yuanes, convertimos todo a CNY
    if (currency === 'CNY') {
      subtotalCny += subtotal;
      serviceTotalCny += serviceAmount;
      totalCny += total;
    } else {
      // Si está en USD, convertir a CNY para el resumen
      subtotalCny += subtotal / rate;
      serviceTotalCny += serviceAmount / rate;
      totalCny += total / rate;
    }
    totalUsd += itemUsd;
  });

  return {
    subtotal_cny: round2(subtotalCny),
    service_total_cny: round2(serviceTotalCny),
    total_cny: round2(totalCny),
    total_usd: round2(totalUsd)
  };
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// Construye el mensaje de WhatsApp con el resumen del presupuesto
export function buildWhatsAppMessage(quote, publicUrl) {
  const clientName = `${quote.client_first_name || ''} ${quote.client_last_name || ''}`.trim() || 'Cliente';
  const lines = [];

  lines.push(`*Presupuesto ${quote.quote_number || ''}*`);
  lines.push(`Cliente: ${clientName}`);
  if (quote.client_city) lines.push(`Ciudad de despacho: ${quote.client_city}`);
  lines.push('');
  lines.push('*Productos:*');

  (quote.items || []).forEach((item, idx) => {
    const currency = item.currency === 'USD' ? '$' : '¥';
    lines.push(`${idx + 1}. ${item.link || 'Sin enlace'}`);
    lines.push(`   Cant: ${item.quantity} | Talla: ${item.size || 'N/A'}`);
    lines.push(`   Precio unit: ${currency}${(Number(item.unit_price) || 0).toFixed(2)}`);
    lines.push(`   Total: ${currency}${(Number(item.total) || 0).toFixed(2)} ($${(Number(item.total_usd) || 0).toFixed(2)})`);
  });

  lines.push('');
  lines.push(`*Resumen en Yuanes (¥):*`);
  lines.push(`Subtotal: ¥${(Number(quote.subtotal_cny) || 0).toFixed(2)}`);
  lines.push(`Servicio ${quote.service_percentage || 0}%: ¥${(Number(quote.service_total_cny) || 0).toFixed(2)}`);
  lines.push(`Total: ¥${(Number(quote.total_cny) || 0).toFixed(2)}`);
  lines.push('');
  lines.push(`*Resumen en Dólares ($):*`);
  lines.push(`Tasa: 1¥ = $${(Number(quote.conversion_rate) || 0.15).toFixed(2)}`);
  lines.push(`*TOTAL USD: $${(Number(quote.total_usd) || 0).toFixed(2)}*`);
  lines.push('');
  lines.push(`Ver presupuesto completo y contrato:`);
  lines.push(publicUrl);

  return lines.join('\n');
}

// Construye el enlace de WhatsApp (wa.me)
export function buildWhatsAppLink(phone, message) {
  let cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) cleanPhone = '58' + cleanPhone.slice(1);
  if (!cleanPhone.startsWith('58') && cleanPhone.length === 10) cleanPhone = '58' + cleanPhone;
  const encodedMsg = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
}