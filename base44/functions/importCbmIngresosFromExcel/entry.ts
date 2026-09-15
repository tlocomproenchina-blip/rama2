import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const fileUrl = body?.file_url;
    if (!fileUrl) return Response.json({ error: 'Falta el archivo' }, { status: 400 });

    // Extraer filas del Excel/CSV con el schema de las 4 columnas
    const extractRes = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url: fileUrl,
      json_schema: {
        type: 'object',
        properties: {
          rows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                shipping_mark: { type: 'string' },
                invoice_number: { type: 'string' },
                cbm: { type: 'number' },
                fecha_salida: { type: 'string' }
              },
              required: ['shipping_mark', 'invoice_number', 'cbm', 'fecha_salida']
            }
          }
        },
        required: ['rows']
      }
    });

    const extracted = extractRes?.output || extractRes;
    let rows = Array.isArray(extracted) ? extracted : (extracted?.rows || []);
    if (!Array.isArray(rows) || rows.length === 0) {
      return Response.json({ error: 'No se pudieron extraer filas del archivo. Verifica que tenga las columnas: SHIPPING MARK, Ordenes/RECIBO, CBM, Fecha De SALIDA.' }, { status: 400 });
    }

    // Normalizar shipping marks (quitar espacios, mayúsculas)
    const normalizeMark = (s) => (s || '').toString().trim().toUpperCase().replace(/\s+/g, '');
    const uniqueMarks = [...new Set(rows.map(r => normalizeMark(r.shipping_mark)).filter(Boolean))];

    // Buscar clientes por shipping mark (service role para acceso a User)
    const clientsByMark = {};
    for (const mark of uniqueMarks) {
      try {
        const found = await base44.asServiceRole.entities.User.filter({ shipping_mark: mark }, '-updated_date', 5);
        if (found && found.length > 0) {
          clientsByMark[mark] = found[0];
        }
      } catch (_) {}
    }

    // Recolectar invoice_numbers existentes por cliente para verificar duplicados
    const existingByClient = {};
    for (const mark of Object.keys(clientsByMark)) {
      const client = clientsByMark[mark];
      try {
        const existing = await base44.asServiceRole.entities.CbmIngreso.filter(
          { client_email: client.email },
          '-fecha',
          500
        );
        const set = new Set();
        (existing || []).forEach((c) => {
          if (c.invoice_number) set.add(String(c.invoice_number).trim().toLowerCase());
        });
        existingByClient[client.email] = set;
      } catch (_) {
        existingByClient[client.email] = new Set();
      }
    }

    const created = [];
    const skipped = [];
    const notFound = [];
    const toCreate = [];

    for (const row of rows) {
      const mark = normalizeMark(row.shipping_mark);
      const invoiceNum = String(row.invoice_number || '').trim();
      const cbmVal = parseFloat(row.cbm);

      if (!mark) { notFound.push({ ...row, reason: 'Shipping mark vacío' }); continue; }
      if (!invoiceNum) { notFound.push({ ...row, reason: 'Número de recibo vacío' }); continue; }
      if (!cbmVal || cbmVal <= 0) { notFound.push({ ...row, reason: 'CBM inválido' }); continue; }

      // Parsear fecha_salida (acepta "2026. 3. 16", "2026-03-16", "16/03/2026")
      let fechaSalida = '';
      try {
        const raw = String(row.fecha_salida || '').trim();
        const cleaned = raw.replace(/[.\s]/g, (m, i) => m === '.' ? '-' : m).replace(/(\d{4})-(\d{1,2})-(\d{1,2})/, (_, y, m, d) => `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`);
        const parsed = new Date(cleaned + 'T12:00:00');
        if (!isNaN(parsed.getTime())) fechaSalida = parsed.toISOString().slice(0, 10);
      } catch (_) {}

      const client = clientsByMark[mark];
      if (!client) { notFound.push({ ...row, reason: `Shipping mark no encontrado: ${mark}` }); continue; }

      const dupKey = invoiceNum.toLowerCase();
      if (existingByClient[client.email]?.has(dupKey)) {
        skipped.push({ shipping_mark: mark, invoice_number: invoiceNum, cbm: cbmVal, fecha_salida: fechaSalida, client_name: client.full_name || client.email });
        continue;
      }

      // Marcar como existente para evitar duplicados dentro del mismo lote
      existingByClient[client.email].add(dupKey);

      const fechaISO = fechaSalida ? new Date(fechaSalida + 'T12:00:00').toISOString() : new Date().toISOString();
      const mes = fechaSalida ? fechaSalida.slice(0, 7) : new Date().toISOString().slice(0, 7);

      toCreate.push({
        fecha: fechaISO,
        cbm: cbmVal,
        mes,
        client_email: client.email,
        client_name: client.full_name || '',
        shipping_mark: mark,
        invoice_number: invoiceNum,
        fecha_salida: fechaSalida,
        tracking_numbers: [],
        disponible_entrega: false
      });
      created.push({ shipping_mark: mark, invoice_number: invoiceNum, cbm: cbmVal, fecha_salida: fechaSalida, client_name: client.full_name || client.email });
    }

    // Crear en lote
    let createdCount = 0;
    if (toCreate.length > 0) {
      try {
        await base44.asServiceRole.entities.CbmIngreso.bulkCreate(toCreate);
        createdCount = toCreate.length;
      } catch (e) {
        return Response.json({ error: 'Error al crear registros: ' + (e?.message || '') }, { status: 500 });
      }
    }

    return Response.json({
      total: rows.length,
      created: createdCount,
      createdDetails: created,
      skipped: skipped.length,
      skippedDetails: skipped,
      notFound: notFound.length,
      notFoundDetails: notFound
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}