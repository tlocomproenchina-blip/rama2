import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  buildTrackingCandidates,
  consolidateOrphan,
  findSameShipmentMatches,
} from '../../shared/orphanConsolidation.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Solo admin puede asignar huérfanos manualmente
    const isWarehouse = user.role === 'admin' || user.custom_role === 'almacen' || user.custom_role === 'operaciones';
    if (!isWarehouse) {
      return Response.json({ error: 'Forbidden: se requiere rol de almacén o admin' }, { status: 403 });
    }

    const body = await req.json();
    const packageId = String(body.package_id || '').trim();
    const clientEmail = String(body.client_email || '').trim();
    if (!packageId) return Response.json({ error: 'ID de paquete requerido' }, { status: 400 });
    if (!clientEmail) return Response.json({ error: 'Email del cliente requerido' }, { status: 400 });

    // Cargar el paquete huérfano
    const pkgs = await base44.asServiceRole.entities.Package.filter({ id: packageId }, '-created_date', 1);
    const pkg = pkgs?.[0];
    if (!pkg) return Response.json({ error: 'Paquete no encontrado' }, { status: 404 });
    if (!pkg.is_orphan) return Response.json({ error: 'Este paquete no es un huérfano' }, { status: 400 });

    // Resolver shipping_mark del cliente si no se provee
    let shippingMark = body.shipping_mark ? String(body.shipping_mark).trim() : null;
    if (!shippingMark) {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ email: clientEmail }, '-created_date', 1);
        shippingMark = users?.[0]?.shipping_mark || null;
      } catch (_) {}
    }

    // Sin duplicar: si ese cliente ya tiene una pre-alerta pendiente del mismo envío,
    // se unifica con este huérfano en un solo paquete (se conserva el registro
    // recibido, con su foto y sus datos de almacén) y la pre-alerta se retira.
    const candidates = buildTrackingCandidates(String(pkg.tracking_number || ''));
    if (candidates.length > 0) {
      const matches = await findSameShipmentMatches(base44, { candidates, excludeId: pkg.id });
      const clientPending = matches.pending.filter(
        (p) => String(p.client_email || '').trim().toLowerCase() === clientEmail.toLowerCase(),
      );
      if (clientPending.length > 0) {
        const unification = await consolidateOrphan({ base44, orphan: pkg, prealert: clientPending[0], shippingMark });
        return Response.json({
          package: unification.package,
          consolidated: true,
          merged_fields: unification.merged_fields,
          unified_prealert_id: clientPending[0].id,
        });
      }
      // Ese tracking ya está registrado como carga recibida: se avisa para revisión y
      // el huérfano queda sin asignar.
      if (matches.received.length > 0) {
        const other = matches.received[0];
        return Response.json({
          error: `Ese tracking ya figura recibido${other.client_email ? ` para ${other.client_email}` : ''}. Revisa el duplicado antes de asignarlo.`,
          conflict: true,
          matched_package_id: other.id,
        }, { status: 409 });
      }
    }

    // Si el huérfano ya tiene ubicación física/dimensiones, conservar estado "recibido".
    // Si no, pasa a "pre_alerta" como una pre-alerta normal.
    const wasReceived = !!(pkg.warehouse_location_id || pkg.actual_weight_kg || pkg.received_date);
    const nextStatus = wasReceived ? 'recibido' : 'pre_alerta';

    const updated = await base44.asServiceRole.entities.Package.update(packageId, {
      client_email: clientEmail,
      shipping_mark: shippingMark || '',
      is_orphan: false,
      status: nextStatus,
      shipping_type: body.shipping_type ? (body.shipping_type === 'maritimo' ? 'maritimo' : 'aereo') : pkg.shipping_type || 'aereo',
      risk_category: body.risk_category ? (body.risk_category === 'alto_riesgo' ? 'alto_riesgo' : 'general') : pkg.risk_category || 'general',
      description: body.description ? String(body.description) : 'Pre-alerta rápida',
      reported: true,
    });

    return Response.json({ package: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});