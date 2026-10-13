import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  buildTrackingCandidates,
  findSameShipmentMatches,
  hasReceptionEvidence,
  pickClientRecordToKeep,
  unifyOrphanIntoClientRecord,
} from '../../shared/orphanConsolidation.ts';
import { confirmReceptionToWholesaler, noticeDeliveredWithPhoto, setOrphanFollowup } from '../../shared/wholesalerNotify.ts';

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
    // Un huérfano ya asignado que sigue en seguimiento (le falta la recepción o el
    // aviso al mayorista con foto) se puede volver a asignar: así se reintenta.
    if (!pkg.is_orphan && pkg.orphan_pending_reception !== true) {
      return Response.json({ error: 'Este paquete no es un huérfano' }, { status: 400 });
    }

    // Resolver shipping_mark del cliente si no se provee
    let shippingMark = body.shipping_mark ? String(body.shipping_mark).trim() : null;
    if (!shippingMark) {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ email: clientEmail }, '-created_date', 1);
        shippingMark = users?.[0]?.shipping_mark || null;
      } catch (_) {}
    }

    // Sin duplicar: si ese cliente ya tenía registrado el mismo envío (su pre-alerta),
    // ese registro es el que se actualiza —con su foto y sus datos— y la carga sin
    // titular se une ahí: queda recibida, con la foto de la recepción del almacén y
    // sin dejar un segundo paquete del mismo envío.
    const candidates = buildTrackingCandidates(String(pkg.tracking_number || ''));
    if (candidates.length > 0) {
      const matches = await findSameShipmentMatches(base44, {
        candidates,
        labelCode: String(pkg.tracking_number || ''),
        excludeId: pkg.id,
      });
      const clientRecords = [...matches.pending, ...matches.received].filter(
        (p) => String(p.client_email || '').trim().toLowerCase() === clientEmail.toLowerCase(),
      );
      if (clientRecords.length > 0) {
        // Manda el registro propio del cliente: su pre-alerta (donde declaró la carga)
        // y, si ya no hay pendiente, el que trae su descripción o su foto.
        const target = pickClientRecordToKeep(clientRecords) || clientRecords[0];
        const unification = await unifyOrphanIntoClientRecord({
          base44,
          orphan: pkg,
          clientRecord: target,
          shippingMark,
          by: user.email,
        });
        if (unification) {
          const merged = unification.package;
          const aviso = await confirmReceptionToWholesaler(base44, merged, `asignado a ${clientEmail}`);
          await setOrphanFollowup(base44, merged.id, false);
          return Response.json({
            package: { ...merged, orphan_pending_reception: false },
            consolidated: true,
            merged_fields: unification.merged_fields,
            updated_client_record_id: target.id,
            removed_orphan_id: unification.removed_orphan_id,
            aviso_mayorista: aviso,
            sigue_en_huerfanos: false,
          });
        }
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

    // La carga ya pasó por el almacén (la escaneó o la fotografió TLEC CARGO): se
    // conserva recibida y se le completa la fecha de recepción que le falte. Una
    // pre-alerta sin evidencia de almacén sigue quedando como pre-alerta.
    const wasReceived = hasReceptionEvidence(pkg);
    const nextStatus = wasReceived ? 'recibido' : 'pre_alerta';

    const updated = await base44.asServiceRole.entities.Package.update(packageId, {
      client_email: clientEmail,
      shipping_mark: shippingMark || pkg.shipping_mark || '',
      is_orphan: false,
      status: nextStatus,
      ...(wasReceived && !pkg.received_date
        ? { received_date: new Date().toISOString(), received_by: pkg.received_by || user.email }
        : {}),
      shipping_type: body.shipping_type ? (body.shipping_type === 'maritimo' ? 'maritimo' : 'aereo') : pkg.shipping_type || 'aereo',
      risk_category: body.risk_category ? (body.risk_category === 'alto_riesgo' ? 'alto_riesgo' : 'general') : pkg.risk_category || 'general',
      description: body.description ? String(body.description) : 'Pre-alerta rápida',
      reported: true,
      // La carga asignada sigue en la lista de huérfanos hasta que se cumplan las
      // dos condiciones: constar recibida y con su foto enviada al mayorista.
      orphan_pending_reception: true,
    });

    // Si la carga viene del mayorista, su aviso de recepción queda listo para
    // mandarle la confirmación con la foto del almacén, ahora que ya tiene cliente.
    const aviso = await confirmReceptionToWholesaler(base44, updated, `asignado a ${clientEmail}`);

    // Solo sale de la lista de huérfanos si ya consta recibida en el almacén y su
    // foto de recepción salió al mayorista; si falta algo, queda en seguimiento.
    const sigueEnLista = !(wasReceived && noticeDeliveredWithPhoto(aviso));
    if (!sigueEnLista) await setOrphanFollowup(base44, packageId, false);

    return Response.json({
      package: { ...updated, orphan_pending_reception: sigueEnLista },
      recibido: wasReceived,
      aviso_mayorista: aviso,
      sigue_en_huerfanos: sigueEnLista,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});