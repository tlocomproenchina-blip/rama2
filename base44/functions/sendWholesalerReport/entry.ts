import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getWholesalerConfig } from '../../shared/wholesalerCore.ts';
import { sendWholesalerReport } from '../../shared/wholesalerReport.ts';

// Reenvía el informe de clientes nuevos del mayorista desde el panel
// (por ejemplo cuando el correo diario no pudo salir).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const cfg = await getWholesalerConfig(base44);
    const result = await sendWholesalerReport(base44, cfg);
    return Response.json({ ok: true, ...result });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}