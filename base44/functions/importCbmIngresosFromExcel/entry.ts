import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const fileUrl = body?.file_url;
    const dryRun = !!body?.dry_run;
    if (!fileUrl) return Response.json({ error: 'Falta el archivo' }, { status: 400 });

    // Extraer filas del Excel/CSV con el schema de las 4 columnas
    const extractRes = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url: fileUrl,
      json_schema: {
        type: 'object',
        properties: {
          rows: {
            type: 'array',
            description: 'Cada fila del Excel/CSV. Mapea las columnas del archivo a estos campos.',
            items: {
              type: 'object',
              properties: {
                shipping_mark: { type: 'string', description: 'Columna "SHIPPING MARK" o "Shipping Mark" o "MARCA" - identificador del cliente (ej: TLEC-ABC123)' },
                invoice_number: { type: 'string', description: 'Columna "Ordenes/RECIBO" o "RECIBO" o "Orden" - número de recibo/factura' },
                cbm: { type: 'number', description: 'Columna "CBM" - volumen en metros cúbicos (número decimal)' },
                fecha_salida: { type: 'string', description: 'Columna "Fecha De SALIDA" o "Fecha de Salida" o "Fecha Salida" - fecha de salida (ej: 2026-03-16)' }
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
      return Response.json({ error: 'No se pudieron extraer filas del archivo. Verifica que tenga las columnas: SHIPPING MARK, Ordenes/RECIBO, CBM, Fecha De SALIDA.' }, { status: 200 });
    }

    // Fallback: si la IA mapeó con nombres alternativos, normalizar las claves
    const markKeys = ['shipping_mark', 'shippingmark', 'shipping mark', 'marca', 'mark', 'shipping_mark_', 'ShippingMark', 'SHIPPINGMARK'];
    const invoiceKeys = ['invoice_number', 'ordenes_recibo', 'recibo', 'orden', 'order', 'receipt', 'factura', 'Ordenes/RECIBO', 'invoice'];
    const cbmKeys = ['cbm', 'CBM', 'volumen', 'volume', 'm3'];
    const fechaKeys = ['fecha_salida', 'fecha_de_salida', 'fecha', 'salida', 'departure', 'Fecha De SALIDA', 'FechaSalida'];

    const pickField = (row, keys) => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
      }
      // Búsqueda case-insensitive
      const rowKeys = Object.keys(row);
      for (const k of keys) {
        const kl = k.toLowerCase().replace(/[\s_/-]/g, '');
        for (const rk of rowKeys) {
          if (rk.toLowerCase().replace(/[\s_/-]/g, '') === kl && row[rk] !== undefined && row[rk] !== null && row[rk] !== '') return row[rk];
        }
      }
      return '';
    };

    rows = rows.map(r => ({
      shipping_mark: String(r.shipping_mark ?? pickField(r, markKeys) ?? '').trim(),
      invoice_number: String(r.invoice_number ?? pickField(r, invoiceKeys) ?? '').trim(),
      cbm: r.cbm ?? pickField(r, cbmKeys),
      fecha_salida: String(r.fecha_salida ?? pickField(r, fechaKeys) ?? '').trim()
    }));

    // Debug: si todos los shipping marks están vacíos, devolver muestra para diagnóstico
    const allEmptyMark = rows.every(r => !r.shipping_mark);
    if (allEmptyMark) {
      const sampleRaw = Array.isArray(extracted) ? extracted.slice(0, 3) : (extracted?.rows?.slice(0, 3) || []);
      return Response.json({
        error: 'No se encontró la columna SHIPPING MARK en el archivo. Revisa que el encabezado sea exactamente "SHIPPING MARK" (o "Shipping Mark").',
        debug_sample: sampleRaw,
        debug_keys: Array.isArray(extracted?.[0]) ? Object.keys(extracted[0] || {}) : Object.keys(extracted?.rows?.[0] || {})
      }, { status: 200 });
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
    const previewRows = [];

    for (const row of rows) {
      const mark = normalizeMark(row.shipping_mark);
      const invoiceNum = String(row.invoice_number || '').trim();
      const cbmVal = parseFloat(row.cbm);

      // Parsear fecha_salida (acepta "2026. 3. 16", "2026-03-16", "16/03/2026")
      let fechaSalida = '';
      try {
        const raw = String(row.fecha_salida || '').trim();
        const cleaned = raw.replace(/[.\s]/g, (m, i) => m === '.' ? '-' : m).replace(/(\d{4})-(\d{1,2})-(\d{1,2})/, (_, y, m, d) => `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`);
        const parsed = new Date(cleaned + 'T12:00:00');
        if (!isNaN(parsed.getTime())) fechaSalida = parsed.toISOString().slice(0, 10);
      } catch (_) {}

      const basePreview = {
        shipping_mark: mark || '',
        invoice_number: invoiceNum,
        cbm: cbmVal,
        fecha_salida: fechaSalida,
        client_name: '',
        status: '',
        reason: ''
      };

      if (!mark) {
        notFound.push({ ...row, reason: 'Shipping mark vacío' });
        previewRows.push({ ...basePreview, status: 'no_encontrado', reason: 'Shipping mark vacío' });
        continue;
      }
      if (!invoiceNum) {
        notFound.push({ ...row, reason: 'Número de recibo vacío' });
        previewRows.push({ ...basePreview, status: 'no_encontrado', reason: 'Número de recibo vacío' });
        continue;
      }
      if (!cbmVal || cbmVal <= 0) {
        notFound.push({ ...row, reason: 'CBM inválido' });
        previewRows.push({ ...basePreview, status: 'no_encontrado', reason: 'CBM inválido' });
        continue;
      }

      const client = clientsByMark[mark];
      if (!client) {
        notFound.push({ ...row, reason: `Shipping mark no encontrado: ${mark}` });
        previewRows.push({ ...basePreview, status: 'no_encontrado', reason: `Shipping mark no encontrado: ${mark}` });
        continue;
      }

      basePreview.client_name = client.full_name || client.email;

      const dupKey = invoiceNum.toLowerCase();
      if (existingByClient[client.email]?.has(dupKey)) {
        skipped.push({ shipping_mark: mark, invoice_number: invoiceNum, cbm: cbmVal, fecha_salida: fechaSalida, client_name: client.full_name || client.email });
        previewRows.push({ ...basePreview, status: 'duplicado' });
        continue;
      }

      // Marcar como existente para evitar duplicados dentro del mismo lote
      existingByClient[client.email].add(dupKey);

      if (dryRun) {
        previewRows.push({ ...basePreview, status: 'nuevo' });
      } else {
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
    }

    // En modo dry_run, devolver solo la vista previa sin crear nada
    if (dryRun) {
      return Response.json({
        total: rows.length,
        rows: previewRows,
        summary: {
          nuevos: previewRows.filter(r => r.status === 'nuevo').length,
          duplicados: previewRows.filter(r => r.status === 'duplicado').length,
          no_encontrados: previewRows.filter(r => r.status === 'no_encontrado').length
        }
      });
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