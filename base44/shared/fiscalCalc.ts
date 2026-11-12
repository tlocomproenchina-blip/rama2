// Cálculos del módulo de Facturas Fiscales (fuente de verdad). Mismo algoritmo que
// src/lib/fiscalCalc.js: enteros (centavos y milésimas) para evitar errores de coma flotante.
export const VAT_RATE_PERCENT = 16;

const parse = (v: any) => {
  const n = Number(String(v ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

export const toCents = (v: any) => {
  const n = parse(v);
  return Number.isNaN(n) ? NaN : Math.round((n + Number.EPSILON) * 100);
};

export const toMilli = (v: any) => {
  const n = parse(v);
  return Number.isNaN(n) ? NaN : Math.round((n + Number.EPSILON) * 1000);
};

export function normalizeRif(value: any) {
  const m = String(value || '').toUpperCase().replace(/[\s.]/g, '').match(/^([JGVEPC])-?(\d{8})-?(\d)$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// Recalcula todo a partir de las líneas recibidas. Devuelve error si alguna línea es inválida.
export function computeFiscal(rawLines: any[]) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) return { error: 'Agrega al menos una línea' };
  if (rawLines.length > 100) return { error: 'Máximo 100 líneas por solicitud' };
  const lines: any[] = [];
  let subtotalCents = 0;
  for (let i = 0; i < rawLines.length; i += 1) {
    const l = rawLines[i] || {};
    const qm = toMilli(l.quantity);
    const pc = toCents(l.unit_price);
    const description = String(l.description ?? '').trim().slice(0, 200);
    if (Number.isNaN(qm) || qm <= 0) return { error: `Línea ${i + 1}: la cantidad debe ser mayor que cero` };
    if (Number.isNaN(pc) || pc <= 0) return { error: `Línea ${i + 1}: el precio unitario debe ser mayor que cero` };
    if (!description) return { error: `Línea ${i + 1}: la descripción es obligatoria` };
    const totalCents = Math.round((qm * pc) / 1000);
    subtotalCents += totalCents;
    lines.push({ quantity: qm / 1000, description, unit_price: pc / 100, total: totalCents / 100 });
  }
  const vatCents = Math.round((subtotalCents * VAT_RATE_PERCENT) / 100);
  return {
    lines,
    subtotal: subtotalCents / 100,
    vat_rate: VAT_RATE_PERCENT,
    vat_amount: vatCents / 100,
    total: (subtotalCents + vatCents) / 100,
  };
}

export const sameMoney = (a: any, b: any) => Math.round(Number(a || 0) * 100) === Math.round(Number(b || 0) * 100);