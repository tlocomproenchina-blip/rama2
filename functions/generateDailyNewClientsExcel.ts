import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import * as XLSX from 'npm:xlsx@0.18.5';

function toYYYYMMDD(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Best-effort auth (automation may have no user)
    try { await base44.auth.me(); } catch (_) {}

    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const startISO = start.toISOString();
    const endISO = now.toISOString();

    // Fetch admins (recipients)
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const recipients = admins.map(a => a.email).filter(Boolean);

    // Fetch users created in last 24h
    // Prefer date-range filter; platform typically supports $gte/$lt
    let newUsers = await base44.asServiceRole.entities.User.filter({
      created_date: { $gte: startISO, $lt: endISO }
    }, '-created_date');

    // Ensure array
    newUsers = Array.isArray(newUsers) ? newUsers : [];

    // Build worksheet: headers requested: Estado, ciudad, direccion, WhatsApp, email
    const header = ['estado', 'ciudad', 'direccion', 'WhatsApp', 'email'];
    const rows = newUsers.map(u => [
      u.state || '',
      u.city || '',
      u.address || '',
      u.whatsapp || u.phone || '',
      u.email || ''
    ]);

    const aoa = [header, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Optional: set column widths for readability
    const colWidths = [14, 16, 30, 18, 28].map(w => ({ wch: w }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes 24h');

    const xlsxBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const dateTag = toYYYYMMDD(now);
    const fileName = `nuevos_clientes_${dateTag}_2200.xlsx`;

    // Upload privately and create signed URL
    const uploadRes = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file: blob });
    const fileUri = uploadRes?.file_uri;

    const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri: fileUri,
      expires_in: 604800 // 7 days
    });

    const link = signed?.signed_url;

    // Send email to all admins
    const subject = `Nuevos clientes (últimas 24h) - ${dateTag} 22:00`;
    const body = `Hola equipo,\n\nSe generó el Excel con los clientes registrados en las últimas 24 horas (ventana 22:00→22:00).\nRegistros: ${rows.length}.\n\nDescarga segura (expira en 7 días):\n${link}\n\nSaludos,\nSistema TLEC`;

    await Promise.all(
      recipients.map(to => base44.asServiceRole.integrations.Core.SendEmail({
        from_name: 'TLEC Logistics',
        to,
        subject,
        body
      }))
    );

    return Response.json({ ok: true, count: rows.length, file_url: link });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});