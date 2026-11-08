import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Conciliación entre los registros de paquetes (Package recibidos) y los escaneos
// físicos de bodega (EscaneoBodega) de un período. Cada fuente se cuenta por separado
// y la diferencia se explica tracking por tracking:
//   registros − escaneados = sin escaneo + registros duplicados − recibidos antes del
//                            período − sin recepción − sin registro − códigos del mismo paquete
const SCAN_PAGE = 500;
const SCAN_MAX_PAGES = 20;
const LOOKUP_CHUNK = 100;
const PARALLEL = 5;
const ISSUE_LIMIT = 100;

const norm = (raw: any) => String(raw || '').trim().toUpperCase();
const isUntracked = (t: string) => !t || t.startsWith('(');

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(Math.round(Number(body?.days) || 30), 1), 90);
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // 1) Escaneos físicos del período (paginados).
    const scans: any[] = [];
    let truncated = false;
    for (let page = 0; page < SCAN_MAX_PAGES; page++) {
      const batch = await base44.entities.EscaneoBodega.filter(
        { created_date: { $gte: from } }, '-created_date', SCAN_PAGE, page * SCAN_PAGE,
      );
      scans.push(...(batch || []));
      if (!batch || batch.length < SCAN_PAGE) break;
      if (page === SCAN_MAX_PAGES - 1) truncated = true;
    }

    const byResult: Record<string, number> = {};
    let untracked = 0;
    const tracked = new Map<string, { raw: Set<string>; first: string; last: string; count: number; result: string }>();
    for (const s of scans) {
      byResult[s.result_type || 'otro'] = (byResult[s.result_type || 'otro'] || 0) + 1;
      const key = norm(s.tracking_number);
      if (isUntracked(key)) { untracked++; continue; }
      const entry = tracked.get(key) || { raw: new Set<string>(), first: s.created_date, last: s.created_date, count: 0, result: s.result_type };
      entry.raw.add(String(s.tracking_number).trim());
      entry.count++;
      if (s.created_date < entry.first) entry.first = s.created_date;
      if (s.created_date > entry.last) entry.last = s.created_date;
      tracked.set(key, entry);
    }

    // 2) Registros de paquete de esos trackings (consultas $in por bloques, en paralelo).
    //    Igual que el escaneo: primero el tracking, luego el código de etiqueta TLEC y,
    //    por último, el paquete que el trabajo de escaneo dejó registrado.
    const pkgsByKey = new Map<string, any[]>();
    const variantsOf = (chunk: string[]) => {
      const v = new Set<string>();
      for (const k of chunk) { v.add(k); for (const r of tracked.get(k)!.raw) v.add(r); }
      return [...v];
    };
    const addPkg = (k: string, p: any) => {
      if (!tracked.has(k)) return;
      const list = pkgsByKey.get(k) || [];
      if (!list.some((x) => x.id === p.id)) list.push(p);
      pkgsByKey.set(k, list);
    };
    const inChunks = async (keys: string[], run: (chunk: string[]) => Promise<any[]>) => {
      const out: any[] = [];
      const chunks: string[][] = [];
      for (let i = 0; i < keys.length; i += LOOKUP_CHUNK) chunks.push(keys.slice(i, i + LOOKUP_CHUNK));
      for (let i = 0; i < chunks.length; i += PARALLEL) {
        const results = await Promise.all(chunks.slice(i, i + PARALLEL).map(run));
        results.forEach((rows) => out.push(...(rows || [])));
      }
      return out;
    };
    const missing = () => [...tracked.keys()].filter((k) => !pkgsByKey.has(k));

    const byTracking = await inChunks([...tracked.keys()], (chunk) =>
      base44.entities.Package.filter({ tracking_number: { $in: variantsOf(chunk) } }, '-created_date', 1000));
    byTracking.forEach((p) => addPkg(norm(p.tracking_number), p));

    const byLabel = await inChunks(missing(), (chunk) =>
      base44.entities.Package.filter({ label_code: { $in: variantsOf(chunk) } }, '-created_date', 1000));
    byLabel.forEach((p) => addPkg(norm(p.label_code), p));

    const jobs = await inChunks(missing(), (chunk) =>
      base44.entities.BodegaScanJob.filter({ tracking_number: { $in: variantsOf(chunk) }, package_id: { $nin: [null, ''] } }, '-created_date', 1000));
    const jobKeyByPkg = new Map<string, string>();
    jobs.forEach((j) => jobKeyByPkg.set(j.package_id, norm(j.tracking_number)));
    const byJob = await inChunks([...jobKeyByPkg.keys()], (ids) =>
      base44.entities.Package.filter({ id: { $in: ids } }, '-created_date', 1000));
    byJob.forEach((p) => addPkg(jobKeyByPkg.get(p.id)!, p));

    // 3) Clasificación tracking por tracking.
    const issues: Record<string, any[]> = { scanned_not_received: [], scanned_without_record: [], duplicate_records: [], received_before: [], same_package_codes: [] };
    const totals = { matched: 0, duplicate_records: 0, received_before: 0, scanned_not_received: 0, scanned_without_record: 0, same_package_codes: 0 };
    const withScanIds = new Map<string, string>();
    const push = (bucket: string, item: any) => { if (issues[bucket].length < ISSUE_LIMIT) issues[bucket].push(item); };

    for (const [key, scan] of tracked) {
      const pkgs = pkgsByKey.get(key) || [];
      const base = { tracking: key, scanned_at: scan.last, result_type: scan.result, scans: scan.count };
      if (pkgs.length === 0) {
        totals.scanned_without_record++;
        push('scanned_without_record', base);
        continue;
      }
      const received = pkgs.filter((p) => p.received_date);
      if (received.length === 0) {
        totals.scanned_not_received++;
        push('scanned_not_received', { ...base, package_id: pkgs[0].id, status: pkgs[0].status, client_email: pkgs[0].client_email });
        continue;
      }
      const inPeriod = received.filter((p) => p.received_date >= from);
      if (inPeriod.length === 0) {
        totals.received_before++;
        push('received_before', { ...base, package_id: received[0].id, status: received[0].status, client_email: received[0].client_email });
        continue;
      }
      totals.matched++;
      inPeriod.forEach((p) => {
        const firstKey = withScanIds.get(p.id);
        if (firstKey) push('same_package_codes', { ...base, package_id: p.id, status: `mismo paquete que ${firstKey}`, client_email: p.client_email });
        else withScanIds.set(p.id, key);
      });
      if (inPeriod.length > 1) {
        totals.duplicate_records += inPeriod.length - 1;
        push('duplicate_records', { ...base, package_id: inPeriod[0].id, status: `${inPeriod.length} registros`, client_email: inPeriod.map((p) => p.client_email || 'sin cliente').join(', ') });
      }
    }

    // 4) Registros recibidos en el período (conteo del servidor, sin listar).
    const receivedInPeriod = await base44.entities.Package.count({ received_date: { $gte: from } });
    const withScan = withScanIds.size;
    // Códigos distintos (tracking y etiqueta, por ejemplo) que llevaron al mismo paquete.
    totals.same_package_codes = totals.matched + totals.duplicate_records - withScan;

    return Response.json({
      period: { days, from, to: new Date().toISOString() },
      records: { received_in_period: receivedInPeriod || 0, with_scan: withScan, without_scan: (receivedInPeriod || 0) - withScan },
      scans: {
        total_scans: scans.length,
        unique_trackings: tracked.size,
        repeated_scans: scans.length - untracked - tracked.size,
        untracked,
        by_result: byResult,
        truncated,
      },
      match: totals,
      issues,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('getPackageReconciliation error:', error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}