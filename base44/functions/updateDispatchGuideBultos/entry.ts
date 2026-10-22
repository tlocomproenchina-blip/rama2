import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  markScansWithGuide,
  normCode,
  packageCountOfBulto,
  recomputeGuideTotals,
  releaseScansFromGuide,
  unique,
} from '../../shared/dispatchGuideAppend.ts';

// Suma o quita bultos de una guía ya emitida, desde el historial de Guías de Despacho.
// Trabaja sobre un cliente de la guía: se le pasan los códigos que entran y los que
// salen. Al guardar se recalculan los totales del cliente y de la guía, y los escaneos
// se marcan (entran) o se sueltan (salen) para que la lista de pendientes quede igual
// que la guía.
//
// Recibe: { guide_id, client_email, add_codes?: string[], remove_codes?: string[],
//           remove_unregistered?: string[] }
// remove_unregistered quita las líneas de carga emitidas por su N° de contenedor
// (carga que salió sin bulto registrado) usando esos números.
// Devuelve: { guide, added: string[], removed: string[] }
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const guideId = String(body.guide_id || '').trim();
    const clientEmail = String(body.client_email || '').trim();
    const addCodes = unique((Array.isArray(body.add_codes) ? body.add_codes : []).map(normCode).filter(Boolean));
    const removeCodes = unique(
      (Array.isArray(body.remove_codes) ? body.remove_codes : []).map(normCode).filter(Boolean)
    );
    const removeOrders = unique(
      (Array.isArray(body.remove_unregistered) ? body.remove_unregistered : [])
        .map((order: any) => String(order || '').trim())
        .filter(Boolean)
    );

    if (!guideId || (!addCodes.length && !removeCodes.length && !removeOrders.length)) {
      return Response.json({ error: 'Falta la guía o los bultos a mover' }, { status: 400 });
    }
    if (!clientEmail) {
      return Response.json({ error: 'Falta el cliente de la guía' }, { status: 400 });
    }

    const guide: any = await base44.asServiceRole.entities.DispatchGuide.get(guideId).catch(() => null);
    if (!guide) return Response.json({ error: 'No se encontró la guía' }, { status: 404 });

    const clients = (Array.isArray(guide.clients) ? guide.clients : []).map((client: any) => ({
      ...client,
      bultos: [...(client.bultos || [])],
    }));
    const emailKey = clientEmail.toLowerCase();
    const index = clients.findIndex(
      (client: any) => String(client.client_email || '').trim().toLowerCase() === emailKey
    );
    if (index < 0) {
      return Response.json({ error: 'Ese cliente no está en la guía' }, { status: 404 });
    }
    const target: any = clients[index];

    // --- Bultos que salen ---
    if (removeCodes.length) {
      target.bultos = target.bultos.filter(
        (bulto: any) => !removeCodes.includes(normCode(bulto?.label_code))
      );
    }

    // --- Líneas sin bulto registrado que salen (por su N° de contenedor) ---
    const isUnregistered = (bulto: any) => !!bulto && (!!bulto.unregistered || !normCode(bulto?.label_code));
    const orderOf = (bulto: any) => String(bulto?.order_number || '').trim();
    if (removeOrders.length) {
      target.bultos = target.bultos.filter(
        (bulto: any) => !(isUnregistered(bulto) && removeOrders.includes(orderOf(bulto)))
      );
    }

    // --- Bultos que entran: se toman del registro real del bulto ---
    const emittedDate = new Date().toISOString();
    if (addCodes.length) {
      const rows: any[] = await base44.asServiceRole.entities.Bulto
        .filter({ label_code: { $in: addCodes }, client_email: clientEmail }, '-created_date', 200)
        .catch(() => []);
      const inGuide = new Set((target.bultos || []).map((bulto: any) => normCode(bulto?.label_code)));
      const fresh = (rows || [])
        .filter((row: any) => row?.label_code && !inGuide.has(normCode(row.label_code)))
        .map((row: any) => ({
          label_code: row.label_code,
          package_count: packageCountOfBulto(row),
          registered: true,
          date: emittedDate,
          order_number: (row.cbm_order_numbers || []).filter(Boolean).join(', '),
          scans: 1,
          is_caja: !!row.is_caja,
          caja_number: Number(row.caja_number) || 0,
          caja_total: Number(row.caja_total) || 0,
          cbm: Number(row.cargo_cbm) || 0,
        }));
      target.bultos = [...target.bultos, ...fresh].sort((a: any, b: any) =>
        String(a.label_code).localeCompare(String(b.label_code))
      );
      // Esa carga ya tiene bulto dentro de la guía: la línea que salió sin bulto
      // registrado por el mismo N° de contenedor deja de mostrarse.
      const addedOrders = new Set(
        (rows || []).flatMap((row: any) =>
          (Array.isArray(row?.cbm_order_numbers) ? row.cbm_order_numbers : []).map((order: any) =>
            String(order || '').trim()
          )
        )
      );
      if (addedOrders.size) {
        target.bultos = target.bultos.filter(
          (bulto: any) => !(isUnregistered(bulto) && addedOrders.has(orderOf(bulto)))
        );
      }
      if (!fresh.length && !removeCodes.length && !removeOrders.length) {
        return Response.json({ error: 'Esos bultos ya están en la guía' }, { status: 409 });
      }
    }

    target.totals = recomputeGuideTotals([target]);

    const codesInGuide = unique(
      clients.flatMap((client: any) =>
        (client.bultos || []).map((bulto: any) => normCode(bulto?.label_code))
      )
    );

    const saved = await base44.asServiceRole.entities.DispatchGuide.update(guideId, {
      clients,
      bulto_codes: codesInGuide,
      totals: recomputeGuideTotals(clients),
      client_names: unique(clients.map((client: any) => client.client_name)),
      client_emails: unique(clients.map((client: any) => client.client_email)),
      shipping_marks: unique(clients.map((client: any) => client.shipping_mark)),
      last_updated_date: emittedDate,
      last_updated_by: user.email || '',
    });

    // Escaneos: los que entran quedan marcados con la guía; los que salen vuelven a la
    // lista de pendientes. Un código que entró y salió en la misma llamada no se suelta.
    const addedCodes = codesInGuide.filter((code: string) => addCodes.includes(code));
    const releasedCodes = removeCodes.filter((code: string) => !codesInGuide.includes(code));
    if (addedCodes.length) {
      await markScansWithGuide(base44, {
        codes: addedCodes,
        guideId,
        guideNumber: guide.guide_number,
        emittedDate: guide.emitted_date,
      });
    }
    if (releasedCodes.length) {
      await releaseScansFromGuide(base44, { codes: releasedCodes, guideId });
    }

    return Response.json({ guide: saved, added: addedCodes, removed: releasedCodes });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}