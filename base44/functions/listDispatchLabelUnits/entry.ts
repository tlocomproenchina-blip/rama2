import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getClientByEmail } from '../../shared/bultoScan.ts';
import { normCode, packageCountOfBulto } from '../../shared/dispatchGuideAppend.ts';

// Unidades de un cliente listas para armar su lote de etiquetas de despacho: sus cajas
// consolidadas y sus bultos sueltos que todavía no salieron del almacén. Las unidades
// que ya están dentro de una guía se devuelven marcadas (in_guide + guide_number) para
// avisarlas en pantalla, sin esconderlas ni bloquearlas: el operador decide si las
// vuelve a incluir. Solo quedan fuera las ya despachadas, porque una unidad despachada
// no puede entrar a una guía nueva.
//
// Recibe: { client_email, device_id? }
// Devuelve: { client, units: [{ id, label_code, is_caja, bulto_number, caja_number,
//             caja_total, package_count, cbm, status, order_numbers, in_guide,
//             guide_number }], total, cajas, bultos }
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
      .filter({ client_email: clientEmail, status: { $ne: 'despachado' } }, '-created_date', 500)
      .catch(() => []);
    const units = (rows || []).filter((unit: any) => !!unit?.label_code);

    // Guías del cliente: las unidades ya incluidas en una se avisan, no se ocultan.
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

    const unitRows = units
      .map((unit: any) => {
        const guide: any = coveredBy.get(normCode(unit.label_code));
        return {
          id: unit.id,
          label_code: unit.label_code,
          is_caja: !!unit.is_caja,
          bulto_number: Number(unit.bulto_number) || 0,
          caja_number: Number(unit.caja_number) || 0,
          caja_total: Number(unit.caja_total) || 0,
          package_count: packageCountOfBulto(unit),
          cbm: Number(unit.cargo_cbm) || 0,
          status: unit.status || '',
          order_numbers: (unit.cbm_order_numbers || []).filter(Boolean),
          in_guide: !!guide,
          guide_number: guide?.guide_number || '',
        };
      })
      .sort(
        (a: any, b: any) =>
          Number(b.is_caja) - Number(a.is_caja) ||
          (a.caja_number || 0) - (b.caja_number || 0) ||
          (a.bulto_number || 0) - (b.bulto_number || 0) ||
          String(a.label_code).localeCompare(String(b.label_code))
      );

    const profile: any = await getClientByEmail(base44, clientEmail);
    const snapshot = units.find((unit: any) => unit.client_snapshot?.full_name)?.client_snapshot || {};

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
      units: unitRows,
      total: unitRows.length,
      cajas: unitRows.filter((unit: any) => unit.is_caja).length,
      bultos: unitRows.filter((unit: any) => !unit.is_caja).length,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}