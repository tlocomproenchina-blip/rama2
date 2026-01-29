import { base44 } from '@/api/base44Client';

export async function generateInvoice(consolidation) {
  const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const invoiceDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7); // 7 días para pagar

  const items = [];
  
  // Item de envío
  items.push({
    description: `Envío ${consolidation.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo'} - ${consolidation.consolidation_tracking}`,
    quantity: 1,
    unit_price: consolidation.shipping_cost,
    total: consolidation.shipping_cost
  });

  // Item de seguro si aplica
  if (consolidation.insurance_cost > 0) {
    items.push({
      description: 'Seguro de Envío',
      quantity: 1,
      unit_price: consolidation.insurance_cost,
      total: consolidation.insurance_cost
    });
  }

  const subtotal = consolidation.shipping_cost + consolidation.insurance_cost;
  const tax = 0; // Puedes calcular impuestos aquí si es necesario
  const total = consolidation.total_cost;

  const invoice = await base44.entities.Invoice.create({
    invoice_number: invoiceNumber,
    client_email: consolidation.client_email,
    consolidation_id: consolidation.id,
    consolidation_tracking: consolidation.consolidation_tracking,
    invoice_date: invoiceDate.toISOString(),
    due_date: dueDate.toISOString(),
    items,
    subtotal,
    tax,
    total,
    status: 'pendiente'
  });

  return invoice;
}

export async function markInvoiceAsPaid(invoiceId, paymentData) {
  await base44.entities.Invoice.update(invoiceId, {
    status: 'pagada',
    payment_date: new Date().toISOString(),
    payment_method: paymentData.method,
    payment_reference: paymentData.reference,
    stripe_payment_intent_id: paymentData.stripe_payment_intent_id
  });
}