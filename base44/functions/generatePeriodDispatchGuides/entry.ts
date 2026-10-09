import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { buildPeriodDispatchGuides } from '../../shared/periodDispatchGuides.ts';
import { isDayKey } from '../../shared/dispatchOrderSheet.ts';

// Genera las guías de despacho de un período pagado: una guía individual por cliente,
// con las facturas pagadas entre las fechas elegidas (fecha de pago, hora de Caracas)
// y las cajas y bultos de la orden de despacho del mismo período. Cada guía queda
// numerada y guardada en el historial; los clientes del período que ya tenían guía
// guardada se reutilizan tal cual, sin duplicarse.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const from = String(body?.from || '').trim();
    const to = String(body?.to || '').trim();

    if (!isDayKey(from) || !isDayKey(to)) {
      return Response.json({ error: 'Elige la fecha de inicio y la de fin del período.' }, { status: 400 });
    }
    if (from > to) {
      return Response.json({ error: 'La fecha de inicio no puede ser posterior a la fecha de fin.' }, { status: 400 });
    }

    const result: any = await buildPeriodDispatchGuides(base44, {
      from,
      to,
      generatedBy: user.email || '',
    });

    return Response.json({ success: true, from, to, ...result });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}