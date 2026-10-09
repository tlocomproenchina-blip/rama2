import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { buildReportText, caracasDay, dailyReportFileName } from '../../shared/paymentReport.ts';

// Informe TXT acumulado de los pagos aprobados en un día (por defecto hoy,
// hora de Caracas): Shipping Mark y N° de orden/envío de cada factura pagada.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let payload: any = {};
    try { payload = await req.json(); } catch (_) { payload = {}; }

    const requested = String(payload?.day || '').trim();
    const day = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : caracasDay();

    const entries = await base44.asServiceRole.entities.ApprovedPaymentReport
      .filter({ approval_day: day }, 'approved_date', 500)
      .catch(() => []);

    if (!entries || entries.length === 0) {
      return Response.json({
        success: true,
        empty: true,
        day,
        count: 0,
        content: '',
        message: `No hay pagos aprobados el ${day}.`
      });
    }

    return Response.json({
      success: true,
      empty: false,
      day,
      count: entries.length,
      content: buildReportText(entries, { title: 'INFORME DE PAGOS APROBADOS', day }),
      filename: dailyReportFileName(day)
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}