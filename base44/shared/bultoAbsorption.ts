// Fusión de bultos (almacén de Venezuela).
//
// Cuando un paquete escaneado ya pertenece a otro bulto, ese bulto viejo se fusiona
// con el que se está registrando —paquetes, códigos sin registrar y N° de contenedor— y se
// elimina, para que el empleado no tenga que deshacer y rehacer el trabajo.
//
// Un solo motor, reutilizado por createBultoFromScan (bulto nuevo escaneado),
// updateBulto (edición del bulto desde el panel) y bultoScanLookup (confirmación en
// pantalla antes de mover el paquete).
//
// Reglas del almacén:
// - Nunca bloquea: la fusión se decide en el servidor, no depende de un flag del cliente.
// - El borrado NO renumera ni regenera label_code de los bultos restantes: las etiquetas ya
//   impresas deben seguir siendo válidas. Solo se recuadra total_bultos del cliente.
// - No se toca la contabilidad desde aquí: los N° de contenedor fusionados se envían como
//   previous_orders al sincronizar, para corregir el recibo vinculado y no duplicarlo.
// - Un bulto de otro cliente (dato inconsistente) NO se elimina: se conserva registrado y
//   solo se le quita el paquete y el tracking movidos, para que un mismo paquete no quede
//   dentro de dos bultos. Se avisa en pantalla.
import { num } from "./paginatedFetch.ts";
import { syncClientBultoTotals } from "./bultoScan.ts";
import { bultoPackageCount } from "./veAccountingSync.ts";

const text = (v: any) => String(v ?? "").trim();
const uniq = (list: any[]) => [...new Set(list.map(text).filter(Boolean))];
const isLocalId = (id: any) => !text(id) || text(id).startsWith("local_");

// Señales de uso del bulto viejo que se muestran en la confirmación en pantalla:
// etiqueta, contenido, N° de contenedor, estado, si fue impreso, si está en una guía de
// despacho y si ya está facturado.
export async function describeBultoForAbsorption(base44: any, bulto: any) {
  const label = text(bulto?.label_code);

  let invoice: any = null;
  if (text(bulto?.billed_invoice_id)) {
    invoice = await base44.asServiceRole.entities.Invoice
      .get(bulto.billed_invoice_id)
      .catch(() => null);
  }

  let guides: any[] = [];
  if (label) {
    const rows = await base44.asServiceRole.entities.DispatchGuide
      .filter({ bulto_codes: label }, "-emitted_date", 5)
      .catch(() => []);
    guides = (rows || []).map((g: any) => ({
      guide_number: text(g.guide_number),
      dispatch_status: text(g.dispatch_status),
    }));
  }

  return {
    id: bulto?.id || "",
    label_code: label,
    client_email: text(bulto?.client_email),
    bulto_number: num(bulto?.bulto_number),
    package_count: bultoPackageCount(bulto),
    order_numbers: uniq(bulto?.cbm_order_numbers || []),
    status: text(bulto?.status),
    printed: num(bulto?.print_count) > 0,
    dispatched: text(bulto?.status) === "despachado",
    invoice_number: text(invoice?.invoice_number),
    invoice_status: text(invoice?.status),
    guide_numbers: uniq(guides.map((g: any) => g.guide_number)),
  };
}

// Bultos que ya contienen alguno de los paquetes indicados (el bulto destino no se
// absorbe a sí mismo).
export async function findAbsorbSources(base44: any, packageIds: string[], excludeBultoId = "") {
  const ids = uniq(packageIds).filter((id) => !isLocalId(id));
  const sources: any[] = [];
  for (const id of ids) {
    const rows = await base44.asServiceRole.entities.Bulto
      .filter({ package_ids: id }, "-created_date", 5)
      .catch(() => []);
    for (const b of rows || []) {
      if (!b?.id || b.id === excludeBultoId) continue;
      if (sources.some((s) => s.id === b.id)) continue;
      sources.push(b);
    }
  }
  return sources;
}

