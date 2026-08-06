import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Devuelve un mapa { receipt: total_expected } con la cantidad total de paquetes
// que debería tener cada recibo según los registros de CbmIngreso (AdminCbmIngresos).
// Se usa para calcular cuántos paquetes faltan despachar por recibo en una orden.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const receipts = Array.isArray(body?.receipts) ? body.receipts.map((r) => String(r).trim()).filter(Boolean) : [];
    const clientEmail = String(body?.client_email || '').trim();
    if (receipts.length === 0) return Response.json({ totals: {} });

    // Buscar todos los CbmIngreso del cliente (o todos si no hay email) y agrupar por invoice_number
    let ingresos = [];
    if (clientEmail) {
      ingresos = await base44.asServiceRole.entities.CbmIngreso.filter({ client_email: clientEmail }, '-fecha', 500);
    } else {
      ingresos = await base44.asServiceRole.entities.CbmIngreso.list('-fecha', 500);
    }

    // Contar tracking_numbers por invoice_number
    const countsByInvoice = {};
    for (const ing of (ingresos || [])) {
      const inv = String(ing.invoice_number || '').trim();
      if (!inv) continue;
      const tns = Array.isArray(ing.tracking_numbers) ? ing.tracking_numbers.filter(Boolean) : [];
      if (!countsByInvoice[inv]) countsByInvoice[inv] = new Set();
      for (const t of tns) countsByInvoice[inv].add(String(t).trim());
    }

    // Construir resultado solo para los recibos solicitados
    const totals = {};
    for (const r of receipts) {
      const set = countsByInvoice[r];
      totals[r] = set ? set.size : 0;
    }

    return Response.json({ totals });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}