// Revisión de tarifas de todas las facturas manuales (INV-M-).
//
// Cada línea de envío se compara con la tarifa que le corresponde según el tipo de
// carga de su recibo (regular / alto riesgo), la fecha del recibo (RateHistory) y el
// estado del cliente. Las facturas que se pueden reconstruir con certeza se corrigen
// solas: solo las líneas de envío, los totales derivados y el desglose de costos.
// Las que no guardan datos suficientes vuelven en `review` sin tocarse, y las que ya
// están bien vuelven en `verified`. Los pagos registrados, el estado de pago y los
// conceptos que no son envío (seguro, consolidación, puerta a puerta, adicionales)
// se conservan intactos.
//
// Con apply=false no modifica nada y solo informa cómo quedarían las facturas.
// Solo administradores.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { fetchAllFilter, num } from '../../shared/paginatedFetch.ts';
import {
  loadRateBase, loadClientStates, stateShippingRateFor, buildRateContext,
  rateForReceipt, round2,
} from '../../shared/billingRates.ts';
import { invoiceLines } from '../../shared/duplicateReceipts.ts';

// Diferencias de hasta 5 centavos se consideran la misma tarifa.
const MATCH_TOLERANCE = 0.05;
// Máximo de recibos sin tipo de carga para probar las combinaciones posibles (2^n).
const COMBO_LIMIT = 12;

// Líneas de envío facturadas por volumen: las que traen su N° de envío, sus recibos
// de origen o un CBM propio. Deja fuera el puerta a puerta, el seguro, la
// consolidación y los montos adicionales.
function volumeLines(invoice: any) {
  return invoiceLines(invoice).filter((l: any) =>
    !!l.id || !!l.number || (l.source_numbers || []).length > 0 || num(l.cbm) > 0
  );
}

