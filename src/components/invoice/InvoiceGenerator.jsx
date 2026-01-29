import { base44 } from '@/api/base44Client';

export async function generateInvoice(consolidation) {
  const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const invoiceDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  // Obtener datos del cliente
  const clients = await base44.entities.User.filter({ email: consolidation.client_email });
  const client = clients[0] || {};

  // Obtener paquetes incluidos
  const packages = await base44.entities.Package.filter({ 
    consolidation_id: consolidation.id 
  });

  const items = [];
  
  // Item principal de envío con detalles completos
  const dimensionsInfo = consolidation.length_cm > 0 
    ? `${consolidation.length_cm}x${consolidation.width_cm}x${consolidation.height_cm} cm`
    : `${consolidation.cbm.toFixed(4)} m³`;

  items.push({
    description: `Envío ${consolidation.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo'}`,
    quantity: 1,
    unit_price: consolidation.shipping_cost,
    total: consolidation.shipping_cost,
    details: {
      tracking: consolidation.consolidation_tracking,
      dimensions: dimensionsInfo,
      weight: `${consolidation.real_weight_kg} kg`,
      billable_weight: `${consolidation.billable_weight.toFixed(2)} kg`,
      package_count: packages.length,
      tracking_numbers: consolidation.tracking_numbers || []
    }
  });

  // Item de seguro con detalles
  if (consolidation.insurance_cost > 0) {
    const insuredPackages = packages.filter(p => p.has_insurance);
    const totalFOB = insuredPackages.reduce((sum, p) => sum + (p.fob_value || 0), 0);
    
    items.push({
      description: 'Seguro de Carga',
      quantity: 1,
      unit_price: consolidation.insurance_cost,
      total: consolidation.insurance_cost,
      details: {
        fob_value: totalFOB,
        insured_packages: insuredPackages.length
      }
    });
  }

  const subtotal = consolidation.shipping_cost + consolidation.insurance_cost;
  const tax = 0;
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
    status: 'pendiente',
    notes: `Cliente: ${client.first_name || ''} ${client.last_name || ''}\nCiudad: ${client.city || 'N/A'}\nShipping Mark: ${consolidation.shipping_mark || 'N/A'}\nPaquetes: ${packages.length}\nTrackings: ${(consolidation.tracking_numbers || []).join(', ')}`
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