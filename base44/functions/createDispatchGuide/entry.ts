import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  allocateGuideSequence,
  markScansWithGuide,
  nextGuideNumber,
  normCode,
  unique,
} from '../../shared/dispatchGuideAppend.ts';

// Emite una guía de despacho: arma el snapshot definitivo con los bultos
// escaneados que siguen pendientes (getDispatchGuides ya excluye los bultos de
// guías anteriores), le asigna un número correlativo con el contador dedicado
// DispatchGuideCounter y marca esos escaneos para que no vuelvan a ofrecerse
// como pendientes. Devuelve la guía creada y los códigos que ya no estaban
// pendientes (consumidos por otra guía en el mientras).

// Fusiona los grupos devueltos por getDispatchGuides (clientes con email y
// códigos de clientes sin email) sin duplicar bultos.
const mergeClients = (groups: any[]) => {
  const map = new Map();
  (groups || []).forEach((client) => {
    if (!client) return;
    const key = client.client_key || client.client_email || client.client_name;
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, { ...client, bultos: [...(client.bultos || [])] });
      return;
    }
    const existing: any = map.get(key);
    const seen = new Set(existing.bultos.map((b: any) => b.label_code));
    (client.bultos || []).forEach((b: any) => {
      if (!b?.label_code || seen.has(b.label_code)) return;
      seen.add(b.label_code);
      existing.bultos.push(b);
    });
  });

  return [...map.values()]
    .map((client: any) => {
      const bultos = [...(client.bultos || [])].sort((a: any, b: any) =>
        String(a.label_code).localeCompare(String(b.label_code))
      );
      return {
        ...client,
        bultos,
        totals: {
          bultos: bultos.length,
          packages: bultos.reduce((sum: number, b: any) => sum + (Number(b.package_count) || 0), 0),
          scanned: client.totals?.scanned || bultos.length,
        },
      };
    })
    .sort(
      (a: any, b: any) =>
        b.totals.bultos - a.totals.bultos || String(a.client_name).localeCompare(String(b.client_name))
    );
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const from = String(body.from || '').trim();
    const to = String(body.to || '').trim();
    const clientEmails = unique(
      (Array.isArray(body.client_emails) ? body.client_emails : [])
        .map((email: any) => String(email || '').trim())
        .filter(Boolean)
    );
    const requestedCodes = unique(
      (Array.isArray(body.codes) ? body.codes : []).map((code: any) => normCode(code)).filter(Boolean)
    );

    if (!clientEmails.length && !requestedCodes.length) {
      return Response.json({ error: 'Marca al menos un cliente para emitir la guía' }, { status: 400 });
    }

    // La guía se arma con los escaneos que siguen pendientes: getDispatchGuides
    // excluye los bultos que ya pertenecen a una guía emitida.
    const groups: any[] = [];
    const guideFilters: any = { from, to, skip: 0 };

    if (clientEmails.length) {
      const res = await base44.functions.invoke('getDispatchGuides', { ...guideFilters, client_emails: clientEmails });
      const data: any = res?.data || res || {};
      (data.clients || []).forEach((client: any) => groups.push(client));
    }

    if (requestedCodes.length) {
      const res = await base44.functions.invoke('getDispatchGuides', { ...guideFilters, codes: requestedCodes });
      const data: any = res?.data || res || {};
      (data.clients || []).forEach((client: any) => groups.push(client));
    }

    const clients = mergeClients(groups).map((client: any) => ({
      client_key: client.client_key || '',
      client_email: client.client_email || '',
      client_name: client.client_name || '',
      shipping_mark: client.shipping_mark || '',
      orders_count: Number(client.orders_count) || 0,
      client: client.client || {},
      bultos: client.bultos || [],
      totals: client.totals || { bultos: 0, packages: 0, scanned: 0 },
    }));

    const bultoCodes = unique(clients.flatMap((client: any) => client.bultos.map((b: any) => normCode(b.label_code))));

    // Códigos pedidos que ya no están pendientes (se incluyeron en otra guía).
    const included = new Set(bultoCodes);
    const skipped = requestedCodes.filter((code: string) => !included.has(code));

    if (!clients.length || !bultoCodes.length) {
      return Response.json(
        { error: 'Los bultos seleccionados ya no están pendientes de guía', skipped },
        { status: 409 }
      );
    }

    const totals = {
      clients: clients.length,
      bultos: bultoCodes.length,
      packages: clients.reduce((sum: number, c: any) => sum + (Number(c.totals?.packages) || 0), 0),
    };

    // Número correlativo con bloqueo optimista sobre el contador dedicado.
    const sequence = await allocateGuideSequence(base44);

    if (sequence === null) {
      return Response.json({ error: 'No se pudo asignar el número de guía, intenta de nuevo' }, { status: 500 });
    }

    const guideNumber = nextGuideNumber(sequence);
    const emittedDate = new Date().toISOString();

    const guide = await base44.asServiceRole.entities.DispatchGuide.create({
      guide_number: guideNumber,
      guide_sequence: sequence,
      emitted_date: emittedDate,
      emitted_by: user.email || '',
      emitted_by_name: user.full_name || '',
      auto_generated: false,
      last_updated_date: emittedDate,
      last_updated_by: user.email || '',
      filter_from: from,
      filter_to: to,
      clients,
      client_names: unique(clients.map((c: any) => c.client_name).filter(Boolean)),
      client_emails: unique(clients.map((c: any) => c.client_email).filter(Boolean)),
      shipping_marks: unique(clients.map((c: any) => c.shipping_mark).filter(Boolean)),
      bulto_codes: bultoCodes,
      totals,
      dispatch_status: 'emitida',
    });

    // Los escaneos de esos bultos quedan marcados con la guía: salen de la lista
    // de pendientes y no vuelven a ofrecerse para una guía nueva.
    const marked = await markScansWithGuide(base44, {
      codes: bultoCodes,
      guideId: guide.id,
      guideNumber,
      emittedDate,
    });

    return Response.json({ guide, skipped, marked });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}