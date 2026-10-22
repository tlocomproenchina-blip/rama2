// Protección de facturas.
//
// Una factura protegida (`locked = true`) no se puede editar: ni sus líneas, ni
// sus montos, ni su desglose de envío. Los procesos automáticos (recálculo de
// tarifas, cargos de almacenamiento, montacargas, fusión de recibos duplicados)
// la omiten y la pantalla de facturas esconde sus controles de edición.
//
// Cada factura guarda además `amount_restore`: el registro de la restauración
// (quién, cuándo, monto anterior y monto restaurado).

export const INVOICE_LOCK_REASON =
  "Factura protegida: no se permite editar su contenido ni sus montos.";

// Regla general: toda factura nace inmutable. Nada de lo que la define (líneas,
// montos, CBM, recibos, número, cliente y fechas) se puede cambiar después de
// crearla; la única corrección posible es eliminarla y crear una nueva.
export const INVOICE_IMMUTABLE_REASON =
  "Factura inmutable: no se puede editar. Para corregirla, elimínala y crea una nueva.";

export const INVOICE_IMMUTABLE_MESSAGE =
  "Las facturas no se pueden editar. Elimina esta factura y crea una nueva con los datos correctos.";

export const INVOICE_FROZEN_FIELDS = [
  "items",
  "subtotal",
  "tax",
  "total",
  "cost_breakdown",
  "total_cbm",
  "billed_cbm",
  "manual_recibos",
  "invoice_number",
  "client_email",
  "consolidation_id",
  "consolidation_tracking",
  "invoice_date",
  "due_date",
  "description",
];

// Campos congelados que intenta cambiar una actualización (vacío = permitida).
export function frozenChanges(updates: any) {
  if (!updates) return [];
  return INVOICE_FROZEN_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(updates, field));
}

// Corta cualquier intento de cambiar lo que define la factura emitida.
export function assertInvoiceImmutable(updates: any) {
  const fields = frozenChanges(updates);
  if (fields.length) {
    const error: any = new Error(INVOICE_IMMUTABLE_MESSAGE);
    error.code = "invoice_immutable";
    error.fields = fields;
    throw error;
  }
  return true;
}

export const INVOICE_LOCK_MESSAGE =
  "Esta factura está protegida y no se puede modificar.";

export const num = (value: any) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
export const round2 = (value: any) => Math.round(num(value) * 100) / 100;
const round4 = (value: any) => Math.round(num(value) * 10000) / 10000;

export function invoiceLocked(invoice: any) {
  return invoice?.locked === true;
}

export function lockedReason(invoice: any) {
  return String(invoice?.lock_reason || "").trim() || INVOICE_LOCK_REASON;
}

// Texto que deja el recálculo de tarifas en las notas: deja escrito el envío
// anterior y el nuevo. Es la fuente verificable de cuánto hay que restablecer.
const RESTORE_MARK =
  /Tarifas de envío revisadas el ([\d-]+):\s*\$(\d+(?:[.,]\d+)?)\s*→\s*\$(\d+(?:[.,]\d+)?)/i;

export function parseRestoreTarget(invoice: any) {
  const m = String(invoice?.notes || "").match(RESTORE_MARK);
  if (!m) return null;
  return {
    review_date: m[1],
    shipping_before: num(m[2].replace(/,/g, "")),
    shipping_after: num(m[3].replace(/,/g, "")),
  };
}

// Línea de envío con carga (la puerta a puerta no se toca).
const isShippingLine = (item: any) => {
  const desc = String(item?.description || "").trim();
  if (!/^env[ií]o\b/i.test(desc)) return false;
  if (/puerta\s*a\s*puerta/i.test(desc)) return false;
  return num(item?.quantity) > 0 || num(item?.total) > 0;
};

// Cómo queda la factura al restablecer su envío al monto documentado.
// No toca pagos, estado, costo del proveedor ni la ganancia.
export function planRestore(invoice: any, actorEmail = "") {
  const base = {
    invoice_id: invoice?.id || null,
    invoice_number: String(invoice?.invoice_number || ""),
    client_email: String(invoice?.client_email || ""),
    status: String(invoice?.status || ""),
  };

  if (invoiceLocked(invoice)) {
    return { ...base, skipped: "ya_protegida" };
  }

  const target = parseRestoreTarget(invoice);
  if (!target) {
    return { ...base, skipped: "sin_registro" };
  }

  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  const shipIndexes = items.map((it: any, i: number) => (isShippingLine(it) ? i : -1)).filter((i: number) => i >= 0);
  const currentShipping = round2(
    shipIndexes.reduce((sum: number, i: number) => sum + num(items[i]?.total), 0)
  );

  const before = { total: round2(invoice?.total), shipping: currentShipping };
  const targetShipping = round2(target.shipping_before);
  const documented = round2(target.shipping_after);

  if (!shipIndexes.length) {
    return { ...base, skipped: "sin_linea_envio", before };
  }
  // Solo se restablece si la factura sigue exactamente en el monto que dejó el
  // recálculo: si alguien más la tocó después, se revisa a mano.
  if (Math.abs(currentShipping - documented) > 0.02) {
    return {
      ...base,
      skipped: "monto_distinto",
      before,
      documented_shipping: documented,
      target_shipping: targetShipping,
    };
  }
  if (targetShipping <= currentShipping + 0.02) {
    return { ...base, skipped: "sin_reduccion", before };
  }

  const factor = targetShipping / currentShipping;
  const newItems = items.map((it: any, i: number) => {
    if (!shipIndexes.includes(i)) return it;
    const total = round2(num(it?.total) * factor);
    const quantity = num(it?.quantity);
    return {
      ...it,
      unit_price: quantity > 0 ? round4(total / quantity) : total,
      total,
    };
  });

  const rest = newItems.reduce((sum: number, it: any) => sum + num(it?.total), 0);
  const totalAfter = round2(rest);
  const breakdown = invoice?.cost_breakdown || {};
  const billedCbm = num(breakdown.billed_cbm) || num(invoice?.billed_cbm) || num(invoice?.total_cbm);

  return {
    ...base,
    skipped: null,
    before,
    after: { total: totalAfter, shipping: targetShipping },
    delta: round2(totalAfter - before.total),
    review_date: target.review_date,
    updates: {
      items: newItems,
      subtotal: totalAfter,
      total: totalAfter,
      cost_breakdown: {
        ...breakdown,
        shipping_total: targetShipping,
        rate_per_cbm: billedCbm > 0 ? round2(targetShipping / billedCbm) : breakdown.rate_per_cbm,
      },
      locked: true,
      lock_reason: INVOICE_LOCK_REASON,
      locked_by: actorEmail || "sistema",
      locked_date: new Date().toISOString(),
      amount_restore: {
        restored_date: new Date().toISOString(),
        restored_by: actorEmail || "sistema",
        before_total: before.total,
        restored_total: totalAfter,
        before_shipping: currentShipping,
        restored_shipping: targetShipping,
        source_note: `Envío revisado el ${target.review_date}: $${documented.toFixed(2)} → $${currentShipping.toFixed(2)}`,
      },
    },
  };
}