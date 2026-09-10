import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const CURSOR_KEY = 'main';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let payload = {};
    try { payload = await req.json(); } catch (_) { payload = {}; }

    const rawNumber = payload?.number;
    const number = Number(rawNumber);
    if (rawNumber == null || Number.isNaN(number) || number < 0 || !Number.isInteger(number)) {
      return Response.json({ error: 'Debe indicar un número entero válido mayor o igual a 0.' }, { status: 400 });
    }

    const rows = await base44.asServiceRole.entities.ClientReportCursor.filter({ config_key: CURSOR_KEY }, '-updated_date', 1);
    const cursor = rows?.[0] || null;

    if (cursor) {
      await base44.asServiceRole.entities.ClientReportCursor.update(cursor.id, {
        last_shipping_mark_number: number,
        last_shipping_mark_string: cursor.last_shipping_mark_string || '',
        last_report_date: cursor.last_report_date || null,
        last_report_count: cursor.last_report_count || 0,
      });
    } else {
      await base44.asServiceRole.entities.ClientReportCursor.create({
        config_key: CURSOR_KEY,
        last_shipping_mark_number: number,
        last_shipping_mark_string: '',
        last_report_date: null,
        last_report_count: 0,
      });
    }

    return Response.json({ success: true, cursor_number: number });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}