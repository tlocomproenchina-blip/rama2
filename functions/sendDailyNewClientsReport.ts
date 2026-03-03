import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import * as XLSX from 'npm:xlsx@0.18.5';

function pad(n) { return String(n).padStart(2, '0'); }

function getCaracasTodayYMD() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const str = fmt.format(new Date()); // YYYY-MM-DD
  const [y, m, d] = str.split('-').map(Number);
  return { y, m, d };
}

function getYesterdayRangeInUTC() {
  const msHour = 60 * 60 * 1000;
  const { y, m, d } = getCaracasTodayYMD();
  const todayStartCaracas = new Date(`${y}-${pad(m)}-${pad(d)}T00:00:00-04:00`);
  const start = new Date(todayStartCaracas.getTime() - 24 * msHour);
  const end = new Date(todayStartCaracas.getTime() - 1);
  return { start, end };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Resolve recipients (service role)
    const recipients = await base44.asServiceRole.entities.ReportRecipient.filter({ active: true });
    const emails = (recipients || []).length > 0 ? recipients.map(r => r.email) : ['tleccargo@gmail.com'];

    // Time range: full calendar day of "yesterday" in Caracas
    const { start, end } = getYesterdayRangeInUTC();

    // Fetch users (service role). We'll filter by created_date range.
    const allUsers = await base44.asServiceRole.entities.User.list();
    const newUsers = (allUsers || []).filter(u => {
      if (!u?.created_date) return false;
      const cd = new Date(u.created_date);
      return cd >= start && cd <= end;
    });

    // Build rows for Excel
    const headers = [
      'Email', 'Nombre', 'Registrado (Caracas)', 'WhatsApp', 'Telefono', 'Estado', 'Ciudad', 'Direccion', 'ShippingMark'
    ];

    const rows = newUsers.map(u => ({
      Email: u.email || '',
      Nombre: (u.full_name || `${u.first_name || ''} ${u.last_name || ''}`).trim(),
      'Registrado (Caracas)': new Date(u.created_date).toLocaleString('es-VE', { timeZone: 'America/Caracas' }),
      WhatsApp: u.whatsapp || '',
      Telefono: u.phone || '',
      Estado: u.state || '',
      Ciudad: u.city || '',
      Direccion: u.address || '',
      ShippingMark: u.shipping_mark || ''
    }));

    // Create worksheet with enforced header order
    let ws = XLSX.utils.aoa_to_sheet([headers]);
    for (const r of rows) {
      XLSX.utils.sheet_add_aoa(ws, [[
        r.Email, r.Nombre, r['Registrado (Caracas)'], r.WhatsApp, r.Telefono, r.Estado, r.Ciudad, r.Direccion, r.ShippingMark
      ]], { origin: -1 });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes Nuevos');

    const ab = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const bytes = new Uint8Array(ab);

    // Filename with yesterday date (Caracas)
    const { y, m, d } = getCaracasTodayYMD();
    const todayStartCaracas = new Date(`${y}-${pad(m)}-${pad(d)}T00:00:00-04:00`);
    const yesterday = new Date(todayStartCaracas.getTime() - 24 * 60 * 60 * 1000);
    const yyyy = yesterday.getUTCFullYear();
    const mm = pad(yesterday.getUTCMonth() + 1);
    const dd = pad(yesterday.getUTCDate());
    const fileName = `clientes_nuevos_${yyyy}${mm}${dd}.xlsx`;

    // Upload to private storage and get 7-day signed URL
    const file = new File([bytes], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file });
    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 7 * 24 * 60 * 60 });

    // Compose email
    const dateLabel = new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: 'short', year: 'numeric' }).format(yesterday);
    const subject = `Reporte diario de nuevos clientes - ${dateLabel}`;
    const total = rows.length;
    const body = `Hola,\n\nAdjunto el reporte de clientes registrados ayer (${dateLabel}).\n\nCantidad: ${total}\nDescargar Excel (válido 7 días): ${signed_url}\n\nSaludos,\nTLEC Logistics`;

    // Send to each recipient
    for (const to of emails) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to,
        subject,
        body,
        from_name: 'TLEC Logistics'
      });
    }

    return Response.json({ ok: true, recipients: emails, count: total, signed_url }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});