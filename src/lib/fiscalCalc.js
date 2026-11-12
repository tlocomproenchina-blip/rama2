// Cálculos del módulo de Facturas Fiscales. Aritmética en enteros (centavos y
// milésimas) para no arrastrar errores de coma flotante. El backend usa la misma
// lógica (base44/shared/fiscalCalc.ts) y recalcula todo: esto solo es la vista previa.
export const VAT_RATE_PERCENT = 16;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const parse = (v) => {
  const n = Number(String(v ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

export const toCents = (v) => {
  const n = parse(v);
  return Number.isNaN(n) ? NaN : Math.round((n + Number.EPSILON) * 100);
};

export const toMilli = (v) => {
  const n = parse(v);
  return Number.isNaN(n) ? NaN : Math.round((n + Number.EPSILON) * 1000);
};

export const money = (n) =>
  `$${Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const isBlankLine = (l) =>
  !String(l.quantity ?? '').trim() && !String(l.description ?? '').trim() && !String(l.unit_price ?? '').trim();

// errors solo contiene las claves que fallan.
export function computeLine(line) {
  const qm = toMilli(line.quantity);
  const pc = toCents(line.unit_price);
  const description = String(line.description ?? '').trim();
  const errors = {};
  if (Number.isNaN(qm) || qm <= 0) errors.quantity = true;
  if (!description) errors.description = true;
  if (Number.isNaN(pc) || pc <= 0) errors.unit_price = true;
  const priced = !errors.quantity && !errors.unit_price;
  return { errors, description, totalCents: priced ? Math.round((qm * pc) / 1000) : 0 };
}

export function computeTotals(lines) {
  const calc = lines.map(computeLine);
  const subtotalCents = calc.reduce((sum, c) => sum + c.totalCents, 0);
  const vatCents = Math.round((subtotalCents * VAT_RATE_PERCENT) / 100);
  return {
    calc,
    subtotal: subtotalCents / 100,
    vat_amount: vatCents / 100,
    total: (subtotalCents + vatCents) / 100,
  };
}

// J-12345678-9 (J, G, V, E, P o C). Devuelve el RIF normalizado o null.
export function normalizeRif(value) {
  const m = String(value || '').toUpperCase().replace(/[\s.]/g, '').match(/^([JGVEPC])-?(\d{8})-?(\d)$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function validateFile(file) {
  if (!file) return 'Selecciona un archivo';
  if (!ALLOWED_FILE_TYPES.includes(file.type)) return 'Solo se aceptan imágenes (JPG, PNG, WEBP) o PDF';
  if (file.size > MAX_FILE_BYTES) return 'El archivo supera el máximo de 8 MB';
  return '';
}