import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  DEFAULT_COMPANY_CODE,
  resolveCompany,
  resolveCompanyCodeForClient,
} from '../../shared/companyScope.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Solo admin puede asignar huérfanos manualmente
    const isWarehouse = user.role === 'admin' || user.custom_role === 'almacen' || user.custom_role === 'operaciones';
    if (!isWarehouse) {
      return Response.json({ error: 'Forbidden: se requiere rol de almacén o admin' }, { status: 403 });
    }

    const body = await req.json();
    const packageId = String(body.package_id || '').trim();
    const clientEmail = String(body.client_email || '').trim();
    if (!packageId) return Response.json({ error: 'ID de paquete requerido' }, { status: 400 });
    if (!clientEmail) return Response.json({ error: 'Email del cliente requerido' }, { status: 400 });

    const requestedCompany = String(body.company_code || '').trim();

    // Cargar el paquete huérfano
    const pkgs = await base44.asServiceRole.entities.Package.filter({ id: packageId }, '-created_date', 1);
    const pkg = pkgs?.[0];
    if (!pkg) return Response.json({ error: 'Paquete no encontrado' }, { status: 404 });
    if (!pkg.is_orphan) return Response.json({ error: 'Este paquete no es un huérfano' }, { status: 400 });

    // Resolver shipping_mark del cliente si no se provee
    let shippingMark = body.shipping_mark ? String(body.shipping_mark).trim() : null;
    if (!shippingMark) {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ email: clientEmail }, '-created_date', 1);
        shippingMark = users?.[0]?.shipping_mark || null;
      } catch (_) {}
      if (!shippingMark) {
        try {
          const partnerClients = await base44.asServiceRole.entities.PartnerClient.filter(
            { email: clientEmail.toLowerCase() },
            '-created_date',
            1
          );
          shippingMark = partnerClients?.[0]?.shipping_mark || null;
        } catch (_) {}
      }
    }

    // Empresa destino: TLEC CARGO o la empresa socia del cliente (o la elegida a mano)
    let companyCode = '';
    let companyName = 'TLEC CARGO';
    const targetCompany = requestedCompany || await resolveCompanyCodeForClient(base44, clientEmail);
    if (targetCompany) {
      const resolved = await resolveCompany(base44, targetCompany);
      if (!resolved) return Response.json({ error: 'Empresa socia no encontrada' }, { status: 404 });
      companyCode = resolved.company_code === DEFAULT_COMPANY_CODE ? '' : resolved.company_code;
      companyName = resolved.company_name;
    }

    // Si el huérfano ya tiene ubicación física/dimensiones, conservar estado "recibido".
    // Si no, pasa a "pre_alerta" como una pre-alerta normal.
    const wasReceived = !!(pkg.warehouse_location_id || pkg.actual_weight_kg || pkg.received_date);
    const nextStatus = wasReceived ? 'recibido' : 'pre_alerta';

    const trace = `Asignado a ${companyName} por ${user.email} el ${new Date().toISOString()}`;
    const updated = await base44.asServiceRole.entities.Package.update(packageId, {
      client_email: clientEmail,
      shipping_mark: shippingMark || '',
      company_code: companyCode,
      is_orphan: false,
      status: nextStatus,
      shipping_type: body.shipping_type ? (body.shipping_type === 'maritimo' ? 'maritimo' : 'aereo') : pkg.shipping_type || 'aereo',
      risk_category: body.risk_category ? (body.risk_category === 'alto_riesgo' ? 'alto_riesgo' : 'general') : pkg.risk_category || 'general',
      description: body.description ? String(body.description) : 'Pre-alerta rápida',
      reception_notes: [pkg.reception_notes, trace].filter(Boolean).join(' · '),
      reported: true,
    });

    return Response.json({ package: updated, company_code: companyCode, company_name: companyName });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});