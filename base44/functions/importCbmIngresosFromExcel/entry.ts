import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import * as XLSX from 'npm:xlsx@0.18.5';

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

    // Descargar y parsear el Excel/CSV por posición fija de columnas:
    // A=Shipping Mark, B=Orden/Recibo, C=CBM, D=Fecha de salida (datos desde fila 2)
    let rows = [];
    try {
      const fileRes = await fetch(fileUrl);
      if (!fileRes.ok) {
        return Response.json({ error: 'No se pudo descargar el archivo para procesar.' }, { status: 200 });
      }
      const arrayBuffer = await fileRes.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return Response.json({ error: 'El archivo no contiene hojas con datos.' }, { status: 200 });
      }
      const sheet = workbook.Sheets[firstSheetName];
      // header:1 devuelve array de arrays (sin mapear a objetos por nombre de columna)
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
      if (!Array.isArray(rawRows) || rawRows.length < 2) {
        return Response.json({ error: 'El archivo no tiene datos. Recuerda: la fila 1 son los encabezados y los datos comienzan desde la fila 2.' }, { status: 200 });
      }
      // Saltar fila 0 (encabezados) y mapear por posición fija A,B,C,D
      rows = rawRows.slice(1)
        .filter(r => Array.isArray(r) && r.some(c => c !== '' && c !== null && c !== undefined))
        .map(r => ({
          shipping_mark: String(r[0] ?? '').trim(),
          invoice_number: String(r[1] ?? '').trim(),
          cbm: r[2] !== '' && r[2] !== null && r[2] !== undefined ? Number(r[2]) : NaN,
          fecha_salida: r[3] instanceof Date
            ? r[3].toISOString().slice(0, 10)
            : String(r[3] ?? '').trim()
        }));
      if (rows.length === 0) {
        return Response.json({ error: 'No se encontraron filas de datos (fila 2 en adelante).' }, { status: 200 });
      }
    } catch (parseError) {
      return Response.json({ error: 'Error al leer el archivo: ' + (parseError?.message || '') }, { status: 200 });
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