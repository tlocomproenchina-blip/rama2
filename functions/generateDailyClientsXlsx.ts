import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import ExcelJS from 'npm:exceljs@4.4.0';

function toCaracasNow() {
  // America/Caracas is UTC-4 (no DST). We'll use system UTC and subtract 4h only for labels.
  return new Date();
}

function subtractHours(date, hours) {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}

function safe(v) { return v ?? ''; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Try to get user (may be null when invoked by automation)
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* automation context */ }
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Time window: last 24 hours based on app time (America/Caracas). At 08:00 runs → 08:00 prev day to now
    const now = toCaracasNow();
    const since = subtractHours(now, 24);

    // Fetch users (service role for reliability), then filter by created_date in memory
    const allUsers = await base44.asServiceRole.entities.User.filter({ role: 'user' }, '-created_date', 5000);
    const newUsers = (allUsers || []).filter(u => {
      if (!u.created_date) return false;
      const created = new Date(u.created_date);
      return created >= since && created <= now;
    });

    // Build Excel
    const wb = new ExcelJS.Workbook();
    wb.creator = 'TLEC Logistics';
    wb.created = new Date();
    const ws = wb.addWorksheet('Nuevos Clientes');

    // Header styling
    const headerRow = [
      'Nombre',
      'Apellido',
      'Estado',
      'Ciudad',
      'Dirección',
      'WhatsApp',
      'E-mail',
    ];

    ws.addRow([ 'Información Del Cliente' ]);
    ws.mergeCells(1, 1, 1, headerRow.length);
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E2E' } }; // verde oscuro

    ws.addRow(headerRow);
    ws.getRow(2).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFF0000' } }; // rojo como referencia de la imagen
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B0B0B' } }; // negro
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Column widths
    ws.columns = [
      { key: 'first_name', width: 20 },
      { key: 'last_name', width: 22 },
      { key: 'state', width: 18 },
      { key: 'city', width: 18 },
      { key: 'address', width: 40 },
      { key: 'whatsapp', width: 18 },
      { key: 'email', width: 28 },
    ];

    // Data rows
    for (const u of newUsers) {
      ws.addRow([
        safe(u.first_name),
        safe(u.last_name),
        safe(u.state),
        safe(u.city),
        safe(u.address),
        safe(u.whatsapp),
        safe(u.email),
      ]);
    }

    // Generate XLSX buffer
    const buffer = await wb.xlsx.writeBuffer();
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

    // Upload privately
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const fileName = `nuevos_clientes_${yyyy}-${mm}-${dd}.xlsx`;

    // Create a File for upload
    const file = new File([uint8], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const uploaded = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file });
    const fileUri = uploaded?.file_uri;

    let signedUrl = null;
    if (fileUri) {
      const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 60 * 60 * 24 }); // 24h
      signedUrl = signed?.signed_url || null;
    }

    // Notify admins via email (attachment is not supported by the email integration; include secure link)
    const admins = await base44.asServiceRole.entities.User.list();
    const adminRecipients = (admins || []).filter(a => a.role === 'admin' && a.email);

    const subject = `Nuevos clientes (últimas 24h) - ${yyyy}-${mm}-${dd}`;
    const body = `Hola equipo,\n\nSe generó el reporte diario de clientes nuevos (últimas 24 horas).\nRegistros: ${newUsers.length}.\n\nDescarga el archivo Excel aquí (link válido 24h):\n${signedUrl || 'No disponible'}\n\nHorario de ejecución: 08:00 America/Caracas.\n\n— Reporte automático`;

    for (const admin of adminRecipients) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject,
          body,
          from_name: 'TLEC Logistics',
        });
      } catch (e) {
        console.error('Email error for', admin.email, e);
      }
    }

    return Response.json({ success: true, count: newUsers.length, file_uri: fileUri, signed_url: signedUrl });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});