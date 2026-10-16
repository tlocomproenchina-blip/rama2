// Contexto completo de un cliente para el asistente de soporte (ATC).
// Reúne el perfil y todo el historial disponible con acceso de servicio,
// limitado siempre al cliente elegido por el agente.

const LIMITS = {
  packages: 15,
  recibos: 10,
  invoices: 8,
  consolidations: 6,
  tickets: 5,
  notes: 5,
  indications: 10,
  orders: 5,
  credits: 200,
};

export const PACKAGE_STATUS_LABELS: Record<string, string> = {
  pre_alerta: 'Pre-alerta',
  recibido: 'Recibido en almacén China',
  rechazado: 'Rechazado',
  consolidado: 'Consolidado',
  en_transito: 'En tránsito',
  disponible: 'Disponible en almacén Venezuela',
  despachado: 'Despachado',
  entregado: 'Entregado',
  sin_cliente: 'Sin cliente asignado',
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  revision: 'En revisión',
  pagada: 'Pagada',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
};

function day(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function short(text: any, max = 220) {
  if (!text) return null;
  const value = String(text).replace(/\s+/g, ' ').trim();
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function settled(result: any): any[] {
  return result?.status === 'fulfilled' && Array.isArray(result.value) ? result.value : [];
}

function buildSummary(context: any) {
  const pendientes = (context.facturas || []).filter((i: any) => i.saldo > 0);
  return {
    paquetes_registrados: context.paquetes?.length || 0,
    paquetes_en_transito: (context.paquetes || []).filter((p: any) => ['recibido', 'consolidado', 'en_transito'].includes(p.estado_codigo)).length,
    recibos_cbm_total: Number(((context.recibos || []).reduce((sum: number, r: any) => sum + (Number(r.cbm) || 0), 0)).toFixed(3)),
    facturas_pendientes: pendientes.length,
    saldo_pendiente_usd: Number(pendientes.reduce((sum: number, i: any) => sum + (Number(i.saldo) || 0), 0).toFixed(2)),
    tickets_abiertos: (context.tickets || []).filter((t: any) => ['abierto', 'en_proceso'].includes(t.estado_codigo)).length,
  };
}

export async function buildSupportClientContext(base44: any, clientEmail: string) {
  const email = String(clientEmail || '').trim();
  if (!email) return null;

  const [usersRes, packagesRes, recibosRes, invoicesRes, consolidationsRes, ticketsRes, notesRes, indicationsRes, creditsRes, ordersRes] = await Promise.allSettled([
    base44.asServiceRole.entities.User.filter({ email }, '-created_date', 1),
    base44.asServiceRole.entities.Package.filter({ client_email: email }, '-created_date', LIMITS.packages),
    base44.asServiceRole.entities.CbmIngreso.filter({ client_email: email }, '-fecha', LIMITS.recibos),
    base44.asServiceRole.entities.Invoice.filter({ client_email: email }, '-created_date', LIMITS.invoices),
    base44.asServiceRole.entities.Consolidation.filter({ client_email: email }, '-created_date', LIMITS.consolidations),
    base44.asServiceRole.entities.SupportTicket.filter({ client_email: email }, '-created_date', LIMITS.tickets),
    base44.asServiceRole.entities.ClientNote.filter({ client_email: email }, '-created_date', LIMITS.notes),
    base44.asServiceRole.entities.SupportClientNote.filter(
      { client_email: email, note_type: 'indicacion' },
      '-created_date',
      LIMITS.indications,
    ),
    base44.asServiceRole.entities.ClientCredit.filter({ client_email: email }, '-created_date', LIMITS.credits),
    base44.asServiceRole.entities.DispatchOrder.filter({ client_email: email }, '-created_date', LIMITS.orders),
  ]);

  const user = settled(usersRes)[0] || null;
  const packages = settled(packagesRes);
  const recibos = settled(recibosRes);
  const invoices = settled(invoicesRes);
  const consolidations = settled(consolidationsRes);
  const tickets = settled(ticketsRes);
  const notes = settled(notesRes);
  const indications = settled(indicationsRes);
  const credits = settled(creditsRes);
  const orders = settled(ordersRes);

  if (!user && !packages.length && !invoices.length) return null;

  const creditBalance = Number(credits.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0).toFixed(2));

  const context: any = {
    cliente: {
      nombre: user?.full_name || user?.first_name || email,
      email,
      cedula: user?.cedula || null,
      whatsapp: user?.whatsapp || null,
      telefono: user?.phone || null,
      shipping_mark: user?.shipping_mark || packages[0]?.shipping_mark || null,
      ciudad: user?.city || null,
      estado: user?.state || null,
      direccion: user?.address || null,
      activo: user ? user.is_active !== false : null,
      perfil_completo: !!user?.profile_completed,
      cliente_desde: day(user?.created_date),
    },
    credito_disponible_usd: creditBalance,
    paquetes: packages.map((p: any) => ({
      tracking: p.tracking_number,
      etiqueta: p.label_code || null,
      estado_codigo: p.status,
      estado: PACKAGE_STATUS_LABELS[p.status] || p.status,
      envio: p.shipping_type === 'maritimo' ? 'marítimo' : p.shipping_type === 'aereo' ? 'aéreo' : p.shipping_type || null,
      tipo_carga: p.risk_category === 'alto_riesgo' ? 'alto riesgo' : 'general',
      recibido_en_almacen: day(p.received_date),
      reconocido_venezuela: day(p.ve_recognized_date),
      despachado: day(p.dispatched_date),
      seguro: !!p.has_insurance,
      descripcion: short(p.description, 120),
    })),
    recibos: recibos.map((r: any) => ({
      orden: r.invoice_number || null,
      cbm: Number(r.cbm) || 0,
      fecha: day(r.fecha),
      trackings: (r.tracking_numbers || []).length,
      paquetes: r.package_count ?? null,
      salida: day(r.fecha_salida),
      llegada_estimada: day(r.fecha_estimada_llegada),
      disponible_para_entrega: !!r.disponible_entrega,
      facturado: !!r.billed || !!r.billing_marked,
    })),
    facturas: invoices.map((i: any) => ({
      numero: i.invoice_number,
      total: Number(i.total) || 0,
      abonado: Number(i.paid_amount) || 0,
      saldo: Number(((Number(i.total) || 0) - (Number(i.paid_amount) || 0)).toFixed(2)),
      estado_codigo: i.status,
      estado: INVOICE_STATUS_LABELS[i.status] || i.status,
      fecha: day(i.invoice_date || i.created_date),
      vence: day(i.due_date),
      despachada: !!i.dispatched,
    })),
    consolidaciones: consolidations.map((c: any) => ({
      tracking: c.consolidation_tracking,
      estado: c.status,
      cbm: Number(c.cbm) || 0,
      costo_total: Number(c.total_cost) || 0,
      pago_validado: !!c.payment_validated,
      envio: day(c.shipping_date),
      entrega_estimada: day(c.estimated_delivery),
    })),
    tickets: tickets.map((t: any) => ({
      numero: t.ticket_number,
      asunto: t.subject,
      estado_codigo: t.status,
      estado: t.status,
      prioridad: t.priority,
      categoria: t.category,
      fecha: day(t.created_date),
      ultimo_mensaje: short((Array.isArray(t.messages) && t.messages.length ? t.messages[t.messages.length - 1]?.message : null), 180),
    })),
    notas_internas: notes.map((n: any) => ({
      nota: short(n.note, 200),
      tipo: n.note_type || null,
      autor: n.created_by || null,
      fecha: day(n.created_date),
    })),
    // Indicaciones que dejó Supervisión para la atención de este cliente: son
    // parte de su historial y el ATC las consulta aquí, con su autor y su fecha.
    indicaciones: indications.map((n: any) => ({
      id: n.id || null,
      nota: short(n.note, 400),
      caso: n.ticket_number || null,
      para: n.addressed_to || null,
      autor: n.author_name || n.author_email || null,
      fecha: day(n.created_date),
    })),
    ordenes_despacho: orders.map((o: any) => ({
      numero: o.order_number,
      estado: o.status,
      despachada: day(o.dispatched_date),
      bultos: Array.isArray(o.items) ? o.items.length : 0,
    })),
  };

  context.resumen = buildSummary(context);
  return context;
}