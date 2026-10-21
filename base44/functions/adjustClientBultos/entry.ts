import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { packageCountOfBulto } from '../../shared/dispatchGuideAppend.ts';
import { syncGuidesAfterBultoChange } from '../../shared/bultoCountSync.ts';
import { syncBultoToAccounting } from '../../shared/veAccountingSync.ts';

// Corrige la cantidad total de bultos físicos de un cliente desde el historial.
//
// Recibe: { client_email, total_bultos }
// - Si el total pedido es menor que los bultos registrados, los últimos bultos se unen
//   dentro del anterior: sus paquetes, códigos sin registrar y N° de contenedor pasan al
//   bulto que queda y los bultos sobrantes se eliminan (nunca se pierde un paquete).
// - Si es mayor, solo se corrige el total declarado (no se inventan bultos).
// - En los bultos que quedan se deja total_bultos con la cantidad corregida. El N° de bulto
//   no se toca: sale del código impreso en la etiqueta.
// - Las guías ya emitidas se actualizan: la línea del bulto unificado queda con el conteo
//   real y desaparecen las líneas de los bultos que se unieron.
const text = (value: any) => String(value ?? '').trim();
const uniq = (list: any[]) => [...new Set(list.map(text).filter(Boolean))];
const isLocalId = (id: any) => !text(id) || text(id).startsWith('local_');

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const clientEmail = text(body.client_email);
    const total = Math.round(Number(body.total_bultos));

    if (!clientEmail) return Response.json({ error: 'Falta el cliente' }, { status: 400 });
    if (!Number.isFinite(total) || total < 1) {
      return Response.json({ error: 'La cantidad de bultos debe ser 1 o más' }, { status: 400 });
    }

    const bultos: any[] = await base44.asServiceRole.entities.Bulto
      .filter({ client_email: clientEmail }, 'bulto_number', 500)
      .catch(() => []);
    if (!bultos.length) {
      return Response.json({ error: 'Ese cliente no tiene bultos registrados' }, { status: 404 });
    }

    // Orden estable: por número de bulto y, si empatan, por fecha de creación.
    const ordered = [...bultos].sort((a: any, b: any) => {
      const diff = (Number(a.bulto_number) || 0) - (Number(b.bulto_number) || 0);
      if (diff !== 0) return diff;
      return String(a.created_date || '').localeCompare(String(b.created_date || ''));
    });

    const actor = text(user.email) || 'Ajuste manual';
    const now = new Date().toISOString();
    const warnings: string[] = [];

    const keep = ordered.slice(0, Math.min(total, ordered.length));
    const extras = ordered.slice(keep.length);
    const counts: Record<string, number> = {};
    const removedCodes: string[] = [];
    const mergedLabels: string[] = [];

    let unified: any = null;
    if (extras.length) {
      const target = keep[keep.length - 1];
      const sources = [target, ...extras];

      const packageIds = uniq(
        sources.flatMap((b: any) => (b.package_ids || []).filter((id: any) => !isLocalId(id)))
      );
      const trackings = uniq(sources.flatMap((b: any) => b.package_trackings || []));
      const unregistered = uniq(sources.flatMap((b: any) => b.unregistered_codes || []))
        .filter((code) => !trackings.includes(code));
      const orderNumbers = uniq(sources.flatMap((b: any) => b.cbm_order_numbers || []));
      const packageTotal = sources.reduce(
        (sum: number, b: any) => sum + packageCountOfBulto(b),
        0
      );
      const cbmTotal = Number(
        sources.reduce((sum: number, b: any) => sum + (Number(b.cargo_cbm) || 0), 0).toFixed(4)
      );

      const absorbed = [
        ...(Array.isArray(target.absorbed_bultos) ? target.absorbed_bultos : []),
        ...extras.map((b: any) => ({
          label_code: text(b.label_code),
          bulto_number: Number(b.bulto_number) || 0,
          package_count: packageCountOfBulto(b),
          order_numbers: uniq(b.cbm_order_numbers || []),
          status: text(b.status),
          printed: (Number(b.print_count) || 0) > 0,
          trackings: uniq(b.package_trackings || []),
          absorbed_at: now,
          absorbed_by: actor,
        })),
      ];

      const patch: any = {
        package_ids: packageIds,
        package_trackings: [...trackings, ...unregistered],
        unregistered_codes: unregistered,
        cbm_order_numbers: orderNumbers,
        cargo_package_count: packageTotal,
        absorbed_bultos: absorbed,
        cargo_updated_by: actor,
        cargo_updated_date: now,
      };
      if (cbmTotal > 0) patch.cargo_cbm = cbmTotal;

      unified = await base44.asServiceRole.entities.Bulto.update(target.id, patch);

      for (const extra of extras) {
        try {
          await base44.asServiceRole.entities.Bulto.delete(extra.id);
          if (text(extra.label_code)) {
            removedCodes.push(text(extra.label_code));
            mergedLabels.push(text(extra.label_code));
          }
        } catch (error: any) {
          warnings.push(
            `No se pudo eliminar el bulto ${text(extra.label_code) || extra.id}: su contenido ya está en el Bulto ${Number(target.bulto_number) || ''}. Elimínalo para no dejarlo duplicado.`
          );
        }
      }

      counts[text(target.label_code)] = packageTotal;

      // El recibo de contabilidad del bulto unificado queda con su CBM y su conteo.
      await syncBultoToAccounting(base44, unified, {
        actor,
        previous_orders: uniq(extras.flatMap((b: any) => b.cbm_order_numbers || [])),
      }).catch(() => null);
    } else if (total > ordered.length) {
      warnings.push(
        `Solo hay ${ordered.length} bulto(s) registrado(s) para este cliente: se dejó el total en ${total} sin crear bultos nuevos.`
      );
    }

    // Total declarado del cliente en todos sus bultos. El N° de bulto NO se toca: sale del
    // código impreso en la etiqueta y debe seguir siendo válido.
    let updatedCount = 0;
    const updates = keep.map((bulto: any) => ({ id: bulto.id, total_bultos: total }));
    try {
      await base44.asServiceRole.entities.Bulto.bulkUpdate(updates);
      updatedCount = updates.length;
    } catch (_) {
      for (const item of updates) {
        try {
          await base44.asServiceRole.entities.Bulto.update(item.id, { total_bultos: total });
          updatedCount += 1;
        } catch (error: any) {
          warnings.push(`No se pudo corregir el total del bulto ${item.id}: ${error?.message || 'error'}`);
        }
      }
    }

    const guideSync = await syncGuidesAfterBultoChange(base44, {
      counts,
      removedCodes,
      actor,
    }).catch(() => ({ guides: 0 }));

    const saved = await base44.asServiceRole.entities.Bulto
      .filter({ client_email: clientEmail }, 'bulto_number', 500)
      .catch(() => keep);

    return Response.json({
      success: true,
      total,
      updated: updatedCount,
      merged: mergedLabels,
      warnings,
      guides_updated: guideSync?.guides || 0,
      bultos: saved,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || 'Error al ajustar los bultos' }, { status: 500 });
  }
}