// Constancia que queda en el bulto nuevo de lo que se fusionó.
async function buildAbsorptionEntry(base44: any, source: any, now: string, actor: string) {
  const detail = await describeBultoForAbsorption(base44, source);
  return {
    label_code: detail.label_code,
    bulto_number: detail.bulto_number,
    package_count: detail.package_count,
    order_numbers: detail.order_numbers,
    status: detail.status,
    printed: detail.printed,
    invoice_number: detail.invoice_number,
    invoice_status: detail.invoice_status,
    guide_numbers: detail.guide_numbers,
    trackings: uniq(source?.package_trackings || []),
    absorbed_at: now,
    absorbed_by: actor,
  };
}

// Plan de fusión: qué bultos se fusionan, qué paquetes, trackings, códigos sin
// registrar y N° de contenedor entran al bulto nuevo, y los avisos para la pantalla.
// options: { packageIds, excludeBultoId, clientEmail, unregisteredCodes, actor }
export async function planAbsorption(base44: any, options: any = {}) {
  const actor = text(options.actor) || "Almacén Venezuela";
  const clientEmail = text(options.clientEmail);
  const requested = uniq(options.packageIds || []).filter((id) => !isLocalId(id));
  const sources = await findAbsorbSources(base44, requested, text(options.excludeBultoId));

  const now = new Date().toISOString();
  const warnings: string[] = [];
  const absorbed: any[] = [];
  const deletable_ids: string[] = [];
  // Bultos de otro cliente: se conservan y solo se les quita el contenido movido.
  const strippable_ids: string[] = [];
  const extraIds: string[] = [];
  const unregistered = uniq(options.unregisteredCodes || []);
  const orderNumbers: string[] = [];
  const sourceCacheCodes: string[] = [];

  for (const source of sources) {
    const sameClient =
      !clientEmail || text(source.client_email).toLowerCase() === clientEmail.toLowerCase();

    for (const id of source.package_ids || []) {
      const value = text(id);
      if (isLocalId(value)) continue;
      if (!extraIds.includes(value)) extraIds.push(value);
    }

    unregistered.push(...(source.unregistered_codes || []));
    sourceCacheCodes.push(...(source.package_trackings || []));
    orderNumbers.push(...(source.cbm_order_numbers || []));
    absorbed.push(await buildAbsorptionEntry(base44, source, now, actor));

    if (sameClient) {
      deletable_ids.push(source.id);
    } else {
      strippable_ids.push(source.id);
      warnings.push(
        `El bulto ${text(source.label_code) || source.id} no pertenece a este cliente: se dejó registrado y solo se le quitó el paquete movido.`
      );
    }
  }

  // Trackings reales de todo lo que queda dentro del bulto nuevo (escaneado + absorbido).
  const allIds = uniq([...requested, ...extraIds]);
  const pkgs = (await Promise.all(
    allIds.map((id: string) => base44.asServiceRole.entities.Package.get(id).catch(() => null))
  )).filter((p: any) => p) as any[];
  const trackings = uniq(pkgs.map((p) => p.tracking_number));

  // Códigos que viajaban en el bulto viejo sin paquete en el sistema (escaneo offline):
  // cuentan como "sin registrar" para que el contenido del bulto no pierda paquetes.
  const unresolved = uniq(sourceCacheCodes).filter((c) => !trackings.includes(c));
  const unregisteredFinal = uniq([...unregistered, ...unresolved]).filter(
    (c) => !trackings.includes(c)
  );

  return {
    package_ids: allIds,
    trackings,
    unregistered_codes: unregisteredFinal,
    order_numbers: uniq(orderNumbers),
    sources,
    deletable_ids,
    strippable_ids,
    absorbed,
    warnings,
    packages_moved: extraIds.length,
  };
}

