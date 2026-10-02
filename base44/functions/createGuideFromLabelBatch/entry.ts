import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getClientByEmail } from '../../shared/bultoScan.ts';
import {
  allocateGuideSequence,
  markScansWithGuide,
  nextGuideNumber,
  normCode,
  packageCountOfBulto,
  recomputeGuideTotals,
  unique,
} from '../../shared/dispatchGuideAppend.ts';

// Crea la guía de despacho de un lote de etiquetas: se llama justo después de que la
// impresión del lote se confirmó, nunca al armarlo. Solo entran las cajas del lote que
// todavía no están en otra guía (se devuelven aparte para avisar) y, si el lote ya creó
// su guía antes (reimpresión o reintento), devuelve esa misma guía en vez de una nueva.
//
// Recibe: { client_email, codes: string[] }
// Devuelve: { guide, already, excluded: [{ code, guide_number }] }
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const clientEmail = String(body.client_email || '').trim();
    const codes = unique(
      (Array.isArray(body.codes) ? body.codes : []).map((code: any) => normCode(code)).filter(Boolean)
    );
    if (!clientEmail || !codes.length) {
      return Response.json({ error: 'Falta el cliente o las cajas del lote' }, { status: 400 });
    }

    // Guías que ya contienen alguna caja del lote (esas cajas no se repiten).
    const guides: any[] = await base44.asServiceRole.entities.DispatchGuide
      .filter({ bulto_codes: { $in: codes } }, '-created_date', 50)
      .catch(() => []);
    const coveredBy = new Map();
    (guides || []).forEach((guide: any) => {
      (guide.bulto_codes || []).forEach((code: any) => {
        const key = normCode(code);
        if (key && codes.includes(key) && !coveredBy.has(key)) coveredBy.set(key, guide);
      });
    });

    const excluded = codes
      .filter((code: string) => coveredBy.has(code))
      .map((code: string) => ({ code, guide_number: coveredBy.get(code)?.guide_number || '' }));
    const pendingCodes = codes.filter((code: string) => !coveredBy.has(code));

    // El lote completo ya está en una guía: se devuelve la que ese lote creó.
    if (!pendingCodes.length) {
      const guide = guides?.[0] || null;
      if (!guide) {
        return Response.json(
          { error: 'Las cajas del lote ya están en otras guías', excluded },
          { status: 409 }
        );
      }
      return Response.json({ guide, already: true, excluded });
    }

    const rows: any[] = await base44.asServiceRole.entities.Bulto
      .filter({ label_code: { $in: pendingCodes }, client_email: clientEmail }, '-created_date', 500)
      .catch(() => []);
    const cajas = (rows || [])
      .filter((caja: any) => !!caja?.is_caja)
      .sort(
        (a: any, b: any) =>
          (Number(a.caja_number) || 0) - (Number(b.caja_number) || 0) ||
          String(a.label_code).localeCompare(String(b.label_code))
      );
    if (!cajas.length) {
      return Response.json({ error: 'No se encontraron las cajas del lote' }, { status: 409 });
    }

    const emittedDate = new Date().toISOString();
    const profile: any = await getClientByEmail(base44, clientEmail);
    const snapshot = (cajas.find((c: any) => c.client_snapshot?.full_name)?.client_snapshot || {}) as any;
    const mark = normCode(cajas[0]?.shipping_mark) || normCode(profile?.shipping_mark) || '';

    // Líneas de la guía: cada caja del lote con su X/N, su conteo real de paquetes y su CBM.
    const bultos = cajas.map((caja: any) => ({
      label_code: caja.label_code,
      package_count: packageCountOfBulto(caja),
      registered: true,
      date: emittedDate,
      order_number: (caja.cbm_order_numbers || []).filter(Boolean).join(', '),
      scans: 1,
      is_caja: true,
      caja_number: Number(caja.caja_number) || 0,
      caja_total: Number(caja.caja_total) || 0,
      cbm: Number(caja.cargo_cbm) || 0,
    }));

    const clientGroup = {
      client_key: clientEmail.toLowerCase(),
      client_email: clientEmail,
      client_name: snapshot.full_name || profile?.full_name || clientEmail,
      shipping_mark: mark,
      orders_count: 0,
      client: {
        full_name: snapshot.full_name || profile?.full_name || '',
        email: clientEmail,
        cedula: snapshot.cedula || profile?.cedula || '',
        whatsapp: snapshot.whatsapp || profile?.whatsapp || '',
        address: snapshot.address || profile?.address || '',
        city: snapshot.city || profile?.city || '',
        state: snapshot.state || profile?.state || '',
        shipping_mark: mark || snapshot.shipping_mark || profile?.shipping_mark || '',
      },
      bultos,
      totals: recomputeGuideTotals([{ bultos }]),
    };

    const sequence = await allocateGuideSequence(base44);
    if (sequence === null) {
      return Response.json({ error: 'No se pudo asignar el número de guía, intenta de nuevo' }, { status: 500 });
    }

    const guideNumber = nextGuideNumber(sequence);
    const guide = await base44.asServiceRole.entities.DispatchGuide.create({
      guide_number: guideNumber,
      guide_sequence: sequence,
      emitted_date: emittedDate,
      emitted_by: user.email || '',
      emitted_by_name: user.full_name || '',
      auto_generated: false,
      last_updated_date: emittedDate,
      last_updated_by: user.email || '',
      clients: [clientGroup],
      client_names: unique([clientGroup.client_name]),
      client_emails: unique([clientEmail]),
      shipping_marks: unique([clientGroup.shipping_mark]),
      bulto_codes: bultos.map((b: any) => b.label_code),
      totals: recomputeGuideTotals([clientGroup]),
      dispatch_status: 'emitida',
    });

    // Los escaneos de esas cajas quedan marcados con la guía: no se ofrecen otra vez.
    await markScansWithGuide(base44, {
      codes: bultos.map((b: any) => b.label_code),
      guideId: guide.id,
      guideNumber,
      emittedDate,
    });

    return Response.json({ guide, already: false, excluded });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}