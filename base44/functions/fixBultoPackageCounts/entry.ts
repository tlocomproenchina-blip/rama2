import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { dedupeUnitContents, isUnitLabel } from '../../shared/unitDedupe.ts';
import { syncGuidesAfterBultoChange } from '../../shared/bultoCountSync.ts';

// Corrige el conteo de paquetes de las cajas y bultos ya registrados cuando está inflado
// por duplicados.
//
// - Quita repetidos del contenido (mismo tracking, mismo paquete, mismo código escrito
//   con otras mayúsculas) y las etiquetas de unidades ya fusionadas.
// - Un código "sin registrar" que es el tracking o la etiqueta de un paquete registrado
//   dentro de la misma unidad deja de contarse dos veces.
// - Ajusta cargo_package_count solo cuando la diferencia se explica por esos duplicados;
//   un conteo manual mayor a todo el contenido guardado no se toca y se reporta.
// - Las guías de despacho ya emitidas reciben el conteo corregido.
// - Un tracking que figura en dos unidades distintas no se mueve: se reporta para revisar.

const text = (v: any) => String(v ?? '').trim();
const up = (v: any) => text(v).toUpperCase();
const validIds = (ids: any) => (Array.isArray(ids) ? ids : []).filter((id: any) => id && !String(id).startsWith('local_'));
const rawCodes = (list: any) => (Array.isArray(list) ? list : []).map(text).filter((c: string) => c && !isUnitLabel(c));

// Mismos criterios que el conteo usado hasta ahora (caja: solo paquetes registrados).
const countOf = (unit: any, ids: any[], unregistered: any[]) =>
  validIds(ids).length + (unit?.is_caja ? 0 : unregistered.length);

async function listAllBultos(base44: any) {
  const all: any[] = [];
  let cursor: string | undefined;
  while (true) {
    const page: any = await base44.asServiceRole.entities.Bulto
      .list({ sort: 'created_date', limit: 500, ...(cursor ? { cursor } : {}) });
    all.push(...(page?.items || []));
    if (!page?.has_more || !page?.next_cursor) break;
    cursor = page.next_cursor;
  }
  return all.filter((b) => b.status !== 'desarmado');
}

// Paquetes cuyos tracking o etiqueta coinciden con códigos "sin registrar".
async function packagesByCodes(base44: any, codes: string[]) {
  const map = new Map<string, string>();
  const list = [...new Set(codes)];
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    const rows: any[] = await base44.asServiceRole.entities.Package
      .filter({ $or: [{ tracking_number: { $in: chunk } }, { label_code: { $in: chunk } }] }, '-created_date', 500)
      .catch(() => []);
    for (const p of rows || []) {
      if (p.tracking_number) map.set(up(p.tracking_number), p.id);
      if (p.label_code) map.set(up(p.label_code), p.id);
    }
  }
  return map;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const bultos = await listAllBultos(base44);
    const pkgByCode = await packagesByCodes(
      base44,
      bultos.flatMap((b) => rawCodes(b.unregistered_codes))
    );

    const changes: any[] = [];
    const counts: Record<string, number> = {};
    const omitidos: any[] = [];
    let duplicadosQuitados = 0;
    const owners = new Map<string, Set<string>>();

    for (const bulto of bultos) {
      const ids = new Set(validIds(bulto.package_ids));
      const registeredHere = rawCodes(bulto.unregistered_codes)
        .filter((c: string) => ids.has(pkgByCode.get(up(c)) || ''));
      const clean = dedupeUnitContents(bulto, registeredHere);

      const rawUnregistered = rawCodes(bulto.unregistered_codes);
      const before = countOf(bulto, bulto.package_ids || [], rawUnregistered);
      const after = countOf(bulto, clean.package_ids, clean.unregistered_codes);
      duplicadosQuitados += Math.max(0, before - after);

      const patch: any = {};
      if (clean.package_ids.length !== (bulto.package_ids || []).length) patch.package_ids = clean.package_ids;
      if (clean.package_trackings.length !== (bulto.package_trackings || []).length) patch.package_trackings = clean.package_trackings;
      if (clean.unregistered_codes.length !== (bulto.unregistered_codes || []).length) patch.unregistered_codes = clean.unregistered_codes;

      const cargo = Number(bulto.cargo_package_count);
      if (Number.isFinite(cargo) && cargo > after) {
        if (cargo <= before) {
          patch.cargo_package_count = after;
        } else {
          omitidos.push({ label_code: bulto.label_code, motivo: `Conteo manual ${cargo} mayor al contenido guardado (${after})` });
        }
      }

      if (Object.keys(patch).length) {
        changes.push({ id: bulto.id, ...patch });
        const dispatchCount = Number(patch.cargo_package_count ?? cargo) > 0
          ? Number(patch.cargo_package_count ?? cargo)
          : after;
        if (bulto.label_code) counts[bulto.label_code] = dispatchCount;
      }

      // Para reportar trackings repetidos entre unidades distintas.
      for (const code of [...clean.package_trackings, ...clean.unregistered_codes]) {
        const key = up(code);
        if (!owners.has(key)) owners.set(key, new Set());
        owners.get(key)!.add(text(bulto.label_code));
      }
    }

    for (let i = 0; i < changes.length; i += 500) {
      await base44.asServiceRole.entities.Bulto.bulkUpdate(changes.slice(i, i + 500));
    }

    const guides = Object.keys(counts).length
      ? await syncGuidesAfterBultoChange(base44, { counts, actor: user.email })
      : { guides: 0 };

    const cruzados = [...owners.entries()]
      .filter(([, labels]) => labels.size > 1)
      .map(([code, labels]) => ({ code, labels: [...labels] }));

    return Response.json({
      success: true,
      revisados: bultos.length,
      corregidos: changes.length,
      duplicados_quitados: duplicadosQuitados,
      guias_actualizadas: guides.guides,
      omitidos: omitidos.length,
      omitidos_detalle: omitidos.slice(0, 50),
      cruzados: cruzados.length,
      cruzados_detalle: cruzados.slice(0, 50),
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}