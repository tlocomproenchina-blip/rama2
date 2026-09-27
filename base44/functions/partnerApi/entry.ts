import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  authenticatePartner,
  companyLabel,
  findBultoForPackage,
  findPackageByTracking,
  normalizeCompanyCode,
  resolveCompanyCodeForClient,
} from '../../shared/companyScope.ts';

// Vía de servicio para las apps secundarias de las empresas socias.
//
// Cada empresa socia tiene su propia llave (PartnerCompany.service_key) y solo
// accede a los datos de su company_code. La app secundaria NUNCA escribe directo
// en la base de datos de esta app: todo pasa por aquí.
//
// Header: x-partner-key: <service_key>   (o body.partner_key)
// Body:   { action, ... }
//
// Acciones:
//   health | company.info
//   client.upsert | client.list
//   prealert.upsert | prealert.list
//   tracking.get | tracking.list | assignment.list
//   bulto.list | invoice.list
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({} as any));
    const key = req.headers.get('x-partner-key') || req.headers.get('x-api-key') || body?.partner_key || '';

    const company = await authenticatePartner(base44, key);
    if (!company) {
      return Response.json({ error: 'Llave de empresa inválida o inactiva' }, { status: 401 });
    }

    const companyCode = normalizeCompanyCode(company.company_code);
    const action = String(body?.action || 'health');

    // Marcar uso de la llave (best-effort, no bloquea la respuesta)
    base44.asServiceRole.entities.PartnerCompany.update(company.id, {
      last_service_use_date: new Date().toISOString(),
    }).catch(() => {});

    if (action === 'health' || action === 'company.info') {
      return Response.json({
        ok: true,
        service: 'partnerApi',
        company_code: companyCode,
        company_name: companyLabel(company),
        app_id: Deno.env.get('BASE44_APP_ID') || null,
        timestamp: new Date().toISOString(),
      });
    }

    // ---------- Clientes de la empresa socia ----------
    if (action === 'client.upsert') {
      const input = body?.client || {};
      const email = String(input.email || '').trim().toLowerCase();
      if (!email) return Response.json({ error: 'client.email es obligatorio' }, { status: 400 });

      const existing = await base44.asServiceRole.entities.PartnerClient.filter(
        { company_code: companyCode, email },
        '-created_date',
        1
      );
      const patch = {
        company_code: companyCode,
        email,
        full_name: input.full_name !== undefined ? String(input.full_name || '') : undefined,
        cedula: input.cedula !== undefined ? String(input.cedula || '') : undefined,
        whatsapp: input.whatsapp !== undefined ? String(input.whatsapp || '') : undefined,
        address: input.address !== undefined ? String(input.address || '') : undefined,
        city: input.city !== undefined ? String(input.city || '') : undefined,
        state: input.state !== undefined ? String(input.state || '') : undefined,
        shipping_mark: input.shipping_mark !== undefined ? String(input.shipping_mark || '') : undefined,
        external_id: input.external_id !== undefined ? String(input.external_id || '') : undefined,
        is_active: input.is_active === undefined ? true : input.is_active !== false,
        source: 'partner_api',
        last_sync_date: new Date().toISOString(),
      };
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));

      if (existing?.[0]) {
        const updated = await base44.asServiceRole.entities.PartnerClient.update(existing[0].id, clean);
        return Response.json({ ok: true, created: false, client: updated });
      }
      const created = await base44.asServiceRole.entities.PartnerClient.create(clean);
      return Response.json({ ok: true, created: true, client: created });
    }

    if (action === 'client.list') {
      const query: any = { company_code: companyCode };
      if (body?.client_email) query.email = String(body.client_email).trim().toLowerCase();
      const rows = await base44.asServiceRole.entities.PartnerClient.filter(query, '-created_date', 200);
      const search = String(body?.search || '').trim().toLowerCase();
      const clients = search
        ? (rows || []).filter((c) =>
            [c.email, c.full_name, c.shipping_mark, c.cedula].some((v) => String(v || '').toLowerCase().includes(search))
          )
        : rows || [];
      return Response.json({ ok: true, count: clients.length, clients });
    }

    // ---------- Pre-alertas ----------
    if (action === 'prealert.upsert') {
      const input = body?.prealert || {};
      const tracking = String(input.tracking_number || '').trim();
      const clientEmail = String(input.client_email || '').trim().toLowerCase();
      if (!tracking) return Response.json({ error: 'prealert.tracking_number es obligatorio' }, { status: 400 });
      if (!clientEmail) return Response.json({ error: 'prealert.client_email es obligatorio' }, { status: 400 });

      const partnerClient = (await base44.asServiceRole.entities.PartnerClient.filter(
        { company_code: companyCode, email: clientEmail },
        '-created_date',
        1
      ))?.[0];

      const shippingMark = String(input.shipping_mark || partnerClient?.shipping_mark || '').trim();
      const base = {
        company_code: companyCode,
        client_email: clientEmail,
        shipping_mark: shippingMark,
        shipping_type: input.shipping_type === 'aereo' ? 'aereo' : 'maritimo',
        risk_category: input.risk_category === 'alto_riesgo' ? 'alto_riesgo' : 'general',
        package_count: Number(input.package_count) > 0 ? Number(input.package_count) : 1,
        description: String(input.description || 'Pre-alerta enviada por la empresa socia'),
      };

      // Idempotencia por tracking + empresa, y reclamo de un huérfano existente.
      const existing = await findPackageByTracking(base44, tracking);
      if (existing) {
        const ownerCode = normalizeCompanyCode(existing.company_code) || (existing.client_email
          ? await resolveCompanyCodeForClient(base44, existing.client_email)
          : '');
        const isForeign = ownerCode && ownerCode !== companyCode;
        if (isForeign) {
          return Response.json(
            { error: 'Ese tracking ya pertenece a otra empresa', company_code: ownerCode },
            { status: 409 }
          );
        }
        const claimOrphan = existing.is_orphan === true || !existing.client_email;
        const nextStatus = claimOrphan
          ? (existing.received_date || existing.warehouse_location_id ? 'recibido' : 'pre_alerta')
          : existing.status;
        const updated = await base44.asServiceRole.entities.Package.update(existing.id, {
          ...base,
          tracking_number: existing.tracking_number || tracking,
          is_orphan: false,
          status: nextStatus,
        });
        return Response.json({ ok: true, created: false, claimed_orphan: claimOrphan, package: updated });
      }

      const created = await base44.asServiceRole.entities.Package.create({
        ...base,
        tracking_number: tracking,
        status: 'pre_alerta',
        is_orphan: false,
      });
      return Response.json({ ok: true, created: true, package: created });
    }

    if (action === 'prealert.list') {
      const query: any = { company_code: companyCode };
      if (body?.status) query.status = String(body.status);
      const rows = await base44.asServiceRole.entities.Package.filter(query, '-created_date', 200);
      return Response.json({ ok: true, count: (rows || []).length, prealerts: rows || [] });
    }

    // ---------- Trackings y estados ----------
    if (action === 'tracking.get') {
      const tracking = String(body?.tracking_number || '').trim();
      if (!tracking) return Response.json({ error: 'tracking_number es obligatorio' }, { status: 400 });
      const pkg = await findPackageByTracking(base44, tracking);
      if (!pkg) return Response.json({ ok: true, found: false });
      const ownerCode = normalizeCompanyCode(pkg.company_code) || (pkg.client_email
        ? await resolveCompanyCodeForClient(base44, pkg.client_email)
        : '');
      if (ownerCode && ownerCode !== companyCode) {
        return Response.json({ error: 'Ese tracking pertenece a otra empresa' }, { status: 403 });
      }
      const bulto = await findBultoForPackage(base44, pkg.id, companyCode);
      return Response.json({
        ok: true,
        found: true,
        package: pkg,
        bulto: bulto
          ? {
              label_code: bulto.label_code,
              bulto_number: bulto.bulto_number,
              status: bulto.status,
              ve_recognized_date: bulto.ve_recognized_date || null,
              cbm_order_numbers: bulto.cbm_order_numbers || [],
            }
          : null,
      });
    }

    if (action === 'tracking.list') {
      const email = String(body?.client_email || '').trim().toLowerCase();
      const query: any = { company_code: companyCode };
      if (email) query.client_email = email;
      else if (body?.status) query.status = String(body.status);
      const rows = await base44.asServiceRole.entities.Package.filter(query, '-created_date', 200);
      return Response.json({ ok: true, count: (rows || []).length, packages: rows || [] });
    }

    if (action === 'assignment.list') {
      const limit = Number(body?.limit) > 0 ? Math.min(Number(body.limit), 200) : 100;
      const rows = await base44.asServiceRole.entities.Package.filter(
        { company_code: companyCode },
        '-updated_date',
        limit
      );
      const assignments = (rows || []).map((p) => ({
        tracking_number: p.tracking_number,
        client_email: p.client_email,
        shipping_mark: p.shipping_mark,
        status: p.status,
        is_orphan: p.is_orphan === true,
        received_date: p.received_date || null,
        ve_recognized_date: p.ve_recognized_date || null,
        dispatched_date: p.dispatched_date || null,
        updated_date: p.updated_date || null,
      }));
      return Response.json({ ok: true, count: assignments.length, assignments });
    }

    // ---------- Bultos y facturas ----------
    if (action === 'bulto.list') {
      const rows = await base44.asServiceRole.entities.Bulto.filter(
        { company_code: companyCode },
        '-created_date',
        200
      );
      return Response.json({ ok: true, count: (rows || []).length, bultos: rows || [] });
    }

    if (action === 'invoice.list') {
      const email = String(body?.client_email || '').trim().toLowerCase();
      const query: any = { company_code: companyCode };
      if (email) query.client_email = email;
      const rows = await base44.asServiceRole.entities.Invoice.filter(query, '-created_date', 200);
      const invoices = (rows || []).map((inv) => ({
        invoice_number: inv.invoice_number,
        client_email: inv.client_email,
        total: inv.total,
        paid_amount: inv.paid_amount || 0,
        balance: Math.max(0, Number(inv.total || 0) - Number(inv.paid_amount || 0)),
        status: inv.status,
        invoice_date: inv.invoice_date || null,
        due_date: inv.due_date || null,
        items: inv.items || [],
      }));
      return Response.json({ ok: true, count: invoices.length, invoices });
    }

    return Response.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}