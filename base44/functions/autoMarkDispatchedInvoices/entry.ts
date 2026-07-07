import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Marca automáticamente como "despachada" toda factura pagada al proveedor
// hace 10 días o más, sin intervención manual.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 10);
    const cutoffIso = cutoff.toISOString();

    let updated = 0;
    let skip = 0;
    const pageSize = 100;

    while (true) {
      const candidates = await base44.asServiceRole.entities.Invoice.filter(
        { provider_paid: true },
        '-provider_paid_date',
        pageSize,
        skip
      );
      if (!candidates || candidates.length === 0) break;

      const toDispatch = candidates.filter((inv) =>
        !inv.dispatched &&
        inv.provider_paid_date &&
        inv.provider_paid_date <= cutoffIso
      );

      for (const inv of toDispatch) {
        await base44.asServiceRole.entities.Invoice.update(inv.id, {
          dispatched: true,
          dispatched_date: new Date().toISOString()
        });
        updated++;
      }

      if (candidates.length < pageSize) break;
      skip += pageSize;
    }

    return Response.json({ ok: true, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});