import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { computeFiscal, normalizeRif, sameMoney, toCents } from '../../shared/fiscalCalc.ts';
import { canManageFiscal } from '../../shared/fiscalAccess.ts';

const EDITABLE = ['borrador', 'comprobante_rechazado', 'requiere_correccion'];
const FINAL = ['emitida', 'rechazada'];
const CORRECTABLE = ['pago_iva_en_verificacion', 'pendiente_revision_fiscal', 'aprobada', 'comprobante_rechazado'];
const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;

class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const lower = (v: any) => String(v || '').trim().toLowerCase();
const isUri = (v: any) => typeof v === 'string' && v.length > 0 && v.length <= 600 && !/\s/.test(v);
const fileType = (v: any) => (v === 'pdf' ? 'pdf' : 'image');
const money = (n: any) => `$${Number(n || 0).toFixed(2)}`;

async function audit(sr: any, r: any, actor: any, actorType: string, action: string, fromStatus: string, toStatus: string, notes = '', changes: any = undefined) {
  await sr.entities.FiscalInvoiceAudit.create({
    request_id: r.id,
    request_number: r.request_number,
    action,
    actor_email: actor?.email || 'sistema',
    actor_name: actor?.full_name || actor?.email || 'Sistema',
    actor_type: actorType,
    from_status: fromStatus,
    to_status: toStatus,
    notes: String(notes || '').slice(0, 500),
    ...(changes ? { changes } : {}),
  });
}

async function notifyClient(sr: any, r: any, title: string, message: string) {
  await sr.entities.Notification.create({
    user_email: r.client_email, title, message, type: 'payment', icon: 'dollar', priority: 'high',
    reference_id: r.id, entity_type: 'System', read: false,
  });
}

async function notifyAdmins(sr: any, r: any, title: string, message: string) {
  const admins = await sr.entities.User.filter({ role: 'admin' });
  const emails = (admins || []).map((a: any) => a.email).filter(Boolean);
  if (!emails.length) return;
  await sr.entities.Notification.bulkCreate(emails.map((email: string) => ({
    user_email: email, title, message, type: 'payment_validation', icon: 'dollar', priority: 'high',
    reference_id: r.id, entity_type: 'System', read: false,
  })));
}

async function nextRequestNumber(sr: any) {
  const rows = await sr.entities.FiscalSettings.filter({ config_key: 'main' }, '-updated_date', 1);
  const settings = rows[0] || (await sr.entities.FiscalSettings.create({ config_key: 'main', last_request_seq: 0 }));
  let seq = Number(settings.last_request_seq || 0) + 1;
  for (let i = 0; i < 10; i += 1) {
    const number = `FF-${String(seq).padStart(6, '0')}`;
    const dup = await sr.entities.FiscalInvoiceRequest.filter({ request_number: number }, '-created_date', 1);
    if (!dup.length) {
      await sr.entities.FiscalSettings.update(settings.id, { last_request_seq: seq });
      return number;
    }
    seq += 1;
  }
  throw new HttpError('No se pudo asignar el número de solicitud', 500);
}

async function loadRequest(sr: any, id: any) {
  if (!id) throw new HttpError('Falta el id de la solicitud');
  const rows = await sr.entities.FiscalInvoiceRequest.filter({ id: String(id) });
  if (!rows[0]) throw new HttpError('Solicitud no encontrada', 404);
  return rows[0];
}

function assertOwner(r: any, user: any) {
  if (lower(r.client_email) !== lower(user.email) || (r.client_user_id && r.client_user_id !== user.id)) {
    throw new HttpError('No tienes acceso a esta solicitud', 403);
  }
}

// Datos fiscales: estrictos para enviar, tolerantes para borradores.
function parseTax(body: any, strict: boolean) {
  const legal_name = String(body.legal_name || '').trim().slice(0, 160);
  const rifNorm = normalizeRif(body.rif);
  const fiscal_address = String(body.fiscal_address || '').trim().slice(0, 400);
  const rif_document_uri = String(body.rif_document_uri || '').trim();
  if (strict) {
    if (!legal_name) throw new HttpError('Indica el nombre o razón social');
    if (!rifNorm) throw new HttpError('El RIF no tiene un formato válido. Ejemplo: J-12345678-9');
    if (!fiscal_address) throw new HttpError('Indica la dirección fiscal');
    if (!isUri(rif_document_uri)) throw new HttpError('Carga el documento RIF');
  }
  return {
    legal_name,
    rif: rifNorm || String(body.rif || '').trim().toUpperCase().slice(0, 14),
    fiscal_address,
    rif_document_uri: isUri(rif_document_uri) ? rif_document_uri : '',
    rif_document_type: fileType(body.rif_document_type),
  };
}

