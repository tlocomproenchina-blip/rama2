import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  fetchReceiptsForOrders,
  orderKeyOf,
  orderNumbersOfInvoice,
  resolveOrderCandidates,
} from '../../shared/guideOrderSources.ts';

// Candidatos para emitir una guía de despacho cuando la carga puede no tener bulto
// registrado:
//   intent 'orders'   → contenedores (recibos de carga) que se pueden elegir a mano.
//   intent 'invoices' → facturas pagadas con las contenedores de cada una.
// El cruce con los bultos registrados, el cliente y las guías anteriores lo resuelve
// el módulo compartido; aquí solo se leen y se devuelven los candidatos.

const MAX_ORDER_LIMIT = 25;
const INVOICE_PAGE = 10;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const intent = String(body.intent || 'orders').trim() === 'invoices' ? 'invoices' : 'orders';
    const search = String(body.search || '').trim();
    const skip = Math.max(Number(body.skip) || 0, 0);

    if (intent === 'invoices') {
      const query: any = { status: 'pagada' };
      if (search) {
        const rx = { $regex: search, $options: 'i' };
        query.$or = [{ invoice_number: rx }, { client_email: rx }];
      }

      const invoices: any[] = await base44.asServiceRole.entities.Invoice
        .filter(query, '-payment_date', INVOICE_PAGE, skip)
        .catch(() => []);

      const pairs: any[] = [];
      (invoices || []).forEach((invoice: any) => {
        orderNumbersOfInvoice(invoice).forEach((order: string) => {
          pairs.push({ client_email: invoice?.client_email, order_number: order });
        });
      });

      const receipts = await fetchReceiptsForOrders(base44, pairs);
      const candidates = await resolveOrderCandidates(base44, receipts);
      const byKey = new Map(candidates.map((candidate: any) => [candidate.key, candidate]));

      const rows = (invoices || []).map((invoice: any) => {
        const orders = orderNumbersOfInvoice(invoice)
          .map((order: string) => byKey.get(orderKeyOf(invoice?.client_email, order)))
          .filter(Boolean);
        const first: any = orders[0] || null;
        return {
          id: invoice.id,
          invoice_number: invoice.invoice_number || '',
          client_email: invoice.client_email || '',
          client_name: first?.client_name || invoice.client_email || '',
          shipping_mark: first?.shipping_mark || '',
          total: Number(invoice.total) || 0,
          payment_date: invoice.payment_date || '',
          orders,
        };
      });

      return Response.json({
        invoices: rows,
        has_more: rows.length === INVOICE_PAGE,
        next_skip: skip + rows.length,
      });
    }

    const query: any = {};
    if (search) {
      const rx = { $regex: search, $options: 'i' };
      query.$or = [
        { invoice_number: rx },
        { client_email: rx },
        { client_name: rx },
        { shipping_mark: rx },
      ];
    } else {
      query.invoice_number = { $exists: true, $ne: '' };
    }

    const receipts = await base44.asServiceRole.entities.CbmIngreso
      .filter(query, '-fecha', MAX_ORDER_LIMIT, skip)
      .catch(() => []);
    const orders = await resolveOrderCandidates(base44, receipts || []);

    return Response.json({
      orders,
      has_more: orders.length === MAX_ORDER_LIMIT,
      next_skip: skip + orders.length,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}