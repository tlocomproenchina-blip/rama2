import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  approveAbonoPayment,
  approveReportedInvoicePayment,
  approveConsolidationPayment,
  approveInsurancePaymentRecord,
  errorMessage
} from '../../shared/paymentApproval.ts';
import { buildReportText, batchReportFileName, caracasDay } from '../../shared/paymentReport.ts';

// Aprobación masiva (un clic) de pagos pendientes y seguros desde Validación de Pagos.
// Recibe el tipo y los IDs visibles en pantalla y los aprueba uno por uno con la misma
// lógica que la aprobación individual; si alguno falla, los demás se aprueban igual.
// Tipos: abonos | facturas | consolidaciones | seguros
const MAX_IDS = 200;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let payload: any = {};
    try { payload = await req.json(); } catch (_) { payload = {}; }

    const type = payload?.type;
    const ids: string[] = Array.isArray(payload?.ids) ? payload.ids.filter(Boolean).map((id: any) => String(id)) : [];

    const handlers: Record<string, (base44: any, id: string, adminEmail: string) => Promise<any>> = {
      abonos: approveAbonoPayment,
      facturas: approveReportedInvoicePayment,
      consolidaciones: approveConsolidationPayment,
      seguros: approveInsurancePaymentRecord
    };

    const handler = type ? handlers[type] : null;
    if (!handler) {
      return Response.json({ error: 'Tipo de aprobación inválido' }, { status: 400 });
    }
    if (ids.length === 0) {
      return Response.json({ error: 'No hay registros por aprobar' }, { status: 400 });
    }
    if (ids.length > MAX_IDS) {
      return Response.json({ error: `Máximo ${MAX_IDS} registros por aprobación` }, { status: 400 });
    }

    const approved: string[] = [];
    const failed: any[] = [];
    const reportEntries: any[] = [];

    for (const id of ids) {
      try {
        const result: any = await handler(base44, id, user.email);
        approved.push(id);
        if (result?.report_entry) reportEntries.push(result.report_entry);
      } catch (error) {
        failed.push({ id, error: errorMessage(error) });
      }
    }

    // TXT del lote aprobado: mismo formato que el informe del día.
    const day = caracasDay();
    const batchTxt = reportEntries.length > 0
      ? buildReportText(reportEntries, { title: 'PAGOS APROBADOS', day })
      : '';

    return Response.json({
      success: true,
      type,
      approved_count: approved.length,
      failed_count: failed.length,
      approved,
      failed,
      reports_count: reportEntries.length,
      batch_txt: batchTxt,
      batch_filename: batchTxt ? batchReportFileName(day) : ''
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}