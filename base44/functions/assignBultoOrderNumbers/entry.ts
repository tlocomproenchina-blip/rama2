import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Asigna el/los N° de orden CbmIngreso a un bulto desde la pantalla de escaneo
// (/BultoOrderScan), que se comparte como enlace directo de trabajo y abre sin sesión.
// Recibe: { bulto_id, cbm_order_numbers: string[], device_id?: string }
// - Con sesión: solo administradores/empleados (regla anterior intacta).
// - Sin sesión: se exige device_id y se registra el dispositivo en lugar del correo.
// - Guarda cbm_order_numbers, marca order_locked=true (sin cambiar el status) y
//   registra quién lo asignó (order_assigned_by, order_assigned_date).
// - Si el bulto ya tiene order_locked=true, rechaza la edición.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    let sessionUser: any = null;
    try {
      sessionUser = await base44.auth.me();
    } catch (_) {
      sessionUser = null;
    }
    if (sessionUser && sessionUser.role !== 'admin') {
      return Response.json({ error: 'Solo administradores o empleados' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const bultoId: string = String(body.bulto_id || '').trim();
    if (!bultoId) return Response.json({ error: 'Falta bulto_id' }, { status: 400 });

    const deviceId = String(body.device_id || '').trim();
    if (!sessionUser && !deviceId) {
      return Response.json({ error: 'device_id requerido' }, { status: 400 });
    }
    const assignedBy = sessionUser?.email || `Dispositivo ${deviceId.slice(0, 8).toUpperCase()}`;

    const rawOrders = Array.isArray(body.cbm_order_numbers) ? body.cbm_order_numbers : [];
    const orderNumbers = rawOrders
      .map((s: any) => String(s || '').trim())
      .filter(Boolean);
    if (!orderNumbers.length) {
      return Response.json({ error: 'Debe ingresar al menos un N° de orden' }, { status: 400 });
    }

    // Foto del bulto capturada automáticamente por el escáner en el momento de leer
    // la etiqueta: queda como evidencia del reconocimiento en el almacén de Venezuela.
    const recognitionPhotoUrl = String(body.recognition_photo_url || '').trim();

    const bulto = await base44.asServiceRole.entities.Bulto.get(bultoId).catch(() => null);
    if (!bulto) return Response.json({ error: 'Bulto no encontrado' }, { status: 404 });

    // Si ya está bloqueado, rechazar. Solo admin puede desbloquear desde BultoEditModal.
    if (bulto.order_locked) {
      return Response.json(
        { error: 'Este bulto ya tiene el N° de orden asignado y está bloqueado. Solicita a un admin que lo desbloquee si necesitas corregirlo.' },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    // Primera vez que se reconoce este bulto en el almacén de Venezuela:
    // queda marcado con fecha y responsable (no cambia el status del bulto).
    const firstRecognition = !bulto.ve_recognized_date;
    const updated = await base44.asServiceRole.entities.Bulto.update(bultoId, {
      cbm_order_numbers: orderNumbers,
      order_locked: true,
      order_assigned_by: assignedBy,
      order_assigned_date: now,
      ...(recognitionPhotoUrl ? { recognition_photo_url: recognitionPhotoUrl } : {}),
      ...(firstRecognition ? { ve_recognized_date: now, ve_recognized_by: assignedBy } : {}),
    });

    // Los paquetes del bulto quedan reconocidos en Venezuela: salen del resumen
    // diario de recepción de China y entran al aviso de carga en Venezuela.
    if (firstRecognition) {
      const packageIds = (Array.isArray(bulto.package_ids) ? bulto.package_ids : [])
        .filter((id: any) => id && !String(id).startsWith('local_'));
      if (packageIds.length) {
        try {
          await base44.asServiceRole.entities.Package.bulkUpdate(
            packageIds.map((id: string) => ({ id, ve_recognized_date: now, ve_recognized_by: assignedBy }))
          );
        } catch (_) {
          for (const id of packageIds) {
            try {
              await base44.asServiceRole.entities.Package.update(id, { ve_recognized_date: now, ve_recognized_by: assignedBy });
            } catch (_) {}
          }
        }
      }
    }

    return Response.json({ bulto: updated, ve_recognized: firstRecognition });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}