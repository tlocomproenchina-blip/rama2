import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { syncBultoToAccounting } from '../../shared/veAccountingSync.ts';

// Actualiza un bulto existente. Recibe: { bulto_id, package_ids?, client_snapshot?, status? }
// - Valida que los package_ids sean del mismo cliente del bulto.
// - Valida que los paquetes no estén ya en otro bulto del mismo cliente.
// - Si cambian los package_ids, recalcula package_trackings cache.
// - Actualiza client_snapshot y status si vienen.
// No recalcula bulto_number (el número se mantiene estable; el total_bultos solo cambia con create/delete).
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const bultoId: string = body.bulto_id || '';
    if (!bultoId) return Response.json({ error: 'Falta bulto_id' }, { status: 400 });

    const bulto = await base44.asServiceRole.entities.Bulto.get(bultoId).catch(() => null);
    if (!bulto) return Response.json({ error: 'Bulto no encontrado' }, { status: 404 });

    const update: any = {};

    // --- Paquetes ---
    if (Array.isArray(body.package_ids)) {
      const packageIds: string[] = body.package_ids.filter(Boolean);

      // Solo se resuelven los paquetes que existen en el sistema. Los bultos
      // escaneados en el almacén pueden traer ids del escaneo offline
      // ('local_pkg_...') que no existen como Package: no deben impedir guardar.
      const pkgResults = await Promise.all(
        packageIds.map((id) => base44.asServiceRole.entities.Package.get(id).catch(() => null))
      );
      const pkgs = pkgResults.filter((p) => p) as any[];
      const resolvedIds: string[] = pkgs.map((p) => p.id);

      const clientEmail = bulto.client_email;
      const sameClient = pkgs.every((p) => p.client_email === clientEmail);
      if (!sameClient) return Response.json({ error: 'Todos los paquetes deben ser del mismo cliente del bulto' }, { status: 400 });

      // Validar que los paquetes no estén en OTRO bulto del mismo cliente
      const otherBultos = await base44.asServiceRole.entities.Bulto.filter(
        { client_email: clientEmail }, 'bulto_number', 500
      );
      const otherPackageIds = new Set<string>();
      for (const b of otherBultos) {
        if (b.id === bultoId) continue;
        for (const pid of b.package_ids || []) otherPackageIds.add(pid);
      }
      const conflict = resolvedIds.filter((id) => otherPackageIds.has(id));
      if (conflict.length) {
        return Response.json({ error: 'Algunos paquetes ya están en otro bulto del cliente' }, { status: 400 });
      }

      // Los códigos que ya no corresponden a un paquete del sistema se conservan
      // como 'sin registrar': siguen en el contenido del bulto y en su etiqueta.
      const resolvedTrackings: string[] = pkgs.map((p) => p.tracking_number || '').filter(Boolean);
      const resolvedTrackingsSet = new Set(resolvedTrackings);
      const keptCodes: string[] = (Array.isArray(bulto.package_trackings) ? bulto.package_trackings : [])
        .filter((c: string) => c && !resolvedTrackingsSet.has(c));
      const packageTrackings = [...resolvedTrackings, ...keptCodes];

      update.package_ids = resolvedIds;
      update.package_trackings = packageTrackings;
      update.unregistered_codes = packageTrackings.filter((c) => !resolvedTrackingsSet.has(c));
    }

    // --- Snapshot del cliente ---
    if (body.client_snapshot && typeof body.client_snapshot === 'object') {
      const cs = body.client_snapshot;
      const current = bulto.client_snapshot || {};
      update.client_snapshot = {
        full_name: cs.full_name ?? current.full_name ?? '',
        email: cs.email ?? current.email ?? bulto.client_email,
        cedula: cs.cedula ?? current.cedula ?? '',
        whatsapp: cs.whatsapp ?? current.whatsapp ?? '',
        address: cs.address ?? current.address ?? '',
        city: cs.city ?? current.city ?? '',
        state: cs.state ?? current.state ?? '',
        shipping_mark: cs.shipping_mark ?? current.shipping_mark ?? bulto.shipping_mark,
      };
    }

    // --- Estado ---
    if (body.status) {
      if (!['activo', 'en_almacen_ve', 'despachado'].includes(body.status)) {
        return Response.json({ error: 'Estado inválido' }, { status: 400 });
      }
      update.status = body.status;
    }

    // --- Números de orden manuales (override) ---
    if (Array.isArray(body.cbm_order_numbers)) {
      update.cbm_order_numbers = body.cbm_order_numbers.filter(Boolean);
    }

    // --- CBM oficial y conteo de paquetes (Carga en almacén) ---
    const cargoCbmProvided = body.cargo_cbm !== undefined && body.cargo_cbm !== null && body.cargo_cbm !== '';
    const cargoCountProvided = body.cargo_package_count !== undefined && body.cargo_package_count !== null && body.cargo_package_count !== '';
    let cargoCbm = 0;

    if (cargoCbmProvided) {
      cargoCbm = Number(String(body.cargo_cbm).replace(',', '.'));
      if (!Number.isFinite(cargoCbm) || cargoCbm < 0) {
        return Response.json({ error: 'El CBM debe ser un número igual o mayor a 0' }, { status: 400 });
      }
      update.cargo_cbm = cargoCbm;
    }

    if (cargoCountProvided) {
      const count = Math.round(Number(body.cargo_package_count));
      if (!Number.isFinite(count) || count < 1) {
        return Response.json({ error: 'La cantidad de paquetes debe ser 1 o más' }, { status: 400 });
      }
      update.cargo_package_count = count;
    }

    // --- Tarifa registrada del bulto (Carga en almacén) ---
    // El monto que llega es exactamente el que el admin vio en pantalla al guardar.
    const cargoRiskProvided = body.cargo_risk_category !== undefined && body.cargo_risk_category !== null && body.cargo_risk_category !== '';
    if (cargoRiskProvided) {
      const risk = String(body.cargo_risk_category);
      if (!['general', 'alto_riesgo'].includes(risk)) {
        return Response.json({ error: 'Tipo de carga inválido' }, { status: 400 });
      }
      update.cargo_risk_category = risk;
    }

    const cargoAmountProvided = body.cargo_amount !== undefined && body.cargo_amount !== null && body.cargo_amount !== '';
    if (cargoAmountProvided) {
      const amount = Number(String(body.cargo_amount).replace(',', '.'));
      if (!Number.isFinite(amount) || amount < 0) {
        return Response.json({ error: 'La tarifa registrada debe ser un número igual o mayor a 0' }, { status: 400 });
      }
      const rate = Number(String(body.cargo_rate_per_cbm ?? 0).replace(',', '.'));
      update.cargo_amount = Math.round(amount * 100) / 100;
      update.cargo_rate_per_cbm = Number.isFinite(rate) && rate > 0 ? Math.round(rate * 10000) / 10000 : 0;
      update.cargo_rate_kind = String(body.cargo_rate_kind || 'estandar') === 'especial' ? 'especial' : 'estandar';
    }

    if (cargoCbmProvided || cargoCountProvided || cargoAmountProvided || cargoRiskProvided) {
      update.cargo_updated_by = user.email;
      update.cargo_updated_date = new Date().toISOString();
    }

    const updated = await base44.asServiceRole.entities.Bulto.update(bultoId, update);

    // El CBM registrado es el CBM del bulto: se reparte en partes iguales entre sus
    // paquetes como volumen real (actual_cbm) para que sumen el CBM del bulto y el
    // resto del sistema (costos del proveedor, ganancia) use el mismo dato.
    let cbmAppliedTo = 0;
    if (cargoCbmProvided && cargoCbm > 0) {
      const packageIds: string[] = (bulto.package_ids || []).filter(Boolean);
      const pkgs = (await Promise.all(
        packageIds.map((id) => base44.asServiceRole.entities.Package.get(id).catch(() => null))
      )).filter((p) => p) as any[];

      if (pkgs.length > 0) {
        const per = Math.floor((cargoCbm / pkgs.length) * 1e6) / 1e6;
        for (let i = 0; i < pkgs.length; i++) {
          const value = i === pkgs.length - 1
            ? Math.round((cargoCbm - per * (pkgs.length - 1)) * 1e6) / 1e6
            : per;
          await base44.asServiceRole.entities.Package.update(pkgs[i].id, { actual_cbm: value });
        }
        cbmAppliedTo = pkgs.length;
      }
    }

    // El almacén de Venezuela es la fuente definitiva para facturar: lo que registra
    // o corrige (N° de orden, CBM y conteo de paquetes) se refleja en el recibo de
    // contabilidad, corrigiendo el recibo vinculado o creando uno si no existe.
    const ordersChanged = Array.isArray(body.cbm_order_numbers);
    let sync: any = null;
    if (ordersChanged || cargoCbmProvided || cargoCountProvided) {
      sync = await syncBultoToAccounting(base44, updated, {
        actor: user.email,
        previous_orders: ordersChanged ? (bulto.cbm_order_numbers || []) : [],
      }).catch(() => ({ action: 'skipped', warnings: [] }));
    }

    return Response.json({ bulto: updated, cbm_applied_to: cbmAppliedTo, sync });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}