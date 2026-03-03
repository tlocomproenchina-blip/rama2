import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import * as XLSX from 'npm:xlsx@0.18.5';

// Time window helpers for 22:00 America/Caracas cutoff
const TZ_CARACAS = 'America/Caracas';
const dtfCaracas = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ_CARACAS,
  hour12: false,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});
function partsInCaracas(d) {
  const parts = Object.fromEntries(dtfCaracas.formatToParts(d).map(p => [p.type, p.value]));
  return { y: +parts.year, m: +parts.month, d: +parts.day, H: +parts.hour, M: +parts.minute, S: +parts.second };
}
function dateAtCaracasUTC(y, m, d, H = 0, M = 0, S = 0) {
  // Trick to get UTC instant for a given wall time in a specific TZ
  const guess = new Date(Date.UTC(y, m - 1, d, H, M, S));
  const p = partsInCaracas(guess);
  const asUTC = Date.UTC(p.y, p.m - 1, p.d, p.H, p.M, p.S);
  const desired = Date.UTC(y, m - 1, d, H, M, S);
  const diff = desired - asUTC; // tz offset at that date
  return new Date(guess.getTime() - diff);
}
function getCaracasWindow(now = new Date()) {
  const pn = partsInCaracas(now);
  // Determine END = 22:00 local (today if now>=22:00, else yesterday)
  let endY = pn.y, endM = pn.m, endD = pn.d;
  if (pn.H < 22) {
    // Move one day back in Caracas
    const todayStartUTC = dateAtCaracasUTC(pn.y, pn.m, pn.d, 0, 0, 0);
    const yestUTC = new Date(todayStartUTC.getTime() - 24 * 3600 * 1000);
    const yp = partsInCaracas(yestUTC);
    endY = yp.y; endM = yp.m; endD = yp.d;
  }
  const endUTC = dateAtCaracasUTC(endY, endM, endD, 22, 0, 0);
  const startUTC = new Date(endUTC.getTime() - 24 * 3600 * 1000);
  return { startISO: startUTC.toISOString(), endISO: endUTC.toISOString(), endLocalY: endY, endLocalM: endM, endLocalD: endD };
}

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

    const { startISO, endISO, endLocalY, endLocalM, endLocalD } = getCaracasWindow(new Date());

    // Fetch admins (recipients)
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const recipients = admins.map(a => a.email).filter(Boolean);

    // Fetch users created in last 24h
    // Prefer date-range filter; platform typically supports $gte/$lt
    let newUsers = await base44.asServiceRole.entities.User.filter({
      role: 'user',
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

    const dateTag = `${endLocalY}${String(endLocalM).padStart(2,'0')}${String(endLocalD).padStart(2,'0')}`;
    const fileName = `nuevos_clientes_${dateTag}_2200.xlsx`;

    // Create a File object for upload (better metadata compatibility)
    const file = new File([xlsxBuffer], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // Upload privately and create signed URL
    const uploadRes = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file });
    const fileUri = uploadRes?.file_uri;

    const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri: fileUri,
      expires_in: 604800 // 7 days
    });

    const link = signed?.signed_url;

    // Send email to all admins
    const subject = `Nuevos clientes (últimas 24h) - ${dateTag} 22:00 Caracas`;
    const body = `Hola equipo,\n\nSe generó el Excel con los clientes registrados en las últimas 24 horas (ventana 22:00→22:00 America/Caracas).\nRegistros: ${rows.length}.\n\nDescarga segura (expira en 7 días):\n${link}\n\nSaludos,\nSistema TLEC`;

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