import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  deduceLabelParts,
  getClientByShippingMark,
  publicClient,
  searchClientsByQuery,
  resolvePackageByCode,
  findBultoContainingPackage,
} from '../../shared/bultoScan.ts';
import { describeBultoForAbsorption } from '../../shared/bultoAbsorption.ts';

// Consultas de apoyo del escaneo de bultos en el almacén de Venezuela.
// La pantalla /BultoOrderScan se comparte como enlace directo y abre sin sesión:
// sin sesión se exige device_id, igual que la asignación del N° de contenedor.
// Acciones:
//   label   → deduce shipping mark y número desde el código y busca al cliente.
//   clients → busca clientes por shipping mark, email, nombre o cédula.
//   package → valida un paquete antes de agregarlo al bulto.
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

    const action = String(body.action || 'label');

    if (action === 'label') {
      const labelCode = String(body.label_code || '').trim();
      if (!labelCode) return Response.json({ error: 'label_code requerido' }, { status: 400 });
      const { shippingMark, bultoNumber } = deduceLabelParts(labelCode);
      const client = await getClientByShippingMark(base44, shippingMark);
      return Response.json({
        label_code: labelCode,
        shipping_mark: shippingMark,
        bulto_number: bultoNumber,
        client: publicClient(client),
      });
    }

    if (action === 'clients') {
      const clients = await searchClientsByQuery(base44, body.query);
      return Response.json({ clients });
    }

    if (action === 'package') {
      const code = String(body.code || '').trim();
      const clientEmail = String(body.client_email || '').trim();
      if (!code || !clientEmail) return Response.json({ error: 'Faltan datos del paquete' }, { status: 400 });

      const pkg = await resolvePackageByCode(base44, code);
      if (!pkg) {
        // No existe como Package: la pantalla puede agregarlo igual al bulto como
        // "sin registrar" (no se crea ningún registro de paquete).
        return Response.json({ not_registered: true, code });
      }
      if ((pkg.client_email || '') && pkg.client_email !== clientEmail) {
        return Response.json({ error: `El paquete ${code} es de otro cliente` });
      }
      // Si el paquete ya está en otro bulto NO se bloquea: el bulto que se está armando
      // lo absorbe. Se devuelven los datos del bulto viejo para que la pantalla pida
      // confirmación antes de moverlo.
      const inBulto = await findBultoContainingPackage(base44, pkg.id);
      const absorb = inBulto ? await describeBultoForAbsorption(base44, inBulto) : null;

      return Response.json({
        package: {
          id: pkg.id,
          tracking_number: pkg.tracking_number || '',
          description: pkg.description || '',
          label_code: pkg.label_code || '',
        },
        absorb,
      });
    }

    return Response.json({ error: 'Acción inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}