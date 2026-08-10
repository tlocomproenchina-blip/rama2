// Lógica compartida para el sistema de saldo a favor del cliente.
// Usado por addClientCredit y applyClientCreditToInvoice.

export async function getClientCreditBalance(base44, clientEmail) {
  const credits = await base44.asServiceRole.entities.ClientCredit.filter({ client_email: clientEmail });
  return credits.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
}

/**
 * Aplica el saldo a favor disponible a las facturas impagas (pendiente/revision)
 * del cliente, desde la más antigua a la más reciente.
 * - Crea movimientos negativos (tipo "uso") por cada aplicación.
 * - Actualiza paid_amount y status de cada factura.
 * - Si el abono cubre el total, marca la factura como pagada.
 * Retorna { balance, applied: [{ invoice_id, invoice_number, applied }] }
 */
export async function applyCreditsToUnpaidInvoices(base44, clientEmail) {
  const balance = await getClientCreditBalance(base44, clientEmail);
  if (!balance || balance <= 0.01) {
    return { balance: balance || 0, applied: [] };
  }

  // Traer facturas del cliente y filtrar las impagas en JS (más seguro que $in)
  const allInvoices = await base44.asServiceRole.entities.Invoice.filter(
    { client_email: clientEmail },
    'invoice_date'
  );
  const unpaid = allInvoices.filter(
    (inv) => inv.status === 'pendiente' || inv.status === 'revision'
  );

  const applications = [];
  let remaining = balance;

  for (const inv of unpaid) {
    if (remaining <= 0.01) break;
    const total = Number(inv.total || 0);
    const paid = Number(inv.paid_amount || 0);
    const debt = total - paid;
    if (debt <= 0.01) continue;

    const apply = Math.min(remaining, debt);
    const newPaid = +(paid + apply).toFixed(2);
    const isFullyPaid = newPaid >= total - 0.01;

    await base44.asServiceRole.entities.Invoice.update(inv.id, {
      paid_amount: newPaid,
      status: isFullyPaid ? 'pagada' : inv.status,
      payment_date: isFullyPaid ? new Date().toISOString() : inv.payment_date,
      payment_method: isFullyPaid
        ? (inv.payment_method || 'saldo_a_favor')
        : inv.payment_method
    });

    await base44.asServiceRole.entities.ClientCredit.create({
      client_email: clientEmail,
      amount: -apply,
      type: 'uso',
      description: `Saldo a favor aplicado a factura ${inv.invoice_number || inv.id}`,
      related_invoice_id: inv.id,
      related_invoice_number: inv.invoice_number,
      reference: 'aplicacion_automatica',
      created_by_email: 'system'
    });

    applications.push({
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      applied: apply,
      fully_paid: isFullyPaid
    });
    remaining = +(remaining - apply).toFixed(2);
  }

  return { balance: remaining, applied: applications };
}