import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { buildCopyTxtBlock, copyPending, saveCopyCursor } from '../../shared/copyClientReport.ts';

// Genera el TXT con los clientes de una app integrada (copia) desde su propio
// punto de inicio y avanza solo el cursor de esa copia.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let payload = {};
    try { payload = await req.json(); } catch (_) { payload = {}; }

    const appId = String(payload?.app_id || '').trim();
    if (!appId) {
      return Response.json({ error: 'Falta el identificador de la app integrada.' }, { status: 400 });
    }

    // Un id con formato inválido (copia borrada) debe responder 404, no reventar.
    const rows = await base44.asServiceRole.entities.IntegratedApp
      .filter({ id: appId }, '-created_date', 1)
      .catch(() => []);
    const app = rows?.[0];
    if (!app) {
      return Response.json({ error: 'La app integrada no existe.' }, { status: 404 });
    }

    const { pending, cursorNumber } = await copyPending(base44, app);

    if (pending.length === 0) {
      return Response.json({
        success: true,
        empty: true,
        count: 0,
        content: '',
        cursor_number: cursorNumber,
        app_name: app.name,
        message: 'No hay clientes nuevos de esta copia para reportar desde su punto de inicio.'
      });
    }

    const content = `${pending.map((row) => buildCopyTxtBlock(row.client)).join('\n\n')}\n`;
    const last = pending[pending.length - 1];
    const now = new Date().toISOString();

    await saveCopyCursor(base44, app, {
      cursor_number: last.num,
      last_mark: last.client.shipping_mark,
      last_report_date: now,
      last_report_count: pending.length
    });

    return Response.json({
      success: true,
      empty: false,
      count: pending.length,
      content,
      cursor_number: last.num,
      last_mark: last.client.shipping_mark,
      last_report_date: now,
      app_name: app.name
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}