import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const METHOD_MAP: Record<string, string> = {
  stripe_invoice: 'stripe',
  stripe: 'stripe',
  binance: 'binance',
  usdt_trc20: 'usdt_trc20',
  paypal: 'paypal',
  debito_internacional: 'otro',
  wally: 'wally',
  zinli: 'zinli',
  wise: 'wise',
  skrill: 'skrill',
  pago_movil_usdt: 'pago_movil_usdt',
  transferencia: 'transferencia',
};

const mapMethod = (method: string | null | undefined): string => {
  if (!method) return 'transferencia';
  return METHOD_MAP[String(method).toLowerCase()] || 'otro';
};

const isImageUrl = (url: string | null | undefined): boolean => {
  if (!url || typeof url !== 'string') return false;
  return /^https?:\/\/.+\.(png|jpg|jpeg|webp|gif)/i.test(url);
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    let skip = 0;
    const limit = 100;
    let hasMore = true;
    let checked = 0;
    let created = 0;
    let patched = 0;
    let skipped = 0;

    // 1. Crear InvoicePayment faltantes para facturas pagadas
    while (hasMore) {
      const invoices = await base44.entities.Invoice.filter(
        { status: 'pagada' },
        '-created_date',
        limit + 1,
        skip
      );
      const list: any[] = invoices || [];
      hasMore = list.length > limit;
      const page = hasMore ? list.slice(0, limit) : list;

      for (const inv of page) {
        checked++;
        const existing = await base44.entities.InvoicePayment.filter({ invoice_id: inv.id });
        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }

        const reportDate = inv.payment_date || new Date().toISOString();
        const paymentData: Record<string, any> = {
          invoice_id: inv.id,
          invoice_number: inv.invoice_number || '',
          client_email: inv.client_email,
          amount: Number(inv.total || 0),
          method: mapMethod(inv.payment_method),
          reference: inv.payment_reference || '',
          status: 'aprobado',
          reported_date: reportDate,
          approved_date: reportDate,
          approved_by: user.email,
        };

        if (isImageUrl(inv.payment_reference)) {
          paymentData.proof_url = inv.payment_reference;
        }

        await base44.entities.InvoicePayment.create(paymentData);
        created++;
      }

      skip += limit;
    }

    // 2. Parchear registros existentes sin reported_date (backfills anteriores)
    let patchSkip = 0;
    let patchHasMore = true;
    while (patchHasMore) {
      const payments = await base44.entities.InvoicePayment.list(
        '-created_date',
        limit + 1,
        patchSkip
      );
      const plist: any[] = payments || [];
      patchHasMore = plist.length > limit;
      const ppage = patchHasMore ? plist.slice(0, limit) : plist;

      for (const p of ppage) {
        if (!p.reported_date) {
          const rd = p.approved_date || p.created_date || new Date().toISOString();
          await base44.entities.InvoicePayment.update(p.id, { reported_date: rd });
          patched++;
        }
      }

      patchSkip += limit;
    }

    return Response.json({ checked, created, patched, skipped });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}