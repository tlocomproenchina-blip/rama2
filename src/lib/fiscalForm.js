import { computeLine, isBlankLine, normalizeRif, toCents } from '@/lib/fiscalCalc';

const uid = () => Math.random().toString(36).slice(2, 10);

export const blankLine = () => ({ _k: uid(), quantity: '', description: '', unit_price: '' });

export function formFromRequest(r) {
  const vp = r.vat_payment || {};
  const rejected = r.status === 'comprobante_rechazado';
  const lines = (r.lines || []).map((l) => ({
    _k: uid(),
    quantity: String(l.quantity ?? ''),
    description: l.description || '',
    unit_price: String(l.unit_price ?? ''),
  }));
  return {
    legal_name: r.legal_name || '',
    rif: r.rif || '',
    fiscal_address: r.fiscal_address || '',
    rif_document_uri: r.rif_document_uri || '',
    rif_document_type: r.rif_document_type || '',
    lines: lines.length ? lines : [blankLine()],
    vat: {
      method_id: vp.method_id || '',
      amount_paid: vp.amount_paid ?? '',
      reference: vp.reference || '',
      payment_date: vp.payment_date || '',
      proof_uri: rejected ? '' : vp.proof_uri || '',
      proof_type: rejected ? '' : vp.proof_type || '',
    },
  };
}

// Lo que se envía al backend: solo líneas con datos; el servidor recalcula importes.
export function buildPayload(form) {
  return {
    legal_name: form.legal_name.trim(),
    rif: form.rif.trim(),
    fiscal_address: form.fiscal_address.trim(),
    rif_document_uri: form.rif_document_uri,
    rif_document_type: form.rif_document_type,
    lines: form.lines
      .filter((l) => !isBlankLine(l))
      .map((l) => ({ quantity: String(l.quantity).trim(), description: l.description.trim(), unit_price: String(l.unit_price).trim() })),
    vat: { ...form.vat },
  };
}

export function validateTaxData(form) {
  const e = {};
  if (!form.legal_name.trim()) e.legal_name = 'Indica el nombre o razón social';
  if (!form.rif.trim()) e.rif = 'Indica el RIF';
  else if (!normalizeRif(form.rif)) e.rif = 'Formato de RIF no válido. Ejemplo: J-12345678-9';
  if (!form.fiscal_address.trim()) e.fiscal_address = 'Indica la dirección fiscal';
  if (!form.rif_document_uri) e.rif_document = 'Carga la imagen o PDF de tu RIF';
  return e;
}

export function validateLines(form) {
  const real = form.lines.filter((l) => !isBlankLine(l));
  if (!real.length) return { lines: 'Agrega al menos una línea con datos' };
  if (real.some((l) => Object.keys(computeLine(l).errors).length)) {
    return { lines: 'Revisa las líneas: la cantidad y el precio deben ser mayores que cero y la descripción es obligatoria' };
  }
  return {};
}

export function validatePayment(form, vatAmount) {
  const e = {};
  const v = form.vat;
  if (!v.method_id) e.method_id = 'Selecciona el método con el que pagaste el IVA';
  if (String(v.reference || '').trim().length < 3) e.reference = 'Indica la referencia de la operación';
  if (!v.payment_date) e.payment_date = 'Indica la fecha del pago';
  else if (new Date(`${v.payment_date}T00:00:00`) > new Date()) e.payment_date = 'La fecha del pago no puede ser futura';
  const paid = toCents(v.amount_paid);
  if (Number.isNaN(paid) || paid <= 0) e.amount_paid = 'Indica el monto pagado';
  else if (paid < Math.round(vatAmount * 100)) e.amount_paid = 'El monto pagado debe cubrir el IVA de la solicitud';
  if (!v.proof_uri) e.proof = 'Debes cargar el comprobante de pago del IVA';
  return e;
}

export function firstStepWithErrors(e) {
  if (e.legal_name || e.rif || e.fiscal_address || e.rif_document) return 1;
  if (e.lines) return 2;
  return 3;
}