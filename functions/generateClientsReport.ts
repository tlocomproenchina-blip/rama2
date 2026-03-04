import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import ExcelJS from 'npm:exceljs@4.4.0';

function formatYMDInCaracas(date) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(date); // YYYY-MM-DD
}

function getWindow8to8Caracas(now = new Date()) {
  // Caracas sin DST (UTC-04:00 actualmente)
  const ymd = formatYMDInCaracas(now);
  const toLocal = new Date(`${ymd}T08:00:00-04:00`);
  const fromLocal = new Date(toLocal.getTime() - 24 * 60 * 60 * 1000);
  return { from: fromLocal, to: toLocal };
}

function addBorders(cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: 'FF666666' } },
    left: { style: 'thin', color: { argb: 'FF666666' } },
    bottom: { style: 'thin', color: { argb: 'FF666666' } },
    right: { style: 'thin', color: { argb: 'FF666666' } }
  };
}

async function buildWorkbook(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Clientes');

  // Col widths
  ws.columns = [
    { header: 'estado', key: 'estado', width: 18 },
    { header: 'ciudad', key: 'ciudad', width: 18 },
    { header: 'direccion', key: 'direccion', width: 28 },
    { header: 'nombre', key: 'nombre', width: 18 },
    { header: 'Apellido', key: 'apellido', width: 18 },
    { header: 'Número De Contacto', key: 'contacto', width: 22 },
    { header: 'Email:', key: 'email', width: 28 },
  ];

  // Title merged header (A1:G1)
  ws.mergeCells(1, 1, 1, 7);
  const title = ws.getCell(1, 1);
  title.value = '南方管理公司客户资料\nInformacion Del Cliente';
  title.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  title.font = { name: 'Arial', bold: true, size: 14, color: { argb: 'FF000000' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } }; // light green
  ws.getRow(1).height = 36;
  for (let c = 1; c <= 7; c++) addBorders(ws.getCell(1, c));

  // Header row (row 2) with styles
  const headerRow = ws.getRow(2);
  headerRow.values = ['estado','ciudad','direccion','nombre','Apellido','Número De Contacto','Email:'];
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFF0000' } }; // red text
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } }; // light blue-gray
    addBorders(cell);
  });
  ws.getRow(2).height = 22;

  // Data rows start at row 3
  let r = 3;
  for (const item of rows) {
    const row = ws.getRow(r++);
    row.values = [
      item.state || '',
      item.city || '',
      item.address || '',
      item.first_name || '',
      item.last_name || '',
      item.whatsapp || '',
      item.email || '',
    ];
    row.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 11 };
      cell.alignment = { vertical: 'middle' };
      addBorders(cell);
    });
  }

  return wb;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const { from, to } = getWindow8to8Caracas(new Date());

    // Obtener todos los usuarios (role: user) y filtrar por ventana
    const allUsers = await base44.asServiceRole.entities.User.filter({ role: 'user' }, '-created_date', 10000);
    const filtered = (allUsers || []).filter(u => {
      const cd = new Date(u.created_date).getTime();
      return cd >= from.getTime() && cd < to.getTime();
    });

    const wb = await buildWorkbook(filtered);
    const buffer = await wb.xlsx.writeBuffer();

    // Nombre de archivo con fechas Caracas
    const ymdFrom = formatYMDInCaracas(from).replaceAll('-', '');
    const ymdTo = formatYMDInCaracas(to).replaceAll('-', '');
    const filename = `clientes_nuevos_${ymdFrom}_0800-${ymdTo}_0800.xlsx`;

    // Subir a almacenamiento privado para historial
    let fileUri = '';
    try {
      const file = new File([buffer], filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const uploadRes = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file });
      fileUri = uploadRes?.file_uri || '';
    } catch (e) {
      console.error('UploadPrivateFile failed:', e?.message || e);
    }

    // Guardar historial (mantener 30)
    try {
      if (fileUri) {
        await base44.asServiceRole.entities.ClientExportHistory.create({
          filename,
          file_uri: fileUri,
          from_iso: from.toISOString(),
          to_iso: to.toISOString(),
          record_count: filtered.length,
          triggered_by: user.email,
        });
        const recents = await base44.asServiceRole.entities.ClientExportHistory.filter({}, '-created_date', 200);
        if (Array.isArray(recents) && recents.length > 30) {
          const toDelete = recents.slice(30);
          for (const r of toDelete) {
            await base44.asServiceRole.entities.ClientExportHistory.delete(r.id);
          }
        }
      }
    } catch (e) {
      console.error('Saving history failed:', e?.message || e);
    }

    // Responder con el XLSX directamente
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=${filename}`
      }
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
});