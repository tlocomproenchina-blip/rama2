import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getClientByEmail } from '../../shared/bultoScan.ts';
import { normCode, packageCountOfBulto } from '../../shared/dispatchGuideAppend.ts';

// Cajas de un cliente listas para despacho: las que se marcan para armar su lote de
// etiquetas continuas. Devuelve el conteo real de paquetes, el CBM y si la caja ya
// forma parte de una guía (esas no entran en un lote nuevo).
//
// Recibe: { client_email, device_id? }
// Devuelve: { client, cajas: [{ id, label_code, caja_number, caja_total, package_count,
//             cbm, status, order_numbers, in_guide, guide_number }], total }
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    let sessionUser: any = null;
    try {
      sessionUser = await base44.auth.me();
    } catch (_) {
      sessionUser = null;
    }
    if (sessionUser && sessionUser.role !== 'admin') {
      return Response.json({ error: 'Solo administradores o empleados' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const deviceId = String(body.device_id || '').trim();
    if (!sessionUser && !deviceId) {
      return Response.json({ error: 'device_id requerido' }, { status: 400 });
    }

    const clientEmail = String(body.client_email || '').trim();
    if (!clientEmail) return Response.json({ error: 'Falta el cliente' }, { status: 400 });

    const rows: any[] = await base44.asServiceRole.entities.Bulto
      .filter({ client_email: clientEmail, is_caja: true }, '-created_date', 500)
      .catch(() => []);
    const pending = (rows || []).filter((c: any) => c?.status !== 'despachado');

    // Guías del cliente: sus códigos de caja ya despachados en una guía no vuelven a
    // ofrecerse para un lote nuevo.
    const guides: any[] = await base44.asServiceRole.entities.DispatchGuide
      .filter({ client_emails: clientEmail }, '-created_date', 50)
      .catch(() => []);
    const coveredBy = new Map();
    (guides || []).forEach((guide: any) => {
      (guide.bulto_codes || []).forEach((code: any) => {
        const key = normCode(code);
        if (key && !coveredBy.has(key)) coveredBy.set(key, guide);
      });
    });

    const cajas = pending
      .map((caja: any) => {
        const guide: any = coveredBy.get(normCode(caja.label_code));
        return {
          id: caja.id,
          label_code: caja.label_code,
          caja_number: Number(caja.caja_number) || 0,
          caja_total: Number(caja.caja_total) || 0,
          package_count: packageCountOfBulto(caja),
          cbm: Number(caja.cargo_cbm) || 0,
          status: caja.status || '',
          order_numbers: (caja.cbm_order_numbers || []).filter(Boolean),
          in_guide: !!guide,
          guide_number: guide?.guide_number || '',
        };
      })
      .sort(
        (a: any, b: any) =>
          (a.caja_number || 0) - (b.caja_number || 0) ||
          String(a.label_code).localeCompare(String(b.label_code))
      );

    const profile: any = await getClientByEmail(base44, clientEmail);
    const snapshot = pending.find((c: any) => c.client_snapshot?.full_name)?.client_snapshot || {};

    return Response.json({
      client: {
        full_name: snapshot.full_name || profile?.full_name || '',
        email: clientEmail,
        cedula: snapshot.cedula || profile?.cedula || '',
        whatsapp: snapshot.whatsapp || profile?.whatsapp || '',
        address: snapshot.address || profile?.address || '',
        city: snapshot.city || profile?.city || '',
        state: snapshot.state || profile?.state || '',
        shipping_mark: snapshot.shipping_mark || profile?.shipping_mark || '',
      },
      cajas,
      total: cajas.length,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}