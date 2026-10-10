import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { errorMessage, fetchAllFilter, normTracking, num } from '../../shared/paginatedFetch.ts';
import {
  clientMatchesKey,
  emailKeyOf,
  loadBilledIndex,
  loadOrdersForClients,
  markKeyOf,
  ordersForClient,
  receivedTrackingsByOrder,
  round2,
  stampKeyOf,
} from '../../shared/wholesalerBilling.ts';

// Clientes para facturar, agrupados por mayorista. El mayorista se reconoce por
// la marca que quedó en cada cliente, así también aparecen los de una conexión
// que se quitó después. Sin wholesaler_key devuelve solo el mapa de mayoristas
// con clientes; con wholesaler_key, la lista liviana de ese mayorista; y con
// client_emails, el detalle de esos clientes (órdenes, trackings recibidos y
// trackings todavía libres).
const MAX_CLIENTS = 500;
const MAX_AVAILABLE = 300;
const DETAIL_BATCH = 6;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const isAutomation = req.headers.get('x-base44-automation') === 'true';
    if (!isAutomation && (!user || user.role !== 'admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const wantedKey = String(body?.wholesaler_key || '').trim();

    const rows = await fetchAllFilter(base44.asServiceRole.entities.WholesalerClient, {}, '-fetched_date');
    const allClients = (rows || []).filter((row: any) => String(row?.email || '').trim());

    const groupsById = new Map<string, any>();
    for (const row of allClients) {
      const stampKey = stampKeyOf(row);
      const group = groupsById.get(stampKey)
        || { key: stampKey, name: row.wholesaler_name || (stampKey === 'main' ? 'Cliente mayorista' : stampKey), clients: 0 };
      group.clients += 1;
      groupsById.set(stampKey, group);
    }
    const groups = [...groupsById.values()].sort((a, b) => b.clients - a.clients);

    if (!wantedKey) {
      return Response.json({ ok: true, groups, clients: [], total: 0, generated_at: new Date().toISOString() });
    }

    const clients = allClients.filter((row: any) => clientMatchesKey(row, wantedKey)).slice(0, MAX_CLIENTS);
    const emails = clients.map((row: any) => emailKeyOf(row.email));
    const marks = clients.map((row: any) => markKeyOf(row.shipping_mark)).filter(Boolean);
    const [orders, billed] = await Promise.all([
      loadOrdersForClients(base44, emails, marks),
      loadBilledIndex(base44, emails),
    ]);

    const detailEmails = new Set(
      (Array.isArray(body?.client_emails) ? body.client_emails : []).map((value: string) => emailKeyOf(value)),
    );
    const withDetail = detailEmails.size > 0;

    const base: any[] = clients.map((row: any) => {
      const clientOrders = ordersForClient(orders, row.email, row.shipping_mark);
      const pending = clientOrders.filter((order: any) => !billed.orders.has(String(order.invoice_number).trim().toLowerCase()));
      return {
        id: row.id,
        email: row.email,
        full_name: row.full_name
          || [row.first_name, row.last_name].filter(Boolean).join(' ')
          || row.email,
        shipping_mark: row.shipping_mark || '',
        cedula: row.cedula || '',
        city: row.city || '',
        state: row.state || '',
        whatsapp: row.whatsapp || '',
        user_id: row.user_id || '',
        rate_per_cbm: num(row.rate_per_cbm),
        door_to_door_per_cbm: num(row.door_to_door_per_cbm),
        pending_orders: pending.length,
        pending_cbm: round2(pending.reduce((sum: number, order: any) => sum + num(order.cbm), 0)),
        billed_orders: clientOrders.length - pending.length,
        orders: [],
        available_trackings: [],
        _pending: pending,
      };
    });

    if (withDetail) {
      const targets = base.filter((row: any) => detailEmails.has(emailKeyOf(row.email)));
      for (let i = 0; i < targets.length; i += DETAIL_BATCH) {
        const chunk = targets.slice(i, i + DETAIL_BATCH);
        await Promise.all(chunk.map(async (row: any) => {
          const selected = row._pending.map((order: any) => ({
            order_number: String(order.invoice_number || '').trim(),
            cbm: num(order.cbm),
            fecha: order.fecha || null,
            trackings: Array.isArray(order.tracking_numbers) ? order.tracking_numbers : [],
          }));
          const received = await receivedTrackingsByOrder(base44, selected, billed.trackings);
          row.orders = selected.map((item: any) => {
            const hit = received[item.order_number.trim().toLowerCase()] || { count: 0, trackings: [] };
            return {
              order_number: item.order_number,
              cbm: round2(item.cbm),
              fecha: item.fecha,
              trackings_count: item.trackings.length,
              received: hit.count,
              received_trackings: hit.trackings,
            };
          });

          // Trackings recibidos del cliente que no están en ninguna orden: sirven
          // para armarle una orden nueva o engancharlos a una de las suyas.
          const used = new Set<string>();
          for (const order of ordersForClient(orders, row.email, row.shipping_mark)) {
            for (const raw of order.tracking_numbers || []) used.add(normTracking(raw));
          }
          const packages = await base44.asServiceRole.entities.Package.filter(
            { client_email: row.email, received_date: { $exists: true } },
            '-received_date',
            MAX_AVAILABLE,
          );
          const seen = new Set<string>();
          row.available_trackings = (packages || [])
            .filter((pkg: any) => {
              const tracking = normTracking(pkg.tracking_number);
              if (!tracking || used.has(tracking) || seen.has(tracking)) return false;
              if (billed.trackings.has(tracking.toLowerCase())) return false;
              seen.add(tracking);
              return true;
            })
            .map((pkg: any) => ({
              tracking_number: pkg.tracking_number,
              description: pkg.shipping_company || pkg.description || '',
            }));
        }));
      }
    }

    const clean = base.map(({ _pending, ...rest }: any) => rest);
    const group = groupsById.get(wantedKey)
      || { key: wantedKey, name: wantedKey === 'main' ? 'Cliente mayorista' : wantedKey, clients: clean.length };

    return Response.json({
      ok: true,
      wholesaler: { key: wantedKey, name: group.name },
      groups,
      clients: clean,
      total: clean.length,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}