// Combinar unidades en la mesa de empaque.
//
// El almacén abre varios bultos sueltos y cajas del mismo cliente y después los combina
// en una sola unidad nueva con su propio código: el contenido de las demás pasa a la
// nueva y las originales se eliminan, igual que cuando una caja absorbe bultos.
//
// La unidad combinada se arma en el dispositivo (offline-first) y al cerrarse envía en
// `combine_codes` las etiquetas de las unidades que se fusionaron. Aquí se recoge su
// contenido para dejarlo dentro de la unidad nueva y, solo cuando esa unidad ya existe,
// se eliminan las originales: si algo falla al crearla, las fuentes siguen registradas.
import { describeBultoForAbsorption } from "./bultoAbsorption.ts";

const text = (value: any) => String(value ?? "").trim();
const uniq = (list: any[]) => [...new Set(list.map(text).filter(Boolean))];
const isLocalId = (id: any) => !text(id) || text(id).startsWith("local_");

// Contenido a mover y unidades a eliminar. No borra nada: devuelve el plan.
export async function planCombinedSources(base44: any, options: any = {}) {
  const codes = uniq(options.codes || []);
  const clientEmail = text(options.clientEmail).toLowerCase();
  const excludeId = text(options.excludeId);
  const actor = text(options.actor) || "Mesa de empaque";
  const now = new Date().toISOString();

  const package_ids: string[] = [];
  const trackings: string[] = [];
  const unregistered_codes: string[] = [];
  const order_numbers: string[] = [];
  const absorbed: any[] = [];
  const deletable: any[] = [];
  const warnings: string[] = [];

  for (const code of codes) {
    const rows = await base44.asServiceRole.entities.Bulto
      .filter({ label_code: code }, "-created_date", 1)
      .catch(() => []);
    const source = rows?.[0] || null;
    // Nunca subió al servidor (o ya se fusionó antes): no hay nada que mover ni borrar.
    if (!source) continue;
    if (excludeId && source.id === excludeId) continue;
    if (clientEmail && text(source.client_email).toLowerCase() !== clientEmail) {
      warnings.push(`La unidad ${code} es de otro cliente: se conservó registrada.`);
      continue;
    }
    if (source.billed_invoice_id || text(source.status) === "despachado") {
      warnings.push(`La unidad ${code} ya está facturada o despachada: se conservó registrada.`);
      continue;
    }

    for (const id of source.package_ids || []) {
      const value = text(id);
      if (!isLocalId(value) && !package_ids.includes(value)) package_ids.push(value);
    }
    trackings.push(...(source.package_trackings || []));
    unregistered_codes.push(...(source.unregistered_codes || []));
    order_numbers.push(...(source.cbm_order_numbers || []));

    const detail = await describeBultoForAbsorption(base44, source);
    absorbed.push({ ...detail, absorbed_at: now, absorbed_by: actor });
    deletable.push(source);
  }

  return {
    package_ids,
    trackings: uniq(trackings),
    unregistered_codes: uniq(unregistered_codes),
    order_numbers: uniq(order_numbers),
    absorbed,
    deletable,
    warnings,
  };
}

// Elimina las unidades que se combinaron. Se llama solo después de que la unidad nueva
// quedó creada, porque su contenido ya vive dentro de ella.
export async function deleteCombinedSources(base44: any, sources: any[] = []) {
  let deleted = 0;
  const failed: string[] = [];
  for (const source of sources) {
    if (!source?.id) continue;
    try {
      await base44.asServiceRole.entities.Bulto.delete(source.id);
      deleted++;
    } catch (_) {
      failed.push(text(source.label_code) || source.id);
    }
  }
  return { deleted, failed };
}