function parseLines(body: any, strict: boolean) {
  const raw = Array.isArray(body.lines) ? body.lines : [];
  if (strict) {
    const res: any = computeFiscal(raw);
    if (res.error) throw new HttpError(res.error);
    return res;
  }
  const valid = raw.filter((l: any) => !(computeFiscal([l]) as any).error);
  if (!valid.length) return { lines: [], subtotal: 0, vat_rate: 16, vat_amount: 0, total: 0 };
  return computeFiscal(valid);
}

async function activeMethod(sr: any, id: any) {
  if (!id) return null;
  const rows = await sr.entities.FiscalVatPaymentMethod.filter({ id: String(id) });
  const m = rows[0];
  return m && m.active && !m.archived ? m : null;
}

const snapshot = (m: any) => ({
  name: m.name, payment_type: m.payment_type, bank_platform: m.bank_platform || '', holder: m.holder || '',
  holder_id: m.holder_id || '', account_identifier: m.account_identifier || '',
});

async function invoiceFor(sr: any, user: any, body: any) {
  let invoice: any = null;
  if (body.invoice_id) invoice = (await sr.entities.Invoice.filter({ id: String(body.invoice_id) }))[0];
  if (!invoice && body.consolidation_id) invoice = (await sr.entities.Invoice.filter({ consolidation_id: String(body.consolidation_id) }))[0];
  if (!invoice) throw new HttpError('Factura no encontrada', 404);
  if (lower(invoice.client_email) !== lower(user.email)) throw new HttpError('Esta factura no te pertenece', 403);
  return invoice;
}

// ---------- Acciones del cliente ----------

async function registerIntent(sr: any, user: any, body: any) {
  const invoice = await invoiceFor(sr, user, body);
  const existing = (await sr.entities.FiscalInvoiceRequest.filter({ invoice_id: invoice.id }, 'created_date', 20)).filter((r: any) => r.status !== 'rechazada');
  if (existing[0]) return { request: existing[0], existing: true };

  const proof = typeof invoice.payment_reference === 'string' && /^https?:\/\//i.test(invoice.payment_reference) ? invoice.payment_reference : '';
  const created = await sr.entities.FiscalInvoiceRequest.create({
    request_number: await nextRequestNumber(sr),
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number || '',
    client_user_id: user.id,
    client_email: user.email,
    client_name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.full_name || user.email,
    shipping_mark: user.shipping_mark || '',
    status: 'borrador',
    lines: [], subtotal: 0, vat_rate: 16, vat_amount: 0, total: 0,
    vat_payment: { verification_status: 'sin_comprobante' },
    original_payment_proof: proof,
  });

  // Carrera: si se crearon dos a la vez, queda la más antigua.
  const all = (await sr.entities.FiscalInvoiceRequest.filter({ invoice_id: invoice.id }, 'created_date', 20)).filter((r: any) => r.status !== 'rechazada');
  if (all.length > 1 && all[0].id !== created.id) {
    await sr.entities.FiscalInvoiceRequest.delete(created.id);
    return { request: all[0], existing: true };
  }
  await audit(sr, created, user, 'cliente', 'intent', '', 'borrador', 'Solicitud iniciada al pagar la factura');
  return { request: created };
}

