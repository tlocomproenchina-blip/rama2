import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  allocateGuideSequence,
  markScansWithGuide,
  nextGuideNumber,
  normCode,
  unique,
} from '../../shared/dispatchGuideAppend.ts';
import {
  buildGuideGroupsFromOrders,
  fetchReceiptsForOrders,
  isUnregisteredLine,
  orderKeyOf,
  resolveOrderCandidates,
} from '../../shared/guideOrderSources.ts';
import { createOrdersForGuide } from '../../shared/manualGuideOrders.ts';

// Emite una guía de despacho por dos vías, y las dos pueden combinarse:
//   1) bultos escaneados que siguen pendientes (getDispatchGuides ya excluye los
//      que entraron en una guía anterior), elegidos por cliente o por código;
//   2) contenedores elegidos a mano (body.orders): la carga se emite aunque su
//      bulto no esté registrado o no exista, con su N° de contenedor y, si se conoce, su
//      factura. Esa línea sale marcada como carga sin bulto registrado.
// La guía recibe su número correlativo (DispatchGuideCounter), los escaneos
// incluidos quedan marcados para no volver a ofrecerse y, si se pide, se generan
// solas las órdenes de despacho de cada cliente.

// Fusiona los grupos devueltos por getDispatchGuides (clientes con email y códigos
// de clientes sin email) y los grupos armados desde órdenes, sin duplicar líneas.
const lineKeyOf = (bulto: any) =>
  normCode(bulto?.label_code) || `order:${normCode(bulto?.order_number)}:${normCode(bulto?.invoice_number)}`;

