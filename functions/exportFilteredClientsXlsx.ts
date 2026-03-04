import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import ExcelJS from 'npm:exceljs@4.4.0';

function formatStampCaracas(date = new Date()) {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: false }).format(date).replace(':', '');
  return `${d.replaceAll('-', '')}_${t}`;
}

async function buildWorkbook(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Seleccion');

  ws.columns = [
    { header: 'Nombre', key: 'first_name', width: 20 },
    { header: 'apellido', key: 'last_name', width: 20 },
    { header: 'estado', key: 'state', width: 18 },
    { header: 'ciudad', key: 'city', width: 18 },
    { header: 'dirección', key: 'address', width: 30 },
    { header: 'WhatsApp', key: 'whatsapp', width: 20 },
    { header: 'e-mail', key: 'email', width: 30 },
  ];

  // Style header
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.alignment = { horizontal: 'center' };

  // Data
  let r = 2;
  for (const it of rows) {
    const row = ws.getRow(r++);
    row.values = [
      it.first_name || '',
      it.last_name || '',
      it.state || '',
      it.city || '',
      it.address || '',
      it.whatsapp || '',
      it.email || '',
    ];
  }

  return wb;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let allowed = user.role === 'admin';
    if (!allowed && user.custom_role) {
      try {
        const roles = await base44.entities.RoleConfig.filter({ role_code: user.custom_role, is_active: true });
        allowed = roles.length > 0 ? !!(roles[0]?.permissions?.export_data) : false;
      } catch (_) {
        allowed = false;
      }
    }
    if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];

    const wb = await buildWorkbook(rows);
    const buffer = await wb.xlsx.writeBuffer();

    const filename = `clientes_filtrados_${formatStampCaracas()}.xlsx`;
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