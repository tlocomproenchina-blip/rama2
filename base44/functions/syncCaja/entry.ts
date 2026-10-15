import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  getClientByEmail,
  getClientByShippingMark,
  buildClientSnapshot,
  resolvePackageByCode,
  latestInvoiceSnapshot,
  markPackagesReceivedIfMissing,
} from '../../shared/bultoScan.ts';
import {
  planAbsorption,
  applyAbsorption,
  markPackagesRecognizedIfMissing,
} from '../../shared/bultoAbsorption.ts';
import { syncBultoToAccounting } from '../../shared/veAccountingSync.ts';

// Registra en el servidor una caja consolidada armada en el almacén de Venezuela.
//
// La caja es la unidad que se despacha: adentro van bultos pequeños (que se absorben
// y se eliminan) y paquetes sueltos. Su código (shipping_mark-C##) es el que lleva la
// etiqueta continua con código de barras, así que al escanearla se despacha todo.
//
// Recibe: { label_code, client_email, package_codes: string[], absorb_codes: string[],
//           unregistered_codes: string[], cbm_order_numbers: string[], device_id,
//           recognition_photo_url }
// - Crea o actualiza la caja con su código propio (nunca reutiliza el de un bulto).
// - Resuelve cada código escaneado: si es un bulto registrado, se absorbe con todo su
//   contenido (paquetes, códigos sin registrar y N° de contenedor); si es un paquete, entra
//   a la caja; si no existe y el almacén lo confirmó, cuenta como "sin registrar".
// - Un paquete de otro cliente detiene el guardado: una caja nunca mezcla clientes.
// - Sincroniza el recibo de contabilidad igual que el resto de los bultos del almacén.
export default async function (req: Request): Promise<Response> {
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
    const deviceId = String(body.device_id || '').trim();
    if (!sessionUser && !deviceId) {
      return Response.json({ error: 'device_id requerido' }, { status: 400 });
    }
    const assignedBy = sessionUser?.email || `Dispositivo ${deviceId.slice(0, 8).toUpperCase()}`;

    const labelCode = String(body.label_code || '').trim();
    if (!labelCode) return Response.json({ error: 'Falta el código de la caja' }, { status: 400 });
    if (!/-C\d+$/i.test(labelCode)) {
      return Response.json({
        error: 'El código no es de caja: las cajas usan su propio código terminado en -C##.',
      });
    }

    const scannedCodes = [...new Set(
      (Array.isArray(body.package_codes) ? body.package_codes : [])
        .map((c: any) => String(c || '').trim())
        .filter(Boolean)
    )];
    if (!scannedCodes.length) {
      return Response.json({ error: 'La caja no tiene paquetes escaneados' }, { status: 400 });
    }

    const absorbCodes = new Set(
      (Array.isArray(body.absorb_codes) ? body.absorb_codes : [])
        .map((c: any) => String(c || '').trim().toUpperCase())
        .filter(Boolean)
    );

    // Códigos que el empleado confirmó agregar aunque no existan como Package.
    const unregisteredConfirmed = new Set(
      (Array.isArray(body.unregistered_codes) ? body.unregistered_codes : [])
        .map((c: any) => String(c || '').trim())
        .filter(Boolean)
    );

    const manualOrders = (Array.isArray(body.cbm_order_numbers) ? body.cbm_order_numbers : [])
      .map((s: any) => String(s || '').trim())
      .filter(Boolean);

    const codeMatch = labelCode.match(/-C(\d+)$/i);
    const numberFromCode = codeMatch ? Number(codeMatch[1]) : null;
    const markFromCode = labelCode.slice(0, labelCode.length - String(codeMatch?.[0] || '').length).trim();

    // Cliente: por email confirmado en pantalla o deducido del shipping mark del código.
    let clientEmail = String(body.client_email || '').trim();
    let client = clientEmail ? await getClientByEmail(base44, clientEmail) : null;
    if (!client && markFromCode) {
      client = await getClientByShippingMark(base44, markFromCode);
      if (client?.email) clientEmail = String(client.email).trim();
    }
    if (!client || !clientEmail) {
      return Response.json({ error: 'No se encontró el cliente dueño de esta caja' });
    }
    const shippingMark = client.shipping_mark || markFromCode;

    // --- Resolver el contenido escaneado ---
    const packageIds: string[] = [];
    const unregistered: string[] = [];
    const movedOrders: string[] = [];
    const absorbedTrackings: string[] = [];
    const warnings: string[] = [];

    for (const code of scannedCodes) {
      const upper = code.toUpperCase();

      // Una caja no se mete dentro de otra caja.
      if (/-C\d+$/i.test(code)) continue;

      if (absorbCodes.has(upper) || /-B\d+$/i.test(code)) {
        const rows = await base44.asServiceRole.entities.Bulto
          .filter({ label_code: code }, '-created_date', 1)
          .catch(() => []);
        const source = rows?.[0] || null;

        if (!source) {
          // Bulto escaneado que ya no existe (normalmente porque su contenido ya se fusionó
          // antes): su etiqueta no es un paquete, así que ni entra a la caja ni suma.
          continue;
        }
        if (source.is_caja) {
          warnings.push(`El código ${code} es una caja consolidada y no se absorbió.`);
          continue;
        }
        // El bulto absorbido aporta todos sus paquetes, códigos y N° de contenedor.
        for (const id of source.package_ids || []) {
          const value = String(id || '').trim();
          if (value && !value.startsWith('local_') && !packageIds.includes(value)) packageIds.push(value);
        }
        for (const extra of [...(source.unregistered_codes || []), ...(source.package_trackings || [])]) {
          const value = String(extra || '').trim();
          if (value && !unregistered.includes(value)) unregistered.push(value);
        }
        movedOrders.push(...(source.cbm_order_numbers || []));
        absorbedTrackings.push(...(source.package_trackings || []));
        continue;
      }

      // Código de paquete (etiqueta TLEC o tracking).
      const pkg = await resolvePackageByCode(base44, code);
      if (!pkg) {
        if (unregisteredConfirmed.has(code)) {
          if (!unregistered.includes(code)) unregistered.push(code);
          continue;
        }
        return Response.json({ error: `Paquete no encontrado: ${code}` });
      }
      if ((pkg.client_email || '') && pkg.client_email !== clientEmail) {
        return Response.json({
          error: `El paquete ${code} es de otro cliente: una caja no puede mezclar clientes.`,
        });
      }
      if (!packageIds.includes(pkg.id)) packageIds.push(pkg.id);
      // El código escaneado que ya es el tracking o la etiqueta de este paquete no es un
      // código "sin registrar": el paquete ya quedó dentro de la caja.
      const ownCodes = [String(pkg.tracking_number || '').trim(), String(pkg.label_code || '').trim()];
      if (!unregistered.includes(code) && !ownCodes.includes(code)) unregistered.push(code);
    }

    // Los paquetes reales no se cuentan dos veces como "sin registrar".
    const resolvedTrackings = new Set<string>();
    const pkgs = (await Promise.all(
      packageIds.map((id) => base44.asServiceRole.entities.Package.get(id).catch(() => null))
    )).filter(Boolean) as any[];
    pkgs.forEach((p) => {
      if (p.tracking_number) resolvedTrackings.add(String(p.tracking_number).trim().toUpperCase());
    });
    // Las etiquetas de bultos (-B## / -C##) no son paquetes: se descartan aquí para que
    // tampoco vuelvan a entrar en la lista de "sin registrar" ni sumen en el conteo.
    const isBultoLabel = (value: string) => /-[BC]\d+$/i.test(String(value || '').trim());
    const unregisteredFinal = unregistered
      .filter((c) => !isBultoLabel(c))
      .filter((c) => !resolvedTrackings.has(String(c).trim().toUpperCase()));

    const existingRows = await base44.asServiceRole.entities.Bulto
      .filter({ label_code: labelCode }, '-created_date', 1)
      .catch(() => []);
    const existing: any = existingRows?.[0] || null;

    // Caja ya despachada: no se vuelve a armar.
    if (existing?.status === 'despachado') {
      return Response.json({ error: 'Esta caja ya fue despachada.', already_dispatched: true });
    }
    if (existing?.is_caja === false) {
      return Response.json({
        error: 'Ese código pertenece a un bulto: las cajas necesitan su propio código -C##.',
      });
    }

    // Fusión: los bultos pequeños que traían estos paquetes pasan a la caja y se eliminan
    // (los de otro cliente se conservan sin el paquete movido). El escaneo nunca se bloquea.
    const plan = await planAbsorption(base44, {
      packageIds,
      excludeBultoId: existing?.id || '',
      clientEmail,
      unregisteredCodes: unregisteredFinal,
      actor: assignedBy,
    });

    const orderNumbers = [...new Set([...manualOrders, ...movedOrders, ...plan.order_numbers])];
    const packageTrackings = [...plan.trackings, ...plan.unregistered_codes];
    // Conteo real de la caja: solo los paquetes registrados que quedaron dentro (los que
    // aportó cada bulto absorbido, sin repetir). Las etiquetas de los bultos fusionados y
    // los códigos que no son paquete no suman.
    const packageCount = plan.package_ids.length;

    // CBM y tipo de carga reales de lo que va dentro de la caja.
    const cbm = pkgs.reduce((sum, p) => sum + (Number(p.actual_cbm) || 0), 0);
    const highRisk = pkgs.some((p) => p.risk_category === 'alto_riesgo');
    const invoice = await latestInvoiceSnapshot(base44, clientEmail);
    const now = new Date().toISOString();
    const absorptionHistory = [...(existing?.absorbed_bultos || []), ...plan.absorbed];

    const payload: any = {
      label_code: labelCode,
      is_caja: true,
      client_email: clientEmail,
      shipping_mark: shippingMark,
      package_ids: plan.package_ids,
      package_trackings: packageTrackings,
      unregistered_codes: plan.unregistered_codes,
      cbm_order_numbers: orderNumbers,
      absorbed_bultos: absorptionHistory,
      client_snapshot: existing?.client_snapshot?.full_name
        ? existing.client_snapshot
        : buildClientSnapshot(client, shippingMark, clientEmail),
      invoice_paid: invoice.invoicePaid,
      invoice_status: invoice.invoiceStatus,
      invoice_number: invoice.invoiceNumber,
      cargo_package_count: packageCount,
      ...(cbm > 0 ? { cargo_cbm: Number(cbm.toFixed(4)) } : {}),
      cargo_risk_category: highRisk ? 'alto_riesgo' : 'general',
      cargo_updated_by: assignedBy,
      cargo_updated_date: now,
      status: 'en_almacen_ve',
      order_locked: true,
      order_assigned_by: assignedBy,
      order_assigned_date: now,
      warehouse_id: existing?.warehouse_id || pkgs[0]?.warehouse_id || '',
      bulto_number: numberFromCode || existing?.bulto_number || 0,
      created_by: existing?.created_by || assignedBy,
    };

    let caja: any;
    if (existing) {
      caja = await base44.asServiceRole.entities.Bulto.update(existing.id, payload);
    } else {
      const clientCajas = await base44.asServiceRole.entities.Bulto
        .filter({ client_email: clientEmail, is_caja: true }, '-created_date', 500)
        .catch(() => []);
      caja = await base44.asServiceRole.entities.Bulto.create({
        ...payload,
        total_bultos: (clientCajas?.length || 0) + 1,
        ...(String(body.recognition_photo_url || '').trim()
          ? { recognition_photo_url: String(body.recognition_photo_url).trim() }
          : {}),
      });
    }

    // El contenido ya está dentro de la caja: los bultos absorbidos se eliminan.
    const absorbed = await applyAbsorption(base44, plan);

    await markPackagesRecognizedIfMissing(base44, plan.package_ids, now, assignedBy);
    // Todo lo escaneado quedó dentro de la caja, en el almacén: el paquete que no tenía
    // recepción registrada queda recibido ahora; los ya recibidos no se vuelven a contar.
    await markPackagesReceivedIfMissing(base44, plan.package_ids, now, assignedBy);

    // El recibo de contabilidad queda alineado con lo registrado en el almacén.
    const sync: any = await syncBultoToAccounting(
      base44,
      { ...caja, cbm_order_numbers: orderNumbers },
      { actor: assignedBy, previous_orders: plan.order_numbers }
    ).catch(() => ({ action: 'skipped', warnings: [] }));

    return Response.json({
      caja: {
        id: caja.id,
        label_code: caja.label_code,
        client_email: caja.client_email,
        shipping_mark: caja.shipping_mark,
        status: caja.status,
        is_caja: true,
        package_count: packageCount,
        cbm: Number(cbm.toFixed(4)),
        package_trackings: packageTrackings,
        unregistered_codes: plan.unregistered_codes,
        cbm_order_numbers: orderNumbers,
        client_snapshot: caja.client_snapshot || {},
        absorbed_bultos: absorptionHistory,
      },
      absorbed: {
        bultos: plan.absorbed,
        packages_moved: plan.packages_moved,
        deleted: absorbed.deleted,
        stripped: absorbed.stripped,
        failed: absorbed.failed,
        warnings: [...warnings, ...absorbed.warnings],
      },
      sync,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}