const mergeClients = (groups: any[]) => {
  const map = new Map();
  (groups || []).forEach((client) => {
    if (!client) return;
    const key = client.client_key || client.client_email || client.client_name;
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, { ...client, bultos: [...(client.bultos || [])] });
      return;
    }
    const existing: any = map.get(key);
    const seen = new Set(existing.bultos.map((b: any) => lineKeyOf(b)));
    (client.bultos || []).forEach((b: any) => {
      const lineKey = lineKeyOf(b);
      if (!lineKey || seen.has(lineKey)) return;
      seen.add(lineKey);
      existing.bultos.push(b);
    });
    const bultos = existing.bultos;
    existing.totals = {
      bultos: bultos.length,
      packages: bultos.reduce((sum: number, b: any) => sum + (Number(b.package_count) || 0), 0),
      unregistered: bultos.filter(isUnregisteredLine).length,
      scanned: client.totals?.scanned || existing.totals?.scanned || bultos.length,
      cajas: bultos.filter((b: any) => b.is_caja).length,
      cbm: Number(bultos.reduce((sum: number, b: any) => sum + (Number(b.cbm) || 0), 0).toFixed(4)),
    };
  });

  return [...map.values()]
    .map((client: any) => {
      const bultos = [...(client.bultos || [])].sort((a: any, b: any) => {
        const aCode = normCode(a.label_code);
        const bCode = normCode(b.label_code);
        if (!aCode && !bCode) return String(a.order_number || '').localeCompare(String(b.order_number || ''));
        if (!aCode) return 1;
        if (!bCode) return -1;
        return aCode.localeCompare(bCode);
      });
      return {
        ...client,
        bultos,
        totals: {
          bultos: bultos.length,
          packages: bultos.reduce((sum: number, b: any) => sum + (Number(b.package_count) || 0), 0),
          unregistered: bultos.filter(isUnregisteredLine).length,
          scanned: client.totals?.scanned || 0,
          cajas: bultos.filter((b: any) => b.is_caja).length,
          cbm: Number(bultos.reduce((sum: number, b: any) => sum + (Number(b.cbm) || 0), 0).toFixed(4)),
        },
      };
    })
    .sort(
      (a: any, b: any) =>
        b.totals.bultos - a.totals.bultos || String(a.client_name).localeCompare(String(b.client_name))
    );
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const from = String(body.from || '').trim();
    const to = String(body.to || '').trim();
    const clientEmails = unique(
      (Array.isArray(body.client_emails) ? body.client_emails : [])
        .map((email: any) => String(email || '').trim())
        .filter(Boolean)
    );
    const requestedCodes = unique(
      (Array.isArray(body.codes) ? body.codes : []).map((code: any) => normCode(code)).filter(Boolean)
    );
    // Contenedores elegidos a mano: permiten emitir la carga aunque su bulto no
    // esté registrado o no exista.
    const requestedOrders = unique(
      (Array.isArray(body.orders) ? body.orders : [])
        .map((order: any) => orderKeyOf(order?.client_email, order?.order_number))
        .filter((key: string) => !!key && !key.endsWith('#'))
    ).map((key: string) => {
      const [client_email, order_number] = key.split('#');
      return { client_email, order_number };
    });

    if (!clientEmails.length && !requestedCodes.length && !requestedOrders.length) {
      return Response.json({ error: 'Marca al menos un contenedor o un bulto para emitir la guía' }, { status: 400 });
    }

    const emittedDate = new Date().toISOString();

    // --- 1) Bultos escaneados que siguen pendientes ---
    const groups: any[] = [];
    const guideFilters: any = { from, to, skip: 0 };
    const scanning = clientEmails.length > 0 || requestedCodes.length > 0;

    if (scanning) {
      if (clientEmails.length) {
        const res = await base44.functions.invoke('getDispatchGuides', { ...guideFilters, client_emails: clientEmails });
        const data: any = res?.data || res || {};
        (data.clients || []).forEach((client: any) => groups.push(client));
      }

      if (requestedCodes.length) {
        const res = await base44.functions.invoke('getDispatchGuides', { ...guideFilters, codes: requestedCodes });
        const data: any = res?.data || res || {};
        (data.clients || []).forEach((client: any) => groups.push(client));
      }
    }

    // --- 2) Contenedores elegidos a mano ---
    const skippedOrders: any[] = [];
    let orderClients: any[] = [];
    let orderKeys: string[] = [];

    if (requestedOrders.length) {
      const receipts = await fetchReceiptsForOrders(base44, requestedOrders);
      const candidates = await resolveOrderCandidates(base44, receipts);
      const byKey = new Map(candidates.map((candidate: any) => [candidate.key, candidate]));

      const chosen: any[] = [];
      requestedOrders.forEach((request: any) => {
        const candidate: any = byKey.get(orderKeyOf(request.client_email, request.order_number));
        if (!candidate) {
          skippedOrders.push({ ...request, reason: 'No hay recibo de carga para ese contenedor' });
          return;
        }
        if (candidate.already_in_guide) {
          skippedOrders.push({
            ...request,
            reason: `Ese contenedor ya salió en la guía ${candidate.guide_number || ''}`.trim(),
          });
          return;
        }
        chosen.push(candidate);
      });

      if (!chosen.length) {
        return Response.json(
          { error: 'Los contenedores elegidos ya no están disponibles para guía', skipped_orders: skippedOrders },
          { status: 409 }
        );
      }

      const built = buildGuideGroupsFromOrders(chosen, emittedDate);
      orderClients = built.clients;
      orderKeys = built.orderKeys;
    }

    const clients = mergeClients([...groups, ...orderClients]).map((client: any) => ({
      client_key: client.client_key || '',
      client_email: client.client_email || '',
      client_name: client.client_name || '',
      shipping_mark: client.shipping_mark || '',
      orders_count: Number(client.orders_count) || 0,
      client: client.client || {},
      bultos: client.bultos || [],
      totals: client.totals || { bultos: 0, packages: 0, unregistered: 0 },
    }));

    const bultoCodes = unique(
      clients.flatMap((client: any) =>
        client.bultos.filter((b: any) => !isUnregisteredLine(b)).map((b: any) => normCode(b.label_code))
      )
    );
    const linesCount = clients.reduce((sum: number, c: any) => sum + (Number(c.totals?.bultos) || 0), 0);
    const unregisteredCount = clients.reduce((sum: number, c: any) => sum + (Number(c.totals?.unregistered) || 0), 0);

    // Códigos pedidos que ya no están pendientes (se incluyeron en otra guía).
    const included = new Set(bultoCodes);
    const skipped = requestedCodes.filter((code: string) => !included.has(code));

    if (!clients.length || (!bultoCodes.length && !unregisteredCount)) {
      return Response.json(
        { error: 'Los bultos seleccionados ya no están pendientes de guía', skipped },
        { status: 409 }
      );
    }

    const totals = {
      clients: clients.length,
      bultos: linesCount,
      packages: clients.reduce((sum: number, c: any) => sum + (Number(c.totals?.packages) || 0), 0),
      unregistered: unregisteredCount,
      cajas: clients.reduce((sum: number, c: any) => sum + (Number(c.totals?.cajas) || 0), 0),
      cbm: Number(
        clients.reduce((sum: number, c: any) => sum + (Number(c.totals?.cbm) || 0), 0).toFixed(4)
      ),
    };

    // Número correlativo con bloqueo optimista sobre el contador dedicado.
    const sequence = await allocateGuideSequence(base44);

    if (sequence === null) {
      return Response.json({ error: 'No se pudo asignar el número de guía, intenta de nuevo' }, { status: 500 });
    }

    const guideNumber = nextGuideNumber(sequence);

    const guide = await base44.asServiceRole.entities.DispatchGuide.create({
      guide_number: guideNumber,
      guide_sequence: sequence,
      emitted_date: emittedDate,
      emitted_by: user.email || '',
      emitted_by_name: user.full_name || '',
      auto_generated: false,
      source: 'manual',
      last_updated_date: emittedDate,
      last_updated_by: user.email || '',
      filter_from: from,
      filter_to: to,
      clients,
      client_names: unique(clients.map((c: any) => c.client_name).filter(Boolean)),
      client_emails: unique(clients.map((c: any) => c.client_email).filter(Boolean)),
      shipping_marks: unique(clients.map((c: any) => c.shipping_mark).filter(Boolean)),
      bulto_codes: bultoCodes,
      unregistered_order_keys: unique(orderKeys),
      totals,
      dispatch_status: 'emitida',
    });

    // Los escaneos de esos bultos quedan marcados con la guía: salen de la lista
    // de pendientes y no vuelven a ofrecerse para una guía nueva.
    const marked = await markScansWithGuide(base44, {
      codes: bultoCodes,
      guideId: guide.id,
      guideNumber,
      emittedDate,
    });

    // Con la guía se generan solas las órdenes de despacho de cada cliente (por la
    // misma vía del flujo actual: createDispatchOrder) y quedan guardadas dentro de
    // la guía para consultarlas desde el historial. Un cliente que no se pudo emitir
    // se devuelve en orders_failed sin frenar la guía.
    let orders: any[] = [];
    let ordersFailed: any[] = [];
    if (body.with_orders) {
      const result: any = await createOrdersForGuide(base44, { guide, user });
      orders = result.orders;
      ordersFailed = result.failed;
      if (orders.length) guide.dispatch_orders = orders;
    }

    return Response.json({
      guide,
      skipped,
      skipped_orders: skippedOrders,
      marked,
      orders,
      orders_failed: ordersFailed,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}