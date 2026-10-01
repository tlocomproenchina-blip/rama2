import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getClientByEmail } from '../../shared/bultoScan.ts';

// Numera las cajas de un cliente para su tira de etiquetas continuas.
//
// Al terminar de armar el lote el almacén ya sabe cuántas cajas quedaron (N): aquí se
// fija la posición X de cada caja (1..N), para que el X/N quede impreso igual en la
// etiqueta que se pega en la caja y en la guía de despacho. Es una numeración estable:
// volver a imprimir la misma tira conserva la posición ya asignada.
//
// Recibe: { client_email, caja_ids?: string[], device_id }
// Devuelve: { client, cajas: [{ id, label_code, caja_number, caja_total, package_count, cbm, order_numbers }], total }
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
    const assignedBy = sessionUser?.email || `Dispositivo ${deviceId.slice(0, 8).toUpperCase()}`;

    const clientEmail = String(body.client_email || '').trim();
    if (!clientEmail) return Response.json({ error: 'Falta el cliente' }, { status: 400 });

    const onlyIds = new Set(
      (Array.isArray(body.caja_ids) ? body.caja_ids : []).map((id: any) => String(id || '').trim()).filter(Boolean)
    );

    const rows = await base44.asServiceRole.entities.Bulto
      .filter({ client_email: clientEmail, is_caja: true }, '-created_date', 500)
      .catch(() => []);
    const pending = (rows || [])
      .filter((c: any) => c.status !== 'despachado')
      .filter((c: any) => !onlyIds.size || onlyIds.has(c.id))
      .sort((a: any, b: any) => (Number(a.bulto_number) || 0) - (Number(b.bulto_number) || 0));

    if (!pending.length) {
      return Response.json({ error: 'Este cliente no tiene cajas pendientes de etiqueta', cajas: [] });
    }

    const total = pending.length;
    const now = new Date().toISOString();

    const cajas = pending.map((caja: any, index: number) => ({
      id: caja.id,
      label_code: caja.label_code,
      caja_number: index + 1,
      caja_total: total,
      package_count: Number(caja.cargo_package_count) || (caja.package_ids || []).length,
      cbm: Number(caja.cargo_cbm) || 0,
      order_numbers: caja.cbm_order_numbers || [],
    }));

    // La posición queda guardada en la caja (es la que se imprime y la que usa la guía).
    const updates = cajas
      .filter((caja: any, index: number) => {
        const current = pending[index];
        return Number(current.caja_number) !== caja.caja_number || Number(current.caja_total) !== total;
      })
      .map((caja: any) => ({
        id: caja.id,
        caja_number: caja.caja_number,
        caja_total: caja.caja_total,
        caja_label_printed_date: now,
        caja_label_printed_by: assignedBy,
      }));

    if (updates.length) {
      try {
        await base44.asServiceRole.entities.Bulto.bulkUpdate(updates);
      } catch (_) {
        for (const item of updates) {
          await base44.asServiceRole.entities.Bulto.update(item.id, {
            caja_number: item.caja_number,
            caja_total: item.caja_total,
            caja_label_printed_date: item.caja_label_printed_date,
            caja_label_printed_by: item.caja_label_printed_by,
          }).catch(() => null);
        }
      }
    }

    const profile: any = await getClientByEmail(base44, clientEmail);
    const snapshot = pending.find((c: any) => c.client_snapshot?.full_name)?.client_snapshot || {};

    return Response.json({
      client: {
        full_name: snapshot.full_name || profile?.full_name || '',
        cedula: snapshot.cedula || profile?.cedula || '',
        whatsapp: snapshot.whatsapp || profile?.whatsapp || '',
        address: snapshot.address || profile?.address || '',
        city: snapshot.city || profile?.city || '',
        state: snapshot.state || profile?.state || '',
        shipping_mark: snapshot.shipping_mark || profile?.shipping_mark || '',
        email: clientEmail,
      },
      cajas,
      total,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}