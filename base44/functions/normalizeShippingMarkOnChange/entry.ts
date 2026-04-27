import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Trigger automation: normaliza el shipping_mark al crear/actualizar User o Package.
// Convierte N2TLECW1825S → N2-TLEC-W1825S automáticamente, evitando datos inconsistentes.

const BAD_REGEX = /^(N\d+)TLEC([A-Z0-9]+)$/i;
const GOOD_REGEX = /^N\d+-TLEC-[A-Z0-9]+$/i;

function fixMark(mark) {
  if (!mark) return null;
  const clean = String(mark).trim().toUpperCase();
  if (GOOD_REGEX.test(clean)) return null; // ya está OK, no hacer nada
  const m = clean.match(BAD_REGEX);
  if (!m) return null;
  return `${m[1]}-TLEC-${m[2]}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sb = base44.asServiceRole;

    const payload = await req.json().catch(() => ({}));
    const { event, data } = payload || {};
    if (!event || !data) {
      return Response.json({ skipped: true, reason: 'no event/data' });
    }

    const entityName = event.entity_name;
    const entityId = event.entity_id;
    const currentMark = data.shipping_mark;
    const fixed = fixMark(currentMark);

    if (!fixed) {
      return Response.json({ skipped: true, reason: 'no fix needed', current: currentMark });
    }

    // Actualizar la entidad correspondiente
    if (entityName === 'User') {
      await sb.entities.User.update(entityId, { shipping_mark: fixed });
    } else if (entityName === 'Package') {
      await sb.entities.Package.update(entityId, { shipping_mark: fixed });
    } else if (entityName === 'CbmIngreso') {
      await sb.entities.CbmIngreso.update(entityId, { shipping_mark: fixed });
    } else {
      return Response.json({ skipped: true, reason: 'unsupported entity', entityName });
    }

    return Response.json({
      success: true,
      entity: entityName,
      id: entityId,
      old: currentMark,
      new: fixed
    });
  } catch (error) {
    console.error('normalizeShippingMarkOnChange error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});