async function saveDraft(sr: any, user: any, body: any) {
  const r = await loadRequest(sr, body.id);
  assertOwner(r, user);
  if (!EDITABLE.includes(r.status)) throw new HttpError('Esta solicitud ya no se puede modificar', 409);
  const tax = parseTax(body, false);
  const calc = parseLines(body, false);
  const v = body.vat || {};
  const method = await activeMethod(sr, v.method_id);
  const old = r.vat_payment || {};
  const vat_payment = {
    ...old,
    method_id: method ? method.id : '',
    method_name: method ? method.name : '',
    ...(method ? { method_snapshot: snapshot(method) } : {}),
    amount_paid: Number.isNaN(toCents(v.amount_paid)) ? undefined : toCents(v.amount_paid) / 100,
    reference: String(v.reference || '').trim().slice(0, 60),
    payment_date: DATE_RX.test(String(v.payment_date || '')) ? v.payment_date : '',
    proof_uri: isUri(v.proof_uri) ? v.proof_uri : '',
    proof_type: fileType(v.proof_type),
  };
  const updated = await sr.entities.FiscalInvoiceRequest.update(r.id, {
    ...tax, lines: calc.lines, subtotal: calc.subtotal, vat_rate: calc.vat_rate, vat_amount: calc.vat_amount, total: calc.total, vat_payment,
  });
  await audit(sr, r, user, 'cliente', 'save_draft', r.status, r.status, 'Borrador guardado');
  return { request: updated };
}

async function submit(sr: any, user: any, body: any) {
  const r = await loadRequest(sr, body.id);
  assertOwner(r, user);
  if (!EDITABLE.includes(r.status)) throw new HttpError('Esta solicitud ya fue enviada', 409);

  const invoice = (await sr.entities.Invoice.filter({ id: r.invoice_id }))[0];
  const paidProof = invoice && (['revision', 'pagada'].includes(invoice.status) || invoice.payment_reference);
  if (!paidProof) throw new HttpError('Primero debes cargar el comprobante de pago de tu factura original', 409);

  const tax = parseTax(body, true);
  const calc = parseLines(body, true);
  const old = r.vat_payment || {};
  const verifiedOk = old.verification_status === 'verificado' && sameMoney(old.verified_amount, calc.vat_amount);

  let vat_payment = old;
  let newStatus = 'pendiente_revision_fiscal';
  if (!verifiedOk) {
    const v = body.vat || {};
    const method = await activeMethod(sr, v.method_id);
    if (!method) throw new HttpError('Selecciona un método de pago del IVA disponible');
    const reference = String(v.reference || '').trim().slice(0, 60);
    if (reference.length < 3) throw new HttpError('Indica la referencia de la operación');
    if (!DATE_RX.test(String(v.payment_date || ''))) throw new HttpError('Indica la fecha del pago');
    if (new Date(`${v.payment_date}T00:00:00Z`).getTime() > Date.now() + 86400000) throw new HttpError('La fecha del pago no puede ser futura');
    const paidCents = toCents(v.amount_paid);
    if (Number.isNaN(paidCents) || paidCents <= 0) throw new HttpError('Indica el monto pagado');
    if (paidCents < Math.round(calc.vat_amount * 100)) throw new HttpError('El monto pagado debe cubrir el IVA de la solicitud');
    if (!isUri(v.proof_uri)) throw new HttpError('Debes cargar el comprobante de pago del IVA antes de enviar');

    const dupes = await sr.entities.FiscalVatProof.filter({ reference, method_id: method.id }, '-created_date', 20);
    if (dupes.some((p: any) => p.request_id !== r.id && ['en_verificacion', 'verificado'].includes(p.status))) {
      throw new HttpError('Esa referencia de pago ya fue registrada en otra solicitud');
    }

    const proofs = await sr.entities.FiscalVatProof.filter({ request_id: r.id }, '-created_date', 50);
    const pending = proofs.find((p: any) => p.status === 'en_verificacion');
    const proofData = {
      request_id: r.id, request_number: r.request_number, client_email: r.client_email, file_uri: v.proof_uri, file_type: fileType(v.proof_type),
      method_id: method.id, method_name: method.name, amount: paidCents / 100, reference, payment_date: v.payment_date,
    };
    let proofId = pending?.id;
    if (pending && pending.file_uri === v.proof_uri) {
      await sr.entities.FiscalVatProof.update(pending.id, proofData);
    } else {
      for (const p of proofs.filter((x: any) => x.status === 'en_verificacion')) {
        await sr.entities.FiscalVatProof.update(p.id, { status: 'reemplazado' });
      }
      const created = await sr.entities.FiscalVatProof.create({ ...proofData, status: 'en_verificacion', uploaded_date: new Date().toISOString() });
      proofId = created.id;
    }
    vat_payment = {
      method_id: method.id, method_name: method.name, method_snapshot: snapshot(method), amount_paid: paidCents / 100, reference,
      payment_date: v.payment_date, proof_uri: v.proof_uri, proof_type: fileType(v.proof_type), proof_id: proofId,
      verification_status: 'en_verificacion', verification_notes: '',
    };
    newStatus = 'pago_iva_en_verificacion';
  }

  const changes = !sameMoney(r.total, calc.total) && r.total > 0
    ? { total: { before: r.total, after: calc.total }, vat_amount: { before: r.vat_amount, after: calc.vat_amount } } : undefined;
  const updated = await sr.entities.FiscalInvoiceRequest.update(r.id, {
    ...tax, lines: calc.lines, subtotal: calc.subtotal, vat_rate: calc.vat_rate, vat_amount: calc.vat_amount, total: calc.total,
    vat_payment, status: newStatus, correction_notes: '', submitted_date: r.submitted_date || new Date().toISOString(),
  });
  await audit(sr, r, user, 'cliente', 'submit', r.status, newStatus, 'Solicitud enviada por el cliente', changes);
  await notifyAdmins(sr, r, 'Nueva solicitud de factura fiscal', `${r.request_number} (${r.shipping_mark || r.client_email}): IVA ${money(calc.vat_amount)} por verificar`).catch(() => {});
  return { request: updated };
}

