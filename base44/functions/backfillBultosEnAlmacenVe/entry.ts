import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { fetchAllFilter } from '../../shared/paginatedFetch.ts';

// Corrige bultos marcados como 'despachado' que en realidad nunca fueron despachados.
// Un despacho es real solo si quedó registrado en /WarehouseDispatch:
//   - una orden de despacho (DispatchOrder no cancelada) con alguno de sus trackings,
//   - una foto de salida del almacén (dispatch_photo_url), o
//   - un escaneo de despacho de bulto completo (DispatchScanLog con result 'dispatched').
// Todo lo demás pasa a 'en_almacen_ve', incluidas las etiquetas vacías creadas en lote
// (antes nacían como 'despachado' aunque nunca salieron del almacén).
// Modo previsualización por defecto: solo cambia datos con { apply: true }.
// Idempotente: al volver a correrla no quedan candidatos.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const apply = body?.apply === true;

    const bultos = await fetchAllFilter(base44.asServiceRole.entities.Bulto, {}, '-created_date');
    const despachados = (bultos || []).filter((b: any) => b.status === 'despachado');

    // 1. Trackings con despacho real (órdenes de despacho activas)
    const dispatchedTrackings = new Set<string>();
    const orders = await fetchAllFilter(base44.asServiceRole.entities.DispatchOrder, {}, '-created_date');
    for (const order of orders || []) {
      if (order?.status === 'cancelada') continue;
      const items = Array.isArray(order?.items) ? order.items : [];
      for (const item of items) {
        const tn = String(item?.tracking_number || '').trim();
        if (tn) dispatchedTrackings.add(tn);
      }
    }

    // 2. Bultos escaneados como despachados (etiqueta completa)
    const dispatchedLabels = new Set<string>();
    const scanLogs = await fetchAllFilter(
      base44.asServiceRole.entities.DispatchScanLog,
      { scan_type: 'bulto' },
      '-created_date'
    );
    for (const log of scanLogs || []) {
      if (log?.result === 'dispatched' && log?.bulto_label_code) {
        dispatchedLabels.add(String(log.bulto_label_code).trim());
      }
    }

    const veDay = (value: any) => {
      if (!value) return '';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '';
      try {
        return d.toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
      } catch (_) {
        return '';
      }
    };
    const todayVe = veDay(new Date().toISOString());

    const hasRealDispatch = (b: any) => {
      if (String(b?.dispatch_photo_url || '').trim()) return true;
      const label = String(b?.label_code || '').trim();
      if (label && dispatchedLabels.has(label)) return true;
      const trackings = Array.isArray(b?.package_trackings) ? b.package_trackings : [];
      return trackings.some((t: any) => dispatchedTrackings.has(String(t || '').trim()));
    };

    const candidates = despachados.filter((b: any) => !hasRealDispatch(b));
    const withPackages = candidates.filter((b: any) => (b.package_ids || []).length > 0).length;
    const dates = candidates.map((b: any) => b.created_date).filter(Boolean).sort();

    const summary = {
      total_despachados: despachados.length,
      to_fix: candidates.length,
      real_dispatch: despachados.length - candidates.length,
      with_packages: withPackages,
      empty: candidates.length - withPackages,
      scanned_today: candidates.filter((b: any) => veDay(b.ve_recognized_date) === todayVe).length,
      from_date: dates[0] || '',
      to_date: dates[dates.length - 1] || '',
      examples: candidates.slice(0, 8).map((b: any) => ({
        label_code: b.label_code || '',
        client_name: b.client_snapshot?.full_name || b.client_email || '',
        created_date: b.created_date || '',
        package_count: (b.package_ids || []).length || (b.package_trackings || []).length,
        empty: !(b.package_ids || []).length && !(b.package_trackings || []).length,
        scanned_today: veDay(b.ve_recognized_date) === todayVe,
      })),
    };

    if (!apply) {
      return Response.json({ success: true, preview: true, ...summary });
    }

    // 3. Corregir: 'despachado' → 'en_almacen_ve'
    let updated = 0;
    for (let i = 0; i < candidates.length; i += 200) {
      const batch = candidates.slice(i, i + 200);
      try {
        await base44.asServiceRole.entities.Bulto.bulkUpdate(
          batch.map((b: any) => ({ id: b.id, status: 'en_almacen_ve' }))
        );
        updated += batch.length;
      } catch (_) {
        for (const b of batch) {
          try {
            await base44.asServiceRole.entities.Bulto.update(b.id, { status: 'en_almacen_ve' });
            updated++;
          } catch (_) {}
        }
      }
    }

    // 4. Paquetes de esos bultos que hubieran quedado en 'despachado' vuelven a 'recibido'
    const packageIds = new Set<string>();
    for (const b of candidates) {
      const pids = Array.isArray(b.package_ids) ? b.package_ids : [];
      for (const pid of pids) {
        if (pid && !String(pid).startsWith('local_')) packageIds.add(String(pid));
      }
    }

    let packagesReverted = 0;
    if (packageIds.size > 0) {
      const despachadosPkgs = await fetchAllFilter(
        base44.asServiceRole.entities.Package,
        { status: 'despachado' },
        '-created_date'
      );
      const toRevert = (despachadosPkgs || []).filter((p: any) => packageIds.has(p.id));
      for (let i = 0; i < toRevert.length; i += 200) {
        const batch = toRevert.slice(i, i + 200);
        try {
          await base44.asServiceRole.entities.Package.bulkUpdate(
            batch.map((p: any) => ({
              id: p.id,
              status: 'recibido',
              dispatched_date: null,
              dispatched_by: null,
            }))
          );
          packagesReverted += batch.length;
        } catch (_) {
          for (const p of batch) {
            try {
              await base44.asServiceRole.entities.Package.update(p.id, {
                status: 'recibido',
                dispatched_date: null,
                dispatched_by: null,
              });
              packagesReverted++;
            } catch (_) {}
          }
        }
      }
    }

    return Response.json({
      success: true,
      preview: false,
      updated,
      packages_reverted: packagesReverted,
      ...summary,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}