import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { appendScanToDispatchGuide } from '../../shared/dispatchGuideAppend.ts';

// Al escanear un bulto en Despacho por Escaneo, la guía de despacho del cliente se
// arma o se completa sola: si el cliente no tiene guía abierta se crea una nueva
// con el siguiente correlativo y, si ya la tiene, el bulto se suma a esa guía. El
// escaneo queda marcado con la guía y deja de ofrecerse como pendiente; la emisión
// manual queda como respaldo para lo que no se haya podido asociar aquí.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));

    const result = await appendScanToDispatchGuide(base44, {
      label_code: body.label_code || body.scanned_code || '',
      client_email: body.client_email || '',
      client_name: body.client_name || '',
      shipping_mark: body.shipping_mark || '',
      package_count: Number(body.package_count) || 0,
      scanned_at: body.scanned_at || '',
      scanned_by: body.scanned_by || user.email || '',
      scanned_by_name: body.scanned_by_name || user.full_name || '',
    });

    return Response.json(result || {});
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}