// Cierra la fusión. Del mismo cliente: el bulto viejo se elimina (su contenido ya quedó
// dentro del bulto escaneado). De otro cliente: se conserva y solo se le quitan el paquete,
// el tracking y los códigos movidos, con su conteo de paquetes recalculado. No renumera ni
// renombra nada: las etiquetas ya impresas siguen siendo válidas. Si uno falla, el resto sigue.
export async function applyAbsorption(base44: any, plan: any) {
  const deleted: any[] = [];
  const stripped: any[] = [];
  const failed: any[] = [];
  const warnings: string[] = [...(plan?.warnings || [])];

  const movedIds = new Set((plan?.package_ids || []).map(text).filter(Boolean));
  const movedCodes = new Set(
    [...(plan?.trackings || []), ...(plan?.unregistered_codes || [])].map(text).filter(Boolean)
  );

  for (const source of plan?.sources || []) {
    if ((plan?.deletable_ids || []).includes(source.id)) {
      try {
        await base44.asServiceRole.entities.Bulto.delete(source.id);
        deleted.push({ id: source.id, label_code: text(source.label_code) });
      } catch (e: any) {
        failed.push({
          id: source.id,
          label_code: text(source.label_code),
          error: e?.message || "Error al eliminar",
        });
        warnings.push(
          `No se pudo eliminar el bulto ${text(source.label_code) || source.id}: sus paquetes ya están en el bulto nuevo, pero el bulto viejo sigue registrado. Elimínalo para no dejarlo duplicado.`
        );
      }
      continue;
    }

    if (!(plan?.strippable_ids || []).includes(source.id)) continue;

    try {
      const remainingIds = (source.package_ids || []).filter((id: any) => !movedIds.has(text(id)));
      const remainingTrackings = (source.package_trackings || []).filter((c: any) => !movedCodes.has(text(c)));
      const remainingUnregistered = (source.unregistered_codes || []).filter((c: any) => !movedCodes.has(text(c)));
      const removed =
        ((source.package_ids || []).length - remainingIds.length) +
        ((source.unregistered_codes || []).length - remainingUnregistered.length);

      const patch: any = {
        package_ids: remainingIds,
        package_trackings: remainingTrackings,
        unregistered_codes: remainingUnregistered,
      };
      const cargoCount = num(source.cargo_package_count);
      if (cargoCount > 0 && removed > 0) patch.cargo_package_count = Math.max(0, cargoCount - removed);

      await base44.asServiceRole.entities.Bulto.update(source.id, patch);
      stripped.push({
        id: source.id,
        label_code: text(source.label_code),
        packages_removed: removed,
      });
    } catch (e: any) {
      failed.push({
        id: source.id,
        label_code: text(source.label_code),
        error: e?.message || "Error al quitar el paquete",
      });
      warnings.push(
        `No se pudo quitar el paquete del bulto ${text(source.label_code) || source.id}: el paquete quedó dentro de los dos bultos. Revísalo.`
      );
    }
  }

  return { deleted, stripped, failed, warnings };
}

// Recuadra el total de bultos del cliente con la cantidad real que queda.
export async function recountClientBultos(base44: any, clientEmail: string) {
  const email = text(clientEmail);
  if (!email) return 0;
  const bultos = await base44.asServiceRole.entities.Bulto
    .filter({ client_email: email }, "bulto_number", 500)
    .catch(() => []);
  if (!bultos?.length) return 0;
  await syncClientBultoTotals(base44, email, bultos.length, bultos);
  return bultos.length;
}

// Marca los paquetes como reconocidos en Venezuela sin pisar la fecha que ya tenían
// (los paquetes que llegan desde un bulto absorbido conservan su reconocimiento).
export async function markPackagesRecognizedIfMissing(
  base44: any,
  packageIds: string[],
  now: string,
  assignedBy: string
) {
  const ids = uniq(packageIds).filter((id) => !isLocalId(id));
  if (!ids.length) return 0;

  const pkgs = (await Promise.all(
    ids.map((id: string) => base44.asServiceRole.entities.Package.get(id).catch(() => null))
  )).filter((p: any) => p) as any[];

  const pending = pkgs
    .filter((p) => !p.ve_recognized_date)
    .map((p) => ({ id: p.id, ve_recognized_date: now, ve_recognized_by: assignedBy }));

  if (!pending.length) return 0;

  try {
    await base44.asServiceRole.entities.Package.bulkUpdate(pending);
    return pending.length;
  } catch (_) {
    let done = 0;
    for (const item of pending) {
      try {
        await base44.asServiceRole.entities.Package.update(item.id, {
          ve_recognized_date: item.ve_recognized_date,
          ve_recognized_by: item.ve_recognized_by,
        });
        done++;
      } catch (_) {}
    }
    return done;
  }
}