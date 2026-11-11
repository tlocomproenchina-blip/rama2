import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { syncInvoice } from '../../shared/referralSync.ts';

// Se ejecuta al actualizarse una factura: avanza el estado del envío referido.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const id = body?.data?.id || body?.event?.entity_id || body?.invoice_id;
    if (!id) return Response.json({ skipped: 'sin factura' });
    const sr = base44.asServiceRole;
    const inv = (await sr.entities.Invoice.filter({ id }))[0];
    if (!inv) return Response.json({ skipped: 'factura no encontrada' });
    return Response.json(await syncInvoice(sr, inv));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});