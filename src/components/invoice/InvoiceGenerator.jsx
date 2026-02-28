import { base44 } from '@/api/base44Client';

export async function generateInvoice(consolidation) {
  const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const invoiceDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  // Obtener paquetes incluidos primero (más rápido)
  const packages = consolidation.package_ids 
    ? await Promise.all(consolidation.package_ids.map(id => 
        base44.entities.Package.filter({ id }).then(p => p[0])
      ))
    : await base44.entities.Package.filter({ consolidation_id: consolidation.id });

  const items = [];
  
  // Item principal de envío con detalles completos
  const dimensionsInfo = consolidation.length_cm > 0 
    ? `${consolidation.length_cm}x${consolidation.width_cm}x${consolidation.height_cm} cm`
    : `${consolidation.cbm.toFixed(4)} m³`;

  items.push({
    description: `International Logistics Service – DDP Door to Door (${consolidation.shipping_type === 'aereo' ? 'Air Freight' : 'Sea Freight'})`,
    quantity: 1,
    unit_price: consolidation.shipping_cost,
    total: consolidation.shipping_cost,
    details: {
      tracking: consolidation.consolidation_tracking,
      origin: 'China',
      destination: 'Venezuela',
      dimensions: dimensionsInfo,
      weight: `${consolidation.real_weight_kg} kg`,
      billable_weight: `${consolidation.billable_weight.toFixed(2)} kg`,
      package_count: packages.length,
      tracking_numbers: consolidation.tracking_numbers || [],
      ddp: 'Includes customs clearance, taxes and final delivery'
    }
  });

  // Item de consolidación de carga
  const consolidationFee = packages.length * 1;
  items.push({
    description: `Consolidación de carga ($1 por paquete)`,
    quantity: packages.length,
    unit_price: 1,
    total: consolidationFee,
    details: {
      package_count: packages.length
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

  const subtotal = consolidation.shipping_cost + consolidationFee + consolidation.insurance_cost;
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
    notes: `Shipping Mark: ${consolidation.shipping_mark || 'N/A'}\nPaquetes: ${packages.length}\nTrackings: ${(consolidation.tracking_numbers || []).join(', ')}`
  });

  console.log('✓ Factura generada:', invoice.invoice_number);
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