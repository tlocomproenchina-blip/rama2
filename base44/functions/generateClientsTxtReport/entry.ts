import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const CURSOR_KEY = 'main';
const USER_BATCH = 200;

// Extrae el número secuencial final de un shipping mark con patrón ...-TLEC-NNNNN
// Devuelve null si no coincide (formatos antiguos/manuales se excluyen del reporte).
const parseShippingMarkNumber = (mark) => {
  if (!mark || typeof mark !== 'string') return null;
  const match = mark.match(/TLEC-(\d+)\s*$/i);
  return match ? parseInt(match[1], 10) : null;
};

const getCursor = async (base44) => {
  const rows = await base44.asServiceRole.entities.ClientReportCursor.filter({ config_key: CURSOR_KEY }, '-updated_date', 1);
  return rows?.[0] || null;
};

const fetchAllClients = async (base44) => {
  const all = [];
  let skip = 0;
  // Traer todos los clientes (role=user) en batches para no exceder límites de página.
  while (true) {
    const batch = await base44.asServiceRole.entities.User.filter({ role: 'user' }, '-created_date', USER_BATCH, skip);
    const list = Array.isArray(batch) ? batch : [];
    all.push(...list);
    if (list.length < USER_BATCH) break;
    skip += USER_BATCH;
    if (skip > 50000) break; // salvaguarda
  }
  return all;
};

const buildTxtBlock = (client) => {
  const firstName = client.first_name || '';
  const lastName = client.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  return [
    `Shipping Mark: ${client.shipping_mark || ''}`,
    `Nombre: ${fullName}`,
    `Cédula: ${client.cedula || ''}`,
    `Estado: ${client.state || ''}`,
    `Ciudad: ${client.city || ''}`,
    `Dirección: ${client.address || ''}`,
    `WhatsApp: ${client.whatsapp || ''}`,
    `Email: ${client.email || ''}`,
  ].join('\n');
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let payload = {};
    try { payload = await req.json(); } catch (_) { payload = {}; }
    const forceFromNumber = payload?.from_number != null ? Number(payload.from_number) : null;

    // Cursor actual
    let cursor = await getCursor(base44);
    let cursorNumber = 0;
    if (cursor) {
      cursorNumber = Number(cursor.last_shipping_mark_number) || 0;
    }
    // Ajuste manual puntual: si viene from_number, usarlo como punto de inicio para este reporte.
    if (forceFromNumber != null && !Number.isNaN(forceFromNumber)) {
      cursorNumber = forceFromNumber;
    }

    // Traer todos los clientes y filtrar por número secuencial > cursor
    const clients = await fetchAllClients(base44);
    const withNumbers = [];
    for (const c of clients) {
      const num = parseShippingMarkNumber(c.shipping_mark);
      if (num == null) continue; // formato no reconocido: se excluye
      if (num <= cursorNumber) continue; // ya reportado
      withNumbers.push({ client: c, num });
    }

    // Ordenar ascendentemente por número secuencial
    withNumbers.sort((a, b) => a.num - b.num);

    if (withNumbers.length === 0) {
      return Response.json({
        success: true,
        empty: true,
        count: 0,
        content: '',
        cursor_number: cursorNumber,
        last_mark: cursor?.last_shipping_mark_string || null,
        last_report_date: cursor?.last_report_date || null,
        message: 'No hay clientes nuevos para reportar desde el último punto de inicio.',
      });
    }

    // Construir el TXT
    const blocks = withNumbers.map((item) => buildTxtBlock(item.client));
    const content = blocks.join('\n\n') + '\n';

    // Avanzar el cursor al último número incluido (solo si hubo clientes)
    const lastItem = withNumbers[withNumbers.length - 1];
    const newCursorNumber = lastItem.num;
    const now = new Date().toISOString();

    if (cursor) {
      await base44.asServiceRole.entities.ClientReportCursor.update(cursor.id, {
        last_shipping_mark_number: newCursorNumber,
        last_shipping_mark_string: lastItem.client.shipping_mark,
        last_report_date: now,
        last_report_count: withNumbers.length,
      });
    } else {
      await base44.asServiceRole.entities.ClientReportCursor.create({
        config_key: CURSOR_KEY,
        last_shipping_mark_number: newCursorNumber,
        last_shipping_mark_string: lastItem.client.shipping_mark,
        last_report_date: now,
        last_report_count: withNumbers.length,
      });
    }

    return Response.json({
      success: true,
      empty: false,
      count: withNumbers.length,
      content,
      cursor_number: newCursorNumber,
      last_mark: lastItem.client.shipping_mark,
      last_report_date: now,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}