// Envío de una lista de recibos: el CBM facturado se reparte entre los recibos y
// cada uno se cotiza con la tarifa de su fecha y su tipo de carga.
function shippingByReceipt(ctx: any, receipts: any[], billed: any) {
  const totalCbm = receipts.reduce((s: number, r: any) => s + num(r.cbm), 0);
  const scale = totalCbm > 0 ? ((num(billed) > 0 ? num(billed) : totalCbm) / totalCbm) : 1;
  const amounts = receipts.map((r: any) => num(r.cbm) * scale * rateForReceipt(ctx, r.fecha, r.type));
  return { scale, amounts, total: amounts.reduce((s: number, a: number) => s + a, 0) };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const apply = body.apply !== false;

    const invoices = await fetchAllFilter(
      base44.asServiceRole.entities.Invoice,
      { invoice_number: { $regex: '^INV-M-' } },
      '-invoice_date'
    );
    if (!invoices.length) {
      return Response.json({ ok: true, applied: apply, reviewed: 0, summary: { corrected: 0, verified: 0, review: 0 }, corrected: [], verified: [], review: [] });
    }

    // Recibos (CbmIngreso) implicados: por id (facturas nuevas) y por N° de envío
    // (facturas antiguas, que solo guardaban el número).
    const ids = [...new Set(invoices.flatMap((inv: any) => (inv.manual_recibos || []).map((r: any) => r.cbm_ingreso_id)).filter(Boolean))];
    const receiptsById: Record<string, any> = {};
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = await base44.asServiceRole.entities.CbmIngreso.filter({ id: { $in: ids.slice(i, i + 100) } }, '-fecha', 100);
      for (const r of chunk || []) receiptsById[r.id] = r;
    }

    const numbers = [...new Set(invoices.flatMap((inv: any) => [
      ...(inv.manual_recibos || []).map((r: any) => r.invoice_number),
      ...(inv.items || []).flatMap((it: any) => ((it?.details || {}).source_invoices || [])),
    ]).map((n: any) => String(n ?? '').trim()).filter(Boolean))];
    const receiptsByNumber: Record<string, any> = {};
    for (let i = 0; i < numbers.length; i += 80) {
      const chunk = await base44.asServiceRole.entities.CbmIngreso.filter({ invoice_number: { $in: numbers.slice(i, i + 80) } }, '-fecha', 80);
      for (const r of chunk || []) {
        receiptsByNumber[`${String(r.client_email || '').trim().toLowerCase()}|${String(r.invoice_number || '').trim()}`] = r;
      }
    }

    const rateBase = await loadRateBase(base44);
    const emails = [...new Set(invoices.map((inv: any) => String(inv.client_email || '')).filter(Boolean))];
    const clientStates = await loadClientStates(base44, emails);

    const corrected: any[] = [];
    const verified: any[] = [];
    const review: any[] = [];

    for (const invoice of invoices) {
      const number = String(invoice.invoice_number || '');
      const email = String(invoice.client_email || '');
      const state = String(clientStates[email] || '').trim().toLowerCase();
      const reject = (reason: string, extra: any = {}) =>
        review.push({ invoice_number: number, client_email: email, status: invoice.status, reason, ...extra });

      if (invoice.status === 'cancelada') { reject('La factura está cancelada: no se revisa su tarifa.'); continue; }

      const lines = volumeLines(invoice);
      if (!lines.length) { reject('La factura no tiene líneas de envío que revisar.'); continue; }

      const stored = round2(lines.reduce((s: number, l: any) => s + num(l.amount), 0));
      // Factura que no cobró nada por el envío: no hay una tarifa mal aplicada que
      // reconstruir, así que se deja para revisión manual en vez de inventar un cobro.
      if (stored <= 0) {
        reject('Esta factura no cobró nada por el envío: hay que revisar a mano si le corresponde la tarifa de sus recibos.');
        continue;
      }

      // Recibos de la factura con su volumen, su fecha y su tipo de carga.
      const key = (order: any) => `${email.trim().toLowerCase()}|${String(order || '').trim()}`;
      const linked = lines.filter((l: any) => l.id || l.number);
      const receipts = (linked.length
        ? linked.map((l: any) => {
          const rec = (l.id && receiptsById[l.id]) || receiptsByNumber[key(l.number)] || null;
          return { order: String(l.number || rec?.invoice_number || ''), cbm: num(l.cbm) || num(rec?.cbm), fecha: rec?.fecha || null, type: l.type || null };
        })
        : [...new Set(lines.flatMap((l: any) => l.source_numbers))].map((order: any) => {
          const rec = receiptsByNumber[key(order)] || null;
          return { order: String(order), cbm: num(rec?.cbm), fecha: rec?.fecha || null, type: null };
        }));

      if (!receipts.length || receipts.every((r: any) => !r.fecha)) {
        reject('No se pudieron ubicar los recibos (N° de envío) de esta factura.');
        continue;
      }
      if (receipts.some((r: any) => !r.fecha)) {
        reject('A alguno de sus recibos le falta la fecha, así que no se puede saber qué tarifa le correspondía.');
        continue;
      }
      if (!state) {
        reject('El cliente no tiene estado registrado en su perfil, así que no se puede aplicar la tarifa de su estado.');
        continue;
      }

      const ctx = buildRateContext({
        appConfig: rateBase.appConfig,
        pricing: rateBase.pricing,
        rateHistory: rateBase.rateHistory,
        stateShippingRate: stateShippingRateFor(rateBase, state),
      });
      const billed = num(invoice.billed_cbm) || num(invoice.total_cbm);
      const typed = receipts.every((r: any) => r.type === 'general' || r.type === 'alto_riesgo');

      // Sin el tipo de carga de cada recibo la factura no se puede recalcular. Si su
      // monto corresponde a alguna combinación de las tarifas vigentes, se da por
      // revisada; si no corresponde a ninguna, se deja para revisión manual.
      if (!typed) {
        if (receipts.length > COMBO_LIMIT) {
          reject('La factura no registra el tipo de carga de cada recibo y tiene demasiados recibos para probar las combinaciones de tarifas.');
          continue;
        }
        const combos = new Set(
          Array.from({ length: 2 ** receipts.length }, (_, mask) => round2(
            shippingByReceipt(ctx, receipts.map((r: any, i: number) => ({ ...r, type: (mask >> i) & 1 ? 'alto_riesgo' : 'general' })), billed).total
          ))
        );
        if (combos.has(stored)) {
          verified.push({ invoice_number: number, client_email: email, status: invoice.status, shipping: stored, no_type: true });
        } else {
          reject('El monto de envío no corresponde a ninguna combinación de las tarifas vigentes (regular / alto riesgo) de sus recibos.', {
            shipping_stored: stored,
            expected_general: round2(shippingByReceipt(ctx, receipts.map((r: any) => ({ ...r, type: 'general' })), billed).total),
            expected_high_risk: round2(shippingByReceipt(ctx, receipts.map((r: any) => ({ ...r, type: 'alto_riesgo' })), billed).total),
          });
        }
        continue;
      }

      // Tipo de carga registrado: se recalcula cada línea con la tarifa que le toca.
      const byOrder: Record<string, any> = {};
      for (const r of receipts) if (r.order) byOrder[String(r.order).trim()] = r;

      const scale = shippingByReceipt(ctx, receipts, billed).scale;
      const detail: any[] = [];
      let newShipping = 0;
      let lineError = '';
      for (const l of lines) {
        const rec = byOrder[String(l.number || '').trim()]
          || (lines.length === 1 && receipts.length === 1 ? receipts[0] : null);
        if (!rec) { lineError = `No se pudo ubicar el recibo de la línea de envío "${String(l.desc || '').slice(0, 40)}".`; break; }
        const unit = rateForReceipt(ctx, rec.fecha, rec.type) * scale;
        const total = round2(num(l.cbm) * unit);
        newShipping += total;
        detail.push({
          index: l.index,
          order: String(rec.order || ''),
          cbm: num(l.cbm),
          type: rec.type,
          unit_before: num(l.item?.unit_price),
          unit_after: Number(unit.toFixed(4)),
          before: round2(num(l.amount)),
          after: total,
        });
      }
      if (lineError) { reject(lineError); continue; }
      newShipping = round2(newShipping);

      const before = round2(num(invoice.total));
      if (Math.abs(newShipping - stored) <= MATCH_TOLERANCE) {
        verified.push({ invoice_number: number, client_email: email, status: invoice.status, shipping: stored });
        continue;
      }

      const after = round2(before + (newShipping - stored));
      const breakdown = invoice.cost_breakdown || {};
      const audit = {
        date: new Date().toISOString(),
        by: user.email || 'admin',
        shipping_before: stored,
        shipping_after: newShipping,
        total_before: before,
        total_after: after,
      };
      const updates: any = {
        items: (invoice.items || []).map((item: any, index: number) => {
          const calc = detail.find((d: any) => d.index === index);
          if (!calc) return item;
          return {
            ...item,
            description: `Envío ${calc.order}`,
            quantity: calc.cbm,
            unit_price: calc.unit_after,
            total: calc.after,
            details: {
              ...(item.details || {}),
              cbm: calc.cbm,
              invoice_number: calc.order,
              source_invoices: [calc.order],
              cargo_type: calc.type,
            },
          };
        }),
        subtotal: after,
        total: after,
        cost_breakdown: {
          ...breakdown,
          shipping_total: newShipping,
          rate_per_cbm: billed > 0 ? Number((newShipping / billed).toFixed(4)) : 0,
          rate_audit: [...(Array.isArray(breakdown.rate_audit) ? breakdown.rate_audit : []), audit].slice(-10),
        },
        notes: [
          String(invoice.notes || '').trim(),
          `Tarifas de envío revisadas el ${audit.date.slice(0, 10)}: $${stored.toFixed(2)} → $${newShipping.toFixed(2)}.`,
        ].filter(Boolean).join('\n').slice(0, 1000),
      };
      // La ganancia guardada depende del total: se recalcula con el mismo criterio
      // con el que se calculó al emitir (total - costo proveedor). La cuenta por
      // pagar del proveedor y sus abonos no se tocan.
      if (invoice.profit_amount !== undefined && invoice.profit_amount !== null) {
        updates.profit_amount = round2(after - num(invoice.provider_cost_total));
      }

      if (apply) await base44.asServiceRole.entities.Invoice.update(invoice.id, updates);

      corrected.push({
        invoice_number: number,
        client_email: email,
        status: invoice.status,
        shipping_before: stored,
        shipping_after: newShipping,
        total_before: before,
        total_after: after,
        paid_amount: num(invoice.paid_amount),
        overpaid: num(invoice.paid_amount) > after + MATCH_TOLERANCE,
        receipts: detail,
        applied: apply,
      });
    }

    return Response.json({
      ok: true,
      applied: apply,
      reviewed: invoices.length,
      summary: { corrected: corrected.length, verified: verified.length, review: review.length },
      corrected,
      verified,
      review,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Error al revisar las tarifas de las facturas' }, { status: 500 });
  }
}