// ---------- Acciones del administrador ----------

async function reviewVat(sr: any, user: any, body: any) {
  const r = await loadRequest(sr, body.id);
  const vp = r.vat_payment || {};
  if (vp.verification_status !== 'en_verificacion') throw new HttpError('No hay un comprobante pendiente de verificación', 409);
  const decision = String(body.decision || '');
  const notes = String(body.notes || '').trim().slice(0, 500);
  const proofs = await sr.entities.FiscalVatProof.filter({ request_id: r.id }, '-created_date', 50);
  const proof = proofs.find((p: any) => p.id === vp.proof_id) || proofs.find((p: any) => p.status === 'en_verificacion');
  const review = { reviewed_by: user.email, reviewed_by_name: user.full_name || user.email, reviewed_date: new Date().toISOString(), review_notes: notes };

  if (decision === 'hold') {
    await audit(sr, r, user, 'admin', 'vat_hold', r.status, r.status, notes || 'Se mantiene en verificación');
    return { request: r };
  }
  if (decision === 'approve') {
    if (proof) await sr.entities.FiscalVatProof.update(proof.id, { status: 'verificado', ...review });
    const updated = await sr.entities.FiscalInvoiceRequest.update(r.id, {
      status: 'pendiente_revision_fiscal',
      vat_payment: { ...vp, verification_status: 'verificado', verified_amount: r.vat_amount, verified_by: user.email, verified_by_name: user.full_name || user.email, verified_date: review.reviewed_date, verification_notes: notes },
    });
    await audit(sr, r, user, 'admin', 'vat_approved', r.status, 'pendiente_revision_fiscal', notes || 'Pago del IVA verificado');
    await notifyClient(sr, r, 'Pago del IVA verificado', `Verificamos el pago del IVA de tu solicitud ${r.request_number}. Ahora revisaremos tus datos fiscales.`).catch(() => {});
    return { request: updated };
  }
  if (decision === 'reject') {
    if (notes.length < 3) throw new HttpError('Indica el motivo del rechazo');
    if (proof) await sr.entities.FiscalVatProof.update(proof.id, { status: 'rechazado', ...review });
    const updated = await sr.entities.FiscalInvoiceRequest.update(r.id, {
      status: 'comprobante_rechazado',
      vat_payment: { ...vp, verification_status: 'rechazado', verified_by: user.email, verified_by_name: user.full_name || user.email, verified_date: review.reviewed_date, verification_notes: notes },
    });
    await audit(sr, r, user, 'admin', 'vat_rejected', r.status, 'comprobante_rechazado', notes);
    await notifyClient(sr, r, 'Comprobante del IVA rechazado', `Tu comprobante de la solicitud ${r.request_number} fue rechazado: ${notes}. Carga uno nuevo desde Mis facturas fiscales.`).catch(() => {});
    return { request: updated };
  }
  throw new HttpError('Decisión no válida');
}

