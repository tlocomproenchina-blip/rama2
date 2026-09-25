import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// =====================================================================
// Reporte de facturas PAGADAS cuyos paquetes asociados fueron escaneados
// (received_date) pero aún están en almacén (status no despachado/entregado).
//
// Cruza Invoice (status='pagada') → Consolidation.package_ids / manual_recibos
// → Package (received_date && status en almacén) → datos del cliente.
// =====================================================================

const IN_WAREHOUSE_STATUSES = new Set(['recibido', 'consolidado', 'en_transito', 'disponible']);
const PAGE = 200;
const MAX_PAGES = 50;

async function fetchAllFilter(entity, query, sort) {
  const all = [];
  let skip = 0;
  for (let i = 0; i < MAX_PAGES; i++) {
    const batch = await entity.filter(query, sort, PAGE, skip);
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < PAGE) break;
    skip += PAGE;
  }
  return all;
}

// Fetch all entities for a set of client emails (batched $in on regular field)
async function fetchByClientEmails(entity, clientEmails) {
  const map = new Map();
  for (let i = 0; i < clientEmails.length; i += 50) {
    const batch = clientEmails.slice(i, i + 50);
    let skip = 0;
    for (let j = 0; j < MAX_PAGES; j++) {
      const items = await entity.filter(
        { client_email: { $in: batch } },
        '-created_date',
        PAGE,
        skip
      );
      if (!items || items.length === 0) break;
      for (const it of items) map.set(it.id, it);
      if (items.length < PAGE) break;
      skip += PAGE;
    }
  }
  return map;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // 1. Fetch all paid invoices
    const paidInvoices = await fetchAllFilter(
      base44.asServiceRole.entities.Invoice,
      { status: 'pagada' },
      '-payment_date'
    );
    if (paidInvoices.length === 0) return Response.json({ rows: [] });

    // 2. Collect client emails from paid invoices
    const clientEmails = [...new Set(
      paidInvoices.map((inv) => inv.client_email).filter(Boolean)
    )];

    // 3. Fetch consolidations and packages for those clients only
    const consolidationMap = await fetchByClientEmails(
      base44.asServiceRole.entities.Consolidation,
      clientEmails
    );

    const packageMap = await fetchByClientEmails(
      base44.asServiceRole.entities.Package,
      clientEmails
    );

    // Build tracking_number lookup from fetched packages
    const trackingToPackage = new Map();
    for (const p of packageMap.values()) {
      if (p.tracking_number) {
        trackingToPackage.set(String(p.tracking_number).trim(), p);
      }
    }

    // Fetch CbmIngreso records for the same clients (to cross-reference receipts)
    const cbmIngresoMap = await fetchByClientEmails(
      base44.asServiceRole.entities.CbmIngreso,
      clientEmails
    );

    // Build tracking_number → CbmIngreso lookup
    const trackingToCbmIngreso = new Map();
    for (const ing of cbmIngresoMap.values()) {
      if (Array.isArray(ing.tracking_numbers)) {
        for (const tn of ing.tracking_numbers) {
          const key = String(tn || '').trim();
          if (key) trackingToCbmIngreso.set(key, ing);
        }
      }
    }

    // 4. Build rows — only invoices with at least one package still in warehouse
    const rows = [];
    for (const inv of paidInvoices) {
      const invoicePackages = [];
      const seenIds = new Set();

      // Packages via consolidation
      if (inv.consolidation_id) {
        const cons = consolidationMap.get(inv.consolidation_id);
        if (cons && Array.isArray(cons.package_ids)) {
          for (const pid of cons.package_ids) {
            const pkg = packageMap.get(pid);
            if (pkg && !seenIds.has(pkg.id)) {
              seenIds.add(pkg.id);
              invoicePackages.push(pkg);
            }
          }
        }
      }

      // Packages via manual_recibos tracking_numbers
      if (Array.isArray(inv.manual_recibos)) {
        for (const rec of inv.manual_recibos) {
          if (Array.isArray(rec.tracking_numbers)) {
            for (const tn of rec.tracking_numbers) {
              const key = String(tn || '').trim();
              const pkg = trackingToPackage.get(key);
              if (pkg && !seenIds.has(pkg.id)) {
                seenIds.add(pkg.id);
                invoicePackages.push(pkg);
              }
            }
          }
        }
      }

      // Filter packages still in warehouse (scanned + not dispatched)
      const inWarehouse = invoicePackages.filter(
        (p) => p.received_date && IN_WAREHOUSE_STATUSES.has(p.status)
      );
      if (inWarehouse.length === 0) continue;

      // Last scan date = most recent received_date among in-warehouse packages
      const scanDates = inWarehouse
        .map((p) => (p.received_date ? new Date(p.received_date).getTime() : 0))
        .filter(Boolean);
      const lastScanTs = scanDates.length > 0 ? Math.max(...scanDates) : 0;

      // CbmIngreso receipts: collect IDs of CbmIngreso records whose tracking_numbers
      // intersect with the tracking numbers of the in-warehouse packages
      const inWarehouseTrackings = new Set(
        inWarehouse.map((p) => String(p.tracking_number || '').trim()).filter(Boolean)
      );
      const cbmIngresoIds = new Set();
      for (const tn of inWarehouseTrackings) {
        const ing = trackingToCbmIngreso.get(tn);
        if (ing) cbmIngresoIds.add(ing.id);
      }

      rows.push({
        invoice_id: inv.id,
        invoice_number: inv.invoice_number || '',
        consolidation_tracking: inv.consolidation_tracking || '',
        payment_date: inv.payment_date || '',
        client_email: inv.client_email || '',
        total: Number(inv.total) || 0,
        tracking_numbers: inWarehouse.map((p) => p.tracking_number).filter(Boolean),
        package_count: inWarehouse.length,
        last_scan_date: lastScanTs ? new Date(lastScanTs).toISOString() : '',
        cbm_ingreso_ids: [...cbmIngresoIds],
        client_name: '',
        shipping_mark: '',
        client_whatsapp: '',
        client_cedula: '',
        client_address: '',
        client_city: '',
        client_state: '',
      });
    }

    // 5. Enrich with client data
    const rowEmails = [...new Set(rows.map((r) => r.client_email).filter(Boolean))];
    if (rowEmails.length > 0) {
      try {
        const res = await base44.asServiceRole.functions.invoke('getClientsByEmails', {
          emails: rowEmails,
        });
        const clientsByEmail = res?.clients || res?.data?.clients || {};
        for (const row of rows) {
          const c = clientsByEmail[row.client_email];
          if (c) {
            row.client_name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
            row.shipping_mark = c.shipping_mark || '';
            row.client_whatsapp = c.whatsapp || c.phone || '';
            row.client_cedula = c.cedula || '';
            row.client_address = c.address || '';
            row.client_city = c.city || '';
            row.client_state = c.state || '';
          }
        }
      } catch (_) {
        // Client enrichment is best-effort
      }
    }

    return Response.json({ rows, total: rows.length });
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? error.message : 'Internal Server Error';
    return Response.json({ error: String(message) }, { status: 500 });
  }
}