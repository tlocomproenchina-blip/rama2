import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { ROLE_PRESETS, AREA_ROLE_CODES } from '../../shared/roleAreas.ts';
import { fetchAllFilter } from '../../shared/paginatedFetch.ts';
import { caracasRange, parseDates, toMs } from '../../shared/caracasRange.ts';

// Trabajo realizado por cada empleado en un periodo, contado a partir de los
// registros reales (bultos, paquetes, facturas, pagos, tickets...). Cada registro
// se cuenta una sola vez por empleado. Solo cuentan los empleados con área asignada.

const COUNT_KEYS = [
  'bultos_creados', 'cajas_creadas', 'paquetes_empacados', 'paquetes_recibidos',
  'bultos_reconocidos_ve', 'paquetes_despachados', 'revisiones_caja', 'revisiones_con_incidencia',
  'guias_emitidas',
  'facturas_generadas', 'pagos_aprobados', 'facturas_fiscales_emitidas',
  'tickets_asignados', 'tickets_atendidos', 'respuestas_enviadas', 'tickets_cerrados', 'tickets_pendientes',
];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dates = parseDates(body);
    if ('error' in dates) return Response.json({ error: dates.error }, { status: 400 });
    const { dateFrom, dateTo } = dates;
    const { from, to, fromMs, toMs: toLimit } = caracasRange(dateFrom, dateTo);
    const range = { $gte: from, $lt: to };
    const inRange = (v: any) => { const t = toMs(v); return Number.isFinite(t) && t >= fromMs && t < toLimit; };

    const db = base44.asServiceRole.entities;
    const admins = await fetchAllFilter(db.User, { role: 'admin' }, 'created_date');
    const staff = admins.filter((u: any) => u.email && AREA_ROLE_CODES.includes(String(u.custom_role || '').trim().toLowerCase()));

    const rows: Record<string, any> = {};
    const idToEmail: Record<string, string> = {};
    for (const u of staff) {
      const key = String(u.email).toLowerCase();
      const code = String(u.custom_role).trim().toLowerCase();
      rows[key] = {
        email: u.email,
        name: u.full_name || u.email,
        area_code: code,
        area_name: ROLE_PRESETS[code]?.role_name || code,
        counts: Object.fromEntries(COUNT_KEYS.map((k) => [k, 0])),
      };
      if (u.id) idToEmail[String(u.id)] = key;
    }
    const emails = staff.map((u: any) => u.email);
    const ids = Object.keys(idToEmail);
    if (!emails.length) return Response.json({ date: dateFrom, date_to: dateTo, employees: [] });

    const add = (email: any, key: string, n = 1) => {
      const r = rows[String(email || '').toLowerCase()];
      if (r) r.counts[key] += n;
    };

    const [bultos, received, recognized, dispatched, reviews, guides, invoicesById, invoiceLogs, payments, fiscal, ticketsTouched, ticketsPending] = await Promise.all([
      // created_by no se puede filtrar en la consulta: se trae el periodo y se cuenta por empleado.
      fetchAllFilter(db.Bulto, { created_date: range }, 'created_date'),
      fetchAllFilter(db.Package, { received_by: { $in: emails }, received_date: range }, 'received_date'),
      fetchAllFilter(db.Bulto, { ve_recognized_by: { $in: emails }, ve_recognized_date: range }, 've_recognized_date'),
      fetchAllFilter(db.Package, { dispatched_by: { $in: emails }, dispatched_date: range }, 'dispatched_date'),
      fetchAllFilter(db.CajaInventoryReview, { reviewed_by: { $in: emails }, reviewed_date: range }, 'reviewed_date'),
      fetchAllFilter(db.DispatchGuide, { emitted_by: { $in: emails }, emitted_date: range }, 'emitted_date'),
      ids.length ? fetchAllFilter(db.Invoice, { created_by_id: { $in: ids }, created_date: range }, 'created_date') : Promise.resolve([]),
      fetchAllFilter(db.ActivityAuditLog, { entity_name: 'Invoice', action_type: 'create', actor_email: { $in: emails }, created_date: range }, 'created_date'),
      fetchAllFilter(db.InvoicePayment, { approved_by: { $in: emails }, status: 'aprobado', approved_date: range }, 'approved_date'),
      fetchAllFilter(db.FiscalInvoiceRequest, { issued_by: { $in: emails }, issued_date: { $gte: dateFrom, $lte: dateTo } }, 'issued_date'),
      fetchAllFilter(db.SupportTicket, { updated_date: { $gte: from } }, '-updated_date'),
      fetchAllFilter(db.SupportTicket, { assigned_to: { $in: emails }, status: { $in: ['abierto', 'en_proceso'] } }, '-updated_date'),
    ]);

    for (const b of bultos) {
      add(b.created_by, b.is_caja ? 'cajas_creadas' : 'bultos_creados');
      add(b.created_by, 'paquetes_empacados', Array.isArray(b.package_ids) ? b.package_ids.length : 0);
    }
    for (const p of received) add(p.received_by, 'paquetes_recibidos');
    for (const b of recognized) add(b.ve_recognized_by, 'bultos_reconocidos_ve');
    for (const p of dispatched) add(p.dispatched_by, 'paquetes_despachados');
    for (const r of reviews) {
      add(r.reviewed_by, 'revisiones_caja');
      if (r.result === 'recibida_con_incidencia') add(r.reviewed_by, 'revisiones_con_incidencia');
    }
    for (const g of guides) add(g.emitted_by, 'guias_emitidas');

    // Factura generada: la creó el empleado desde su sesión o quedó en la auditoría de actividad. Una sola vez por factura.
    const invoiceOwner: Record<string, string> = {};
    for (const inv of invoicesById) invoiceOwner[inv.id] = idToEmail[String(inv.created_by_id)];
    for (const log of invoiceLogs) if (!invoiceOwner[log.entity_id]) invoiceOwner[log.entity_id] = String(log.actor_email).toLowerCase();
    for (const email of Object.values(invoiceOwner)) add(email, 'facturas_generadas');

    for (const pay of payments) add(pay.approved_by, 'pagos_aprobados');
    for (const f of fiscal) add(f.issued_by, 'facturas_fiscales_emitidas');

    for (const t of ticketsTouched) {
      const assignee = String(t.assigned_to || '').toLowerCase();
      if (rows[assignee]) {
        if (inRange(t.created_date)) add(assignee, 'tickets_asignados');
        if (['resuelto', 'cerrado'].includes(t.status) && inRange(t.resolved_date || t.updated_date)) add(assignee, 'tickets_cerrados');
      }
      const repliedBy = new Set<string>();
      for (const m of t.messages || []) {
        const sender = String(m.sender_email || '').toLowerCase();
        if (!rows[sender] || !m.is_admin || m.is_ai || m.is_system || !inRange(m.timestamp)) continue;
        add(sender, 'respuestas_enviadas');
        repliedBy.add(sender);
      }
      for (const sender of repliedBy) add(sender, 'tickets_atendidos');
    }
    for (const t of ticketsPending) add(t.assigned_to, 'tickets_pendientes');

    const employees = Object.values(rows).map((r: any) => ({
      ...r,
      total: COUNT_KEYS.reduce((sum, k) => sum + (k === 'tickets_pendientes' || k === 'paquetes_empacados' ? 0 : r.counts[k]), 0),
    }));

    return Response.json({ date: dateFrom, date_to: dateTo, employees });
  } catch (error) {
    return Response.json({ error: (error as any).message }, { status: 500 });
  }
}