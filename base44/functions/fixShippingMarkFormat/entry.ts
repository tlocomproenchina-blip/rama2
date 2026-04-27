import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Corrige shipping marks con formato sin guiones (ej. N2TLECW1825S)
// al formato correcto (N2-TLEC-W1825S) en User, Package y CbmIngreso.
// Solo invocable por admin.

const BAD_REGEX = /^N2TLEC([A-Z0-9]+)$/i;

function fixMark(mark) {
  if (!mark) return null;
  const m = String(mark).trim().toUpperCase().match(BAD_REGEX);
  if (!m) return null;
  return `N2-TLEC-${m[1]}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = base44.asServiceRole;
    const dryRun = (await req.json().catch(() => ({})))?.dry_run === true;

    // 1) Usuarios con formato malo
    const users = await sb.entities.User.filter({ shipping_mark: { $regex: '^N2TLEC' } }, '-updated_date', 1000);
    const userResults = [];

    for (const u of users) {
      const oldMark = u.shipping_mark;
      const newMark = fixMark(oldMark);
      if (!newMark || newMark === oldMark) continue;

      // Actualizar paquetes que usen el shipping mark viejo
      const pkgs = await sb.entities.Package.filter({ shipping_mark: oldMark }, '-updated_date', 1000);
      // Actualizar CBM ingresos que usen el shipping mark viejo
      let cbmRows = [];
      try {
        cbmRows = await sb.entities.CbmIngreso.filter({ shipping_mark: oldMark }, '-updated_date', 1000);
      } catch {}

      if (!dryRun) {
        await sb.entities.User.update(u.id, { shipping_mark: newMark });
        for (const p of pkgs) {
          await sb.entities.Package.update(p.id, { shipping_mark: newMark });
        }
        for (const c of cbmRows) {
          await sb.entities.CbmIngreso.update(c.id, { shipping_mark: newMark });
        }
      }

      userResults.push({
        email: u.email,
        old: oldMark,
        new: newMark,
        packages_updated: pkgs.length,
        cbm_updated: cbmRows.length
      });
    }

    // 2) Pool de códigos con formato malo (por si quedan)
    const poolBad = await sb.entities.ShippingMarkCode.filter({ code: { $regex: '^N2TLEC' } }, '-updated_date', 5000);
    const poolFixed = [];
    for (const code of poolBad) {
      const newCode = fixMark(code.code);
      if (!newCode || newCode === code.code) continue;
      if (!dryRun) {
        await sb.entities.ShippingMarkCode.update(code.id, { code: newCode });
      }
      poolFixed.push({ id: code.id, old: code.code, new: newCode });
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      users_fixed: userResults.length,
      pool_codes_fixed: poolFixed.length,
      details: userResults,
      pool_details: poolFixed
    });
  } catch (error) {
    console.error('fixShippingMarkFormat error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});