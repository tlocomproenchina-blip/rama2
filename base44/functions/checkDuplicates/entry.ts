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
  for (let i = 0; i < 100; i++) { // safety: max 5000 records
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
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const { action } = payload;

    // ACTION: check single field for duplicates (used in forms)
    if (action === 'check_field') {
      const { field, value, exclude_user_id } = payload;
      
      if (!field || !value) {
        return Response.json({ duplicate: false });
      }

      if (field === 'cedula') {
        const normalized = normalizeCedula(value);
        if (!normalized) return Response.json({ duplicate: false });
        
        // Fetch all users via service role
        const allUsers = await fetchAllPaginated(
          (s, bs) => base44.asServiceRole.entities.User.filter({ role: 'user' }, '-created_date', bs, s),
          50
        );
        
        const matches = allUsers.filter(u => {
          if (exclude_user_id && u.id === exclude_user_id) return false;
          return normalizeCedula(u.cedula) === normalized;
        });
        
        return Response.json({ 
          duplicate: matches.length > 0, 
          count: matches.length,
          matches: matches.map(u => ({ email: u.email, full_name: u.full_name, cedula: u.cedula }))
        });
      }

      if (field === 'whatsapp') {
        const digits = normalizeDigits(value);
        if (!digits) return Response.json({ duplicate: false });
        
        const matches = await base44.asServiceRole.entities.User.filter({ whatsapp_normalized: digits });
        const others = (matches || []).filter(u => u.id !== exclude_user_id);
        
        return Response.json({ 
          duplicate: others.length > 0, 
          count: others.length,
          matches: others.map(u => ({ email: u.email, full_name: u.full_name, whatsapp: u.whatsapp }))
        });
      }

      if (field === 'tracking') {
        const trimmed = String(value).trim();
        if (!trimmed) return Response.json({ duplicate: false });
        
        const matches = await base44.asServiceRole.entities.Package.filter({ tracking_number: trimmed });
        return Response.json({ 
          duplicate: matches.length > 0, 
          count: matches.length,
          matches: matches.map(p => ({ 
            tracking_number: p.tracking_number, 
            client_email: p.client_email, 
            status: p.status,
            shipping_mark: p.shipping_mark
          }))
        });
      }

      return Response.json({ duplicate: false });
    }

    // ACTION: full scan - find all duplicates in system (admin only)
    if (action === 'full_scan') {
      if (user.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }

      // Fetch all clients (paginated with filter for efficiency)
      const clients = await fetchAllPaginated(
        (s, bs) => base44.asServiceRole.entities.User.filter({ role: 'user' }, '-created_date', bs, s),
        50
      );

      // Fetch all packages (paginated)
      const allPackages = await fetchAllPaginated(
        (s, bs) => base44.asServiceRole.entities.Package.list('-created_date', bs, s),
        50
      );

      // Find duplicate cédulas
      const cedulaMap = {};
      clients.forEach(u => {
        const c = normalizeCedula(u.cedula);
        if (!c) return;
        if (!cedulaMap[c]) cedulaMap[c] = [];
        cedulaMap[c].push({ id: u.id, email: u.email, full_name: u.full_name, cedula: u.cedula });
      });
      const duplicateCedulas = Object.entries(cedulaMap)
        .filter(([_, arr]) => arr.length > 1)
        .map(([cedula, users]) => ({ cedula, users, count: users.length }));

      // Find duplicate WhatsApp
      const whatsappMap = {};
      clients.forEach(u => {
        const w = normalizeDigits(u.whatsapp || u.whatsapp_normalized);
        if (!w || w.length < 6) return;
        if (!whatsappMap[w]) whatsappMap[w] = [];
        whatsappMap[w].push({ id: u.id, email: u.email, full_name: u.full_name, whatsapp: u.whatsapp });
      });
      const duplicateWhatsapp = Object.entries(whatsappMap)
        .filter(([_, arr]) => arr.length > 1)
        .map(([phone, users]) => ({ phone, users, count: users.length }));

      // Count packages per client email for SM duplicates
      const packageCountByEmail = {};
      allPackages.forEach(p => {
        const e = (p.client_email || '').toLowerCase();
        if (e) packageCountByEmail[e] = (packageCountByEmail[e] || 0) + 1;
      });

      // Find duplicate shipping marks
      const smMap = {};
      clients.forEach(u => {
        const sm = String(u.shipping_mark || '').trim().toUpperCase();
        if (!sm) return;
        if (!smMap[sm]) smMap[sm] = [];
        smMap[sm].push({ id: u.id, email: u.email, full_name: u.full_name, shipping_mark: u.shipping_mark, whatsapp: u.whatsapp, cedula: u.cedula, created_date: u.created_date, package_count: packageCountByEmail[(u.email || '').toLowerCase()] || 0 });
      });
      const duplicateShippingMarks = Object.entries(smMap)
        .filter(([_, arr]) => arr.length > 1)
        .map(([sm, users]) => ({ shipping_mark: sm, users, count: users.length }));

      // Find duplicate tracking numbers
      const trackingMap = {};
      allPackages.forEach(p => {
        const t = String(p.tracking_number || '').trim().toUpperCase();
        if (!t) return;
        if (!trackingMap[t]) trackingMap[t] = [];
        trackingMap[t].push({ 
          id: p.id, 
          tracking_number: p.tracking_number, 
          client_email: p.client_email, 
          shipping_mark: p.shipping_mark,
          status: p.status,
          created_date: p.created_date
        });
      });
      const duplicateTrackings = Object.entries(trackingMap)
        .filter(([_, arr]) => arr.length > 1)
        .map(([tracking, packages]) => ({ tracking, packages, count: packages.length }));

      // Build client list with shipping mark info
      const clientList = clients.map(u => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        first_name: u.first_name,
        last_name: u.last_name,
        cedula: u.cedula,
        whatsapp: u.whatsapp,
        shipping_mark: u.shipping_mark,
        state: u.state,
        city: u.city,
        address: u.address,
        profile_completed: u.profile_completed,
        created_date: u.created_date
      }));

      return Response.json({
        duplicateCedulas,
        duplicateWhatsapp,
        duplicateShippingMarks,
        duplicateTrackings,
        clientList,
        summary: {
          totalClients: clients.length,
          totalPackages: allPackages.length,
          clientsWithShippingMark: clients.filter(u => !!u.shipping_mark).length,
          clientsWithoutShippingMark: clients.filter(u => !u.shipping_mark).length,
          duplicateCedulaCount: duplicateCedulas.length,
          duplicateWhatsappCount: duplicateWhatsapp.length,
          duplicateShippingMarkCount: duplicateShippingMarks.length,
          duplicateTrackingCount: duplicateTrackings.length
        }
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});