// Presentación de las líneas de almacenamiento en la factura.
//
// Las facturas cobradas antes del cambio guardaron una sola línea de
// almacenamiento con el promedio del día como precio unitario (por ejemplo
// "13 × $150.00"), que se confunde con la tarifa del montacargas. Aquí esa línea
// se muestra separada por tipo de bulto, con la tarifa diaria aprobada como
// precio unitario y los bulto-día como cantidad. Los montos no cambian: el total
// de la factura sigue siendo el mismo.

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// Almacenamiento y custodia en pausa: estas líneas siguen guardadas en la
// factura, pero no se muestran mientras se revisan los cálculos.
export function isStorageInvoiceLine(item) {
  const details = item?.details || {};
  if (details.kind === 'storage_charge') return true;
  return String(item?.description || '').trim().toLowerCase().startsWith('almacenamiento y custodia');
}

// Monto cobrado en la factura que corresponde a las líneas ocultas de
// almacenamiento y custodia. Sirve para mostrar el saldo de lo que sí se
// está facturando, sin alterar el total guardado de la factura.
export function hiddenStorageTotal(invoice) {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  return items
    .filter(isStorageInvoiceLine)
    .reduce((sum, item) => sum + (Number(item?.total) || 0), 0);
}

// Monto facturado que sí se cobra: el total de la factura sin las líneas de
// almacenamiento en pausa. Es el que debe mostrarse en la factura, en el PDF y
// en el saldo para que cuadre con los conceptos visibles.
export function billableTotal(invoice) {
  return Math.max(round2(num(invoice?.total) - hiddenStorageTotal(invoice)), 0);
}

const dayRange = (details) => {
  const from = num(details?.from_day);
  const to = num(details?.to_day);
  if (from && to) return `día ${from} al ${to}`;
  return '';
};

const categoryLine = ({ category, units, days, total, details }) => {
  const quantity = units > 0 && days > 0 ? units * days : Math.max(days, 1);
  const unit = quantity > 0 ? round2(total / quantity) : round2(total);
  const range = dayRange(details);
  return {
    description: `Almacenamiento y custodia · bultos ${category}${range ? ` (${range})` : ''}`,
    quantity,
    unit_price: unit,
    total: round2(total),
    details: {
      ...details,
      kind: 'storage_charge',
      category: category === 'grandes' ? 'grande' : 'estandar',
      units,
      rate: unit,
    },
  };
};

// Devuelve las líneas de la factura listas para mostrar: mismas cantidades de
// dinero, con el almacenamiento diario separado del recargo de montacargas.
export function displayInvoiceItems(invoice) {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  const rows = [];
  for (const item of items) {
    if (isStorageInvoiceLine(item)) continue;
    const details = item?.details || {};
    // Las líneas nuevas ya vienen separadas por tipo de bulto.
    if (details.kind !== 'storage_charge' || details.category) {
      rows.push(item);
      continue;
    }

    const total = num(item.total);
    const days = Math.max(num(details.days) || num(item.quantity), 0);
    const rateStandard = num(details.rate_standard);
    const rateLarge = num(details.rate_large);
    let unitsStandard = num(details.units_standard);
    let unitsLarge = num(details.units_large);
    if (!unitsStandard && !unitsLarge && rateStandard > 0) {
      unitsStandard = round2(num(details.daily_amount) / rateStandard);
    }
    if (!unitsStandard && !unitsLarge) {
      rows.push(item);
      continue;
    }

    const computedStandard = round2(unitsStandard * rateStandard * days);
    const computedLarge = round2(unitsLarge * rateLarge * days);
    const computed = round2(computedStandard + computedLarge);
    const factor = computed > 0 ? total / computed : 0;

    if (unitsStandard > 0) {
      rows.push(categoryLine({
        category: 'estándar',
        units: unitsStandard,
        days,
        total: computedStandard * factor,
        details,
      }));
    }
    if (unitsLarge > 0) {
      rows.push(categoryLine({
        category: 'grandes',
        units: unitsLarge,
        days,
        total: computedLarge * factor,
        details,
      }));
    }
  }
  return rows;
}