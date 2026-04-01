import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeCedula(value) {
  return String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
}

async function fetchAllPaginated(fetchFn, batchSize = 50) {
  let all = [];
  let skip = 0;
  for (let i = 0; i < 100; i++) {
    const batch = await fetchFn(skip, batchSize);
    if (!batch || batch.length === 0) break;
    all = all.concat(batch);
    skip += batch.length;
    if (batch.length < batchSize) break;
  }
  return all;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const { event, data, old_data } = payload;

    if (!event || !data) {
      return Response.json({ skipped: true, reason: 'no event/data' });
    }

    const entityName = event.entity_name;
    const eventType = event.type;
    const entityId = event.entity_id;

    // ─── PACKAGE CREATE: check duplicate tracking ───
    if (entityName === 'Package' && eventType === 'create') {
      const tracking = String(data.tracking_number || '').trim();
      if (!tracking) return Response.json({ skipped: true, reason: 'no tracking' });

      // Search for other packages with same tracking
      const matches = await base44.asServiceRole.entities.Package.filter({ tracking_number: tracking });
      const others = (matches || []).filter(p => p.id !== entityId);

      if (others.length > 0) {
        // Flag the package as reported
        await base44.asServiceRole.entities.Package.update(entityId, { reported: true });

        // Notify admins
        const existing = others[0];
        await base44.asServiceRole.entities.Notification.create({
          user_email: 'admin',
          title: '⚠️ Tracking duplicado detectado',
          message: `El tracking ${tracking} fue registrado para ${data.client_email} pero ya existía para ${existing.client_email} (estado: ${existing.status}). Se marcó como reportado.`,
          type: 'system',
          priority: 'high',
          icon: 'alert',
          reference_id: entityId,
          entity_type: 'Package'
        });

        // Also notify all admin users
        const allUsers = await fetchAllPaginated(
          (s, bs) => base44.asServiceRole.entities.User.filter({ role: 'admin' }, '-created_date', bs, s),
          50
        );
        const admins = allUsers;
        for (const admin of admins) {
          await base44.asServiceRole.entities.Notification.create({
            user_email: admin.email,
            title: '⚠️ Tracking duplicado detectado',
            message: `El tracking ${tracking} (${data.client_email}) ya existe para ${existing.client_email}. Revisión requerida.`,
            type: 'system',
            priority: 'high',
            icon: 'alert',
            reference_id: entityId,
            entity_type: 'Package'
          });
        }

        return Response.json({ duplicate: true, tracking, flagged: true });
      }

      return Response.json({ duplicate: false });
    }

    // ─── USER UPDATE: check duplicate cédula & whatsapp ───
    if (entityName === 'User' && eventType === 'update') {
      const issues = [];

      // Check cédula change
      const newCedula = normalizeCedula(data.cedula);
      const oldCedula = normalizeCedula(old_data?.cedula);
      if (newCedula && newCedula !== oldCedula) {
        const allUsersCed = await fetchAllPaginated(
          (s, bs) => base44.asServiceRole.entities.User.filter({ role: 'user' }, '-created_date', bs, s),
          50
        );
        const cedulaMatches = allUsersCed.filter(u => u.id !== entityId && normalizeCedula(u.cedula) === newCedula);
        if (cedulaMatches.length > 0) {
          issues.push(`Cédula ${data.cedula} ya registrada por ${cedulaMatches.map(u => u.email).join(', ')}`);
        }
      }

      // Check WhatsApp change
      const newWa = normalizeDigits(data.whatsapp);
      const oldWa = normalizeDigits(old_data?.whatsapp);
      if (newWa && newWa.length >= 6 && newWa !== oldWa) {
        const allUsersWa = await fetchAllPaginated(
          (s, bs) => base44.asServiceRole.entities.User.filter({ role: 'user' }, '-created_date', bs, s),
          50
        );
        const waMatches = allUsersWa.filter(u => u.id !== entityId && normalizeDigits(u.whatsapp) === newWa);
        if (waMatches.length > 0) {
          issues.push(`WhatsApp ${data.whatsapp} ya registrado por ${waMatches.map(u => u.email).join(', ')}`);
        }
      }

      if (issues.length > 0) {
        // Notify admins about the duplicates found
        const allUsersNotify = await fetchAllPaginated(
          (s, bs) => base44.asServiceRole.entities.User.filter({ role: 'admin' }, '-created_date', bs, s),
          50
        );
        const admins = allUsersNotify;

        for (const admin of admins) {
          await base44.asServiceRole.entities.Notification.create({
            user_email: admin.email,
            title: '⚠️ Datos duplicados detectados',
            message: `Usuario ${data.email || data.full_name} actualizó datos con conflictos:\n${issues.join('\n')}`,
            type: 'system',
            priority: 'high',
            icon: 'alert',
            reference_id: entityId,
            entity_type: 'System'
          });
        }

        return Response.json({ duplicates_found: true, issues });
      }

      return Response.json({ duplicates_found: false });
    }

    return Response.json({ skipped: true, reason: 'unhandled entity/event' });
  } catch (error) {
    console.error('autoCheckDuplicates error:', error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});