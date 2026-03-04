import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import ExcelJS from 'npm:exceljs@4.4.0';

function formatYMDInCaracas(date) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(date); // YYYY-MM-DD
}

function formatHMSInCaracas(date) {
  const p2 = (n) => String(n).padStart(2, '0');
  const z = new Date(date.toLocaleString('en-US', { timeZone: 'America/Caracas' }));
  return `${p2(z.getHours())}${p2(z.getMinutes())}${p2(z.getSeconds())}`;
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

  // Header row (row 2)
  const headerRow = ws.getRow(2);
  headerRow.values = ['estado','ciudad','direccion','nombre','Apellido','Número De Contacto','Email:'];
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFF0000' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
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

    // Permisos: admin o rol con export_data
    let allowed = user.role === 'admin';
    if (!allowed && user.custom_role) {
      try {
        const roles = await base44.entities.RoleConfig.filter({ role_code: user.custom_role, is_active: true });
        allowed = roles.length > 0 ? !!(roles[0]?.permissions?.export_data) : false;
      } catch (_) {}
    }
    if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (!Array.isArray(rows) || rows.length === 0) {
      return Response.json({ error: 'No rows to export' }, { status: 400 });
    }

    const wb = await buildWorkbook(rows);
    const buffer = await wb.xlsx.writeBuffer();

    const now = new Date();
    const ymd = formatYMDInCaracas(now).replaceAll('-', '');
    const hms = formatHMSInCaracas(now);
    const filename = `clientes_seleccion_${ymd}_${hms}.xlsx`;

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