async function reviewRequest(sr: any, user: any, body: any) {
  const r = await loadRequest(sr, body.id);
  const decision = String(body.decision || '');
  const notes = String(body.notes || '').trim().slice(0, 500);
  if (FINAL.includes(r.status)) throw new HttpError('La solicitud ya está cerrada', 409);

  if (decision === 'approve') {
    const vp = r.vat_payment || {};
    if (r.status !== 'pendiente_revision_fiscal') throw new HttpError('Solo se aprueba una solicitud pendiente de revisión fiscal', 409);
    if (vp.verification_status !== 'verificado' || !sameMoney(vp.verified_amount, r.vat_amount)) throw new HttpError('El pago del IVA debe estar verificado por el importe vigente', 409);
    const updated = await sr.entities.FiscalInvoiceRequest.update(r.id, { status: 'aprobada' });
    await audit(sr, r, user, 'admin', 'request_approved', r.status, 'aprobada', notes || 'Solicitud aprobada');
    await notifyClient(sr, r, 'Solicitud de factura fiscal aprobada', `Tu solicitud ${r.request_number} fue aprobada y está lista para emisión.`).catch(() => {});
    return { request: updated };
  }
  if (decision === 'reject') {
    if (notes.length < 3) throw new HttpError('Indica el motivo del rechazo');
    const updated = await sr.entities.FiscalInvoiceRequest.update(r.id, { status: 'rechazada', rejection_reason: notes });
    await audit(sr, r, user, 'admin', 'request_rejected', r.status, 'rechazada', notes);
    await notifyClient(sr, r, 'Solicitud de factura fiscal rechazada', `Tu solicitud ${r.request_number} fue rechazada: ${notes}`).catch(() => {});
    return { request: updated };
  }
  if (decision === 'request_correction') {
    if (notes.length < 3) throw new HttpError('Describe qué debe corregir el cliente');
    if (!CORRECTABLE.includes(r.status)) throw new HttpError('No se pueden pedir correcciones en este estado', 409);
    const updated = await sr.entities.FiscalInvoiceRequest.update(r.id, { status: 'requiere_correccion', correction_notes: notes });
    await audit(sr, r, user, 'admin', 'correction_requested', r.status, 'requiere_correccion', notes);
    await notifyClient(sr, r, 'Tu solicitud de factura fiscal requiere corrección', `Solicitud ${r.request_number}: ${notes}`).catch(() => {});
    return { request: updated };
  }
  throw new HttpError('Decisión no válida');
}

async function adminEdit(sr: any, user: any, body: any) {
  const r = await loadRequest(sr, body.id);
  if (FINAL.includes(r.status)) throw new HttpError('La solicitud ya está cerrada', 409);
  const notes = String(body.notes || '').trim().slice(0, 500);
  if (notes.length < 3) throw new HttpError('Indica el motivo del cambio');
  const tax = parseTax(body, true);
  const calc = parseLines(body, true);
  const vp = r.vat_payment || {};
  const amountChanged = !sameMoney(r.vat_amount, calc.vat_amount);
  const invalidated = vp.verification_status === 'verificado' && !sameMoney(vp.verified_amount, calc.vat_amount);

  const patch: any = { ...tax, lines: calc.lines, subtotal: calc.subtotal, vat_rate: calc.vat_rate, vat_amount: calc.vat_amount, total: calc.total };
  let toStatus = r.status;
  if (invalidated) {
    toStatus = 'requiere_correccion';
    patch.status = toStatus;
    patch.vat_payment = { ...vp, verification_status: 'sin_comprobante', proof_uri: '' };
    patch.correction_notes = `El IVA de la solicitud cambió de ${money(r.vat_amount)} a ${money(calc.vat_amount)}. Registra un nuevo pago del IVA por el monto correspondiente.`;
  }
  const changes = {
    legal_name: { before: r.legal_name, after: tax.legal_name }, rif: { before: r.rif, after: tax.rif },
    fiscal_address: { before: r.fiscal_address, after: tax.fiscal_address },
    subtotal: { before: r.subtotal, after: calc.subtotal }, vat_amount: { before: r.vat_amount, after: calc.vat_amount }, total: { before: r.total, after: calc.total },
    lines_before: r.lines, lines_after: calc.lines,
  };
  const updated = await sr.entities.FiscalInvoiceRequest.update(r.id, patch);
  await audit(sr, r, user, 'admin', 'admin_edit', r.status, toStatus, notes + (invalidated ? ' (el pago del IVA verificado quedó sin efecto por el cambio de importe)' : ''), amountChanged || invalidated ? changes : { legal_name: changes.legal_name, rif: changes.rif, fiscal_address: changes.fiscal_address });
  if (invalidated) await notifyClient(sr, r, 'Tu solicitud de factura fiscal requiere corrección', patch.correction_notes).catch(() => {});
  return { request: updated };
}

async function issue(sr: any, user: any, body: any) {
  const r = await loadRequest(sr, body.id);
  if (r.status === 'emitida') throw new HttpError('Esta solicitud ya tiene una factura emitida', 409);
  if (r.status !== 'aprobada') throw new HttpError('La solicitud debe estar aprobada para registrar la emisión', 409);
  const vp = r.vat_payment || {};
  if (vp.verification_status !== 'verificado' || !sameMoney(vp.verified_amount, r.vat_amount)) throw new HttpError('El pago del IVA debe estar verificado', 409);
  const number = String(body.document_number || '').trim().slice(0, 40);
  if (!number) throw new HttpError('Indica el número del documento fiscal');
  if (!DATE_RX.test(String(body.issued_date || ''))) throw new HttpError('Indica la fecha de emisión');
  if (!isUri(body.document_uri)) throw new HttpError('Adjunta la copia del documento definitivo');
  const others = await sr.entities.FiscalInvoiceRequest.filter({ issued_number: number }, '-created_date', 5);
  if (others.some((o: any) => o.id !== r.id)) throw new HttpError('Ese número de documento ya fue registrado en otra solicitud', 409);
  const docs = await sr.entities.FiscalDocument.filter({ request_id: r.id }, '-created_date', 1);
  if (docs.length) throw new HttpError('Esta solicitud ya tiene un documento definitivo', 409);

  await sr.entities.FiscalDocument.create({
    request_id: r.id, request_number: r.request_number, client_email: r.client_email, kind: 'definitivo', document_number: number,
    issued_date: body.issued_date, file_uri: body.document_uri, file_type: fileType(body.document_type), created_by_email: user.email,
  });
  const updated = await sr.entities.FiscalInvoiceRequest.update(r.id, {
    status: 'emitida', issued_number: number, issued_date: body.issued_date, issued_by: user.email,
    issued_document_uri: body.document_uri, issued_document_type: fileType(body.document_type),
  });
  await audit(sr, r, user, 'admin', 'issued', r.status, 'emitida', String(body.notes || `Documento ${number}`).slice(0, 500));
  await notifyClient(sr, r, 'Tu factura fiscal está disponible', `La factura fiscal de la solicitud ${r.request_number} ya fue emitida. Descárgala desde Mis facturas fiscales.`).catch(() => {});
  return { request: updated };
}

async function deleteMethod(sr: any, body: any) {
  const rows = await sr.entities.FiscalVatPaymentMethod.filter({ id: String(body.id || '') });
  if (!rows[0]) throw new HttpError('Método no encontrado', 404);
  const linked = await sr.entities.FiscalVatProof.filter({ method_id: rows[0].id }, '-created_date', 1);
  if (linked.length) {
    await sr.entities.FiscalVatPaymentMethod.update(rows[0].id, { archived: true, active: false });
    return { archived: true };
  }
  await sr.entities.FiscalVatPaymentMethod.delete(rows[0].id);
  return { deleted: true };
}

const CLIENT_ACTIONS: Record<string, any> = { registerIntent, saveDraft, submit };
const ADMIN_ACTIONS: Record<string, any> = { reviewVat, reviewRequest, adminEdit, issue };

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const sr = base44.asServiceRole;

    if (CLIENT_ACTIONS[action]) return Response.json(await CLIENT_ACTIONS[action](sr, user, body));

    if (ADMIN_ACTIONS[action] || action === 'deleteMethod') {
      if (!(await canManageFiscal(base44, user))) return Response.json({ error: 'No tienes permiso para este módulo' }, { status: 403 });
      if (action === 'deleteMethod') return Response.json(await deleteMethod(sr, body));
      return Response.json(await ADMIN_ACTIONS[action](sr, user, body));
    }
    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: error.message }, { status: 500 });
  }
}