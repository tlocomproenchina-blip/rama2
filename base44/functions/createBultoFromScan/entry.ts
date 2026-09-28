import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  deduceLabelParts,
  getClientByEmail,
  buildClientSnapshot,
  latestInvoiceSnapshot,
  syncClientBultoTotals,
  markPackagesRecognized,
  resolvePackageByCode,
  findBultoContainingPackage,
  bultoScanProjection,
} from '../../shared/bultoScan.ts';
import { syncBultoToAccounting } from '../../shared/veAccountingSync.ts';

// Registra en el almacén de Venezuela un bulto cuya etiqueta escaneada no existía en el
// sistema, conservando el código ya impreso (no se genera etiqueta ni número nuevo).
// Recibe: { label_code, client_email, package_codes: string[], cbm_order_numbers: string[],
//           device_id, recognition_photo_url }
// - Crea el bulto con el label_code escaneado, el número que trae el código, el snapshot
//   del cliente y el estado de su factura más reciente.
// - En la misma acción asigna el N° de orden, bloquea el bulto, guarda la foto capturada
//   al escanear y marca los paquetes como reconocidos en Venezuela.
// - Sin sesión exige device_id (el enlace de trabajo abre sin login).
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
    const deviceId = String(body.device_id || '').trim();
    if (!sessionUser && !deviceId) {
      return Response.json({ error: 'device_id requerido' }, { status: 400 });
    }
    const assignedBy = sessionUser?.email || `Dispositivo ${deviceId.slice(0, 8).toUpperCase()}`;

    const labelCode = String(body.label_code || '').trim();
    const clientEmail = String(body.client_email || '').trim();
    if (!labelCode || !clientEmail) {
      return Response.json({ error: 'Faltan la etiqueta o el cliente del bulto' }, { status: 400 });
    }

    const packageCodes = (Array.isArray(body.package_codes) ? body.package_codes : [])
      .map((c: any) => String(c || '').trim())
      .filter(Boolean);
    if (!packageCodes.length) {
      return Response.json({ error: 'Escanea al menos un paquete del bulto' }, { status: 400 });
    }

    // Códigos que el empleado confirmó agregar aunque no existan como Package:
    // viajan dentro de los trackings del bulto, sin crear registros de paquetes.
    const unregisteredConfirmed = new Set(
      (Array.isArray(body.unregistered_codes) ? body.unregistered_codes : [])
        .map((c: any) => String(c || '').trim())
        .filter(Boolean)
    );

    const orderNumbers = (Array.isArray(body.cbm_order_numbers) ? body.cbm_order_numbers : [])
      .map((s: any) => String(s || '').trim())
      .filter(Boolean);
    if (!orderNumbers.length) {
      return Response.json({ error: 'Debe ingresar al menos un N° de orden' }, { status: 400 });
    }

    const recognitionPhotoUrl = String(body.recognition_photo_url || '').trim();

    // La etiqueta no debe existir: evita duplicados si dos dispositivos escanean a la vez.
    const taken = await base44.asServiceRole.entities.Bulto
      .filter({ label_code: labelCode }, '-created_date', 1)
      .catch(() => []);
    if (taken?.[0]) {
      return Response.json({
        error: 'Esta etiqueta ya fue registrada. Vuelve a escanearla para asignarle el N° de orden.',
      });
    }

    const client = await getClientByEmail(base44, clientEmail);
    if (!client) return Response.json({ error: 'Cliente no encontrado' });

    const { shippingMark: deducedMark, bultoNumber: numberFromLabel } = deduceLabelParts(labelCode);
    const shippingMark = client.shipping_mark || deducedMark;

    // Paquetes escaneados: se resuelven por etiqueta o tracking y se valida
    // que sean del mismo cliente y que no estén ya dentro de otro bulto.
    const uniqueCodes = Array.from(new Set(packageCodes));
    const packages: any[] = [];
    const unregistered: string[] = [];
    for (const code of uniqueCodes) {
      const pkg = await resolvePackageByCode(base44, code);
      if (!pkg) {
        if (unregisteredConfirmed.has(code)) { unregistered.push(code); continue; }
        return Response.json({ error: `Paquete no encontrado: ${code}` });
      }
      if ((pkg.client_email || '') && pkg.client_email !== clientEmail) {
        return Response.json({ error: `El paquete ${code} es de otro cliente` });
      }
      const inBulto = await findBultoContainingPackage(base44, pkg.id);
      if (inBulto) {
        return Response.json({ error: `El paquete ${code} ya está en el bulto ${inBulto.label_code || ''}` });
      }
      if (!packages.some((p) => p.id === pkg.id)) packages.push(pkg);
    }

    const existingBultos = await base44.asServiceRole.entities.Bulto
      .filter({ client_email: clientEmail }, 'bulto_number', 500)
      .catch(() => []);
    // El número sale del código impreso; solo si el código no lo trae se usa el consecutivo.
    const bultoNumber = numberFromLabel || (existingBultos.length + 1);
    const totalBultos = Math.max(existingBultos.length + 1, bultoNumber);

    const invoice = await latestInvoiceSnapshot(base44, clientEmail);
    const now = new Date().toISOString();

    const created = await base44.asServiceRole.entities.Bulto.create({
      label_code: labelCode,
      client_email: clientEmail,
      shipping_mark: shippingMark,
      bulto_number: bultoNumber,
      total_bultos: totalBultos,
      package_ids: packages.map((p) => p.id),
      package_trackings: [...packages.map((p) => p.tracking_number || '').filter(Boolean), ...unregistered],
      unregistered_codes: unregistered,
      cbm_order_numbers: orderNumbers,
      client_snapshot: buildClientSnapshot(client, shippingMark, clientEmail),
      invoice_paid: invoice.invoicePaid,
      invoice_status: invoice.invoiceStatus,
      invoice_number: invoice.invoiceNumber,
      warehouse_id: packages[0]?.warehouse_id || '',
      status: 'en_almacen_ve',
      order_locked: true,
      order_assigned_by: assignedBy,
      order_assigned_date: now,
      ve_recognized_date: now,
      ve_recognized_by: assignedBy,
      ...(recognitionPhotoUrl ? { recognition_photo_url: recognitionPhotoUrl } : {}),
      created_by: assignedBy,
    });

    await syncClientBultoTotals(base44, clientEmail, totalBultos, existingBultos);
    await markPackagesRecognized(base44, packages.map((p) => p.id), now, assignedBy);

    // El recibo de contabilidad queda alineado con lo registrado en el almacén de
    // Venezuela (N° de orden, CBM y conteo de paquetes del bulto).
    const sync: any = await syncBultoToAccounting(base44, created, { actor: assignedBy })
      .catch(() => ({ action: 'skipped', warnings: [] }));

    return Response.json({
      bulto: bultoScanProjection(created),
      sync,
      invoice_paid: invoice.invoicePaid,
      invoice_status: invoice.invoiceStatus,
      invoice_number: invoice.invoiceNumber,
      packages: packages.map((p) => ({
        tracking_number: p.tracking_number || '',
        description: p.description || '',
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}