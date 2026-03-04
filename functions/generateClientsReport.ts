import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function formatYMDInCaracas(date) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' });
  // en-CA yields YYYY-MM-DD
  return fmt.format(date);
}

function getWindow8to8Caracas(now = new Date()) {
  // Caracas currently observes UTC-04:00 (no DST). We'll construct explicit offset times.
  const ymd = formatYMDInCaracas(now); // YYYY-MM-DD in Caracas local
  const toLocal = new Date(`${ymd}T08:00:00-04:00`);
  const fromLocal = new Date(toLocal.getTime() - 24 * 60 * 60 * 1000);
  return { from: fromLocal, to: toLocal };
}

function escapeCsvValue(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function buildCsv(rows) {
  const header = ['Nombre','Apellido','Estado','Ciudad','Dirección','WhatsApp','E-mail'];
  const lines = [header.map(escapeCsvValue).join(',')];
  for (const r of rows) {
    lines.push([
      escapeCsvValue(r.first_name || ''),
      escapeCsvValue(r.last_name || ''),
      escapeCsvValue(r.state || ''),
      escapeCsvValue(r.city || ''),
      escapeCsvValue(r.address || ''),
      escapeCsvValue(r.whatsapp || ''),
      escapeCsvValue(r.email || '')
    ].join(','));
  }
  // Add UTF-8 BOM so Excel opens accents correctly
  const csv = '\uFEFF' + lines.join('\n');
  return new TextEncoder().encode(csv);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const { from, to } = getWindow8to8Caracas(new Date());

    // Fetch users (role user) and filter by created_date in the window
    // Use service role to avoid permission issues for large reads
    const allUsers = await base44.asServiceRole.entities.User.filter({ role: 'user' }, '-created_date', 10000);
    const filtered = (allUsers || []).filter(u => {
      const cd = new Date(u.created_date).getTime();
      return cd >= from.getTime() && cd < to.getTime();
    });

    const csvBytes = buildCsv(filtered);

    // Build filename using Caracas dates
    const ymdFrom = formatYMDInCaracas(from).replaceAll('-', '');
    const ymdTo = formatYMDInCaracas(to).replaceAll('-', '');
    const filename = `clientes_nuevos_${ymdFrom}_0800-${ymdTo}_0800.csv`;

    // Upload to private storage for history
    let fileUri = '';
    try {
      const file = new File([csvBytes], filename, { type: 'text/csv' });
      const uploadRes = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file });
      fileUri = uploadRes?.file_uri || '';
    } catch (e) {
      // Continue even if upload fails; download still works
      console.error('UploadPrivateFile failed:', e?.message || e);
    }

    // Save history record
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

        // Keep only latest 30
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

    // Return the CSV as downloadable response
    return new Response(csvBytes, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=${filename}`
      }
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
});