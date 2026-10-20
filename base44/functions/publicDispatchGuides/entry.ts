import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { fetchAllFilter, errorMessage, normTracking } from '../../shared/paginatedFetch.ts';

// =====================================================================
// Consulta pública de guías de despacho (enlace compartido, solo lectura).
//
// Devuelve las guías agrupadas por cliente, con el mismo contenido que el
// informe administrativo "Contenedores por cliente": por cada cliente, sus
// números de contenedor (N° de orden/envío de sus bultos en las guías), los
// bultos de cada contenedor y una descripción.
//
// Además del nombre y el shipping mark, devuelve los datos de contacto que la
// guía guardó en su snapshot del cliente (correo, cédula, WhatsApp, dirección,
// ciudad y estado) y sus N° de orden/envío, para que el enlace compartido
// muestre la ficha completa de cada cliente.
// =====================================================================

const PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 60;
const CHUNK = 100;
const SIN_CONTENEDOR = /^sin\s+n/i;

const text = (value: any) => String(value ?? '').trim();
const num = (value: any) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const key = (value: any) => text(value).toUpperCase();
const randInt = (max: number) => Math.floor(Math.random() * max);

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole.entities;

    const query = text(body?.query ?? body?.search);
    const from = text(body?.from);
    const to = text(body?.to);
    const status = text(body?.status);
    const limit = Math.min(Math.max(num(body?.limit) || PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const skip = Math.max(num(body?.skip), 0);

    const andClauses: any[] = [];
    if (from || to) {
      const range: any = {};
      if (from) range.$gte = from;
      if (to) range.$lte = to;
      andClauses.push({ emitted_date: range });
    }
    if (status === 'emitida' || status === 'entregada') {
      andClauses.push({ dispatch_status: status });
    }

    const guides = await fetchAllFilter(
      svc.DispatchGuide,
      andClauses.length ? { $and: andClauses } : {},
      '-emitted_date'
    );

    // Agrupación por cliente y, dentro de cada cliente, por contenedor.
    const clientes = new Map<string, any>();
    const etiquetas = new Set<string>();
    const fechasGuia = new Map<string, string>();

    for (const guide of guides) {
      const guideNumber = text((guide as any).guide_number);
      const emittedDate = text((guide as any).emitted_date);
      if (guideNumber && emittedDate) fechasGuia.set(guideNumber, emittedDate);
      for (const client of ((guide as any).clients || [])) {
        const shippingMark = text(client?.shipping_mark) || text(client?.client?.shipping_mark);
        const clientName =
          text(client?.client_name) ||
          text(client?.client?.full_name) ||
          text(client?.client_email) ||
          'Cliente';
        const clientKey = key(shippingMark) || clientName.toLowerCase();
        if (!clientKey) continue;

        if (!clientes.has(clientKey)) {
          clientes.set(clientKey, {
            key: clientKey,
            name: clientName,
            shipping_mark: shippingMark,
            email: '',
            cedula: '',
            whatsapp: '',
            address: '',
            city: '',
            state: '',
            orders: new Set<string>(),
            containers: new Map<string, any>(),
            guides: new Set<string>(),
          });
        }

        const cliente = clientes.get(clientKey);
        if (!cliente.shipping_mark && shippingMark) cliente.shipping_mark = shippingMark;
        if (guideNumber) cliente.guides.add(guideNumber);

        // Ficha del cliente tal como quedó guardada en la guía.
        const ficha = client?.client || {};
        const completar = (campo: string, valor: any) => {
          if (!cliente[campo] && text(valor)) cliente[campo] = text(valor);
        };
        completar('email', client?.client_email || ficha.email);
        completar('cedula', ficha.cedula);
        completar('whatsapp', ficha.whatsapp);
        completar('address', ficha.address);
        completar('city', ficha.city);
        completar('state', ficha.state);

        for (const line of (client?.bultos || [])) {
          const container = text(line?.order_number);
          if (!container || SIN_CONTENEDOR.test(container)) continue;
          cliente.orders.add(container);

          if (!cliente.containers.has(container)) {
            cliente.containers.set(container, { container, labels: new Set<string>(), unlabeled: 0, guides: new Set<string>() });
          }
          const bucket = cliente.containers.get(container);
          const labelCode = key(line?.label_code);
          if (labelCode) {
            bucket.labels.add(labelCode);
            etiquetas.add(labelCode);
          } else {
            bucket.unlabeled += 1;
          }
          if (guideNumber) bucket.guides.add(guideNumber);
        }
      }
    }

    // Descripción de cada bulto: la registrada del bulto o, si no tiene, la de
    // uno de sus productos.
    const todasEtiquetas = [...etiquetas];
    const bultoPorLabel = new Map<string, any>();
    for (let i = 0; i < todasEtiquetas.length; i += CHUNK) {
      const chunk = todasEtiquetas.slice(i, i + CHUNK);
      const bultos = await fetchAllFilter(svc.Bulto, { label_code: { $in: chunk } }, '-created_date');
      for (const bulto of bultos) {
        const label = key((bulto as any).label_code);
        if (!bultoPorLabel.has(label)) bultoPorLabel.set(label, bulto);
      }
    }

    const trackings = [...new Set(
      [...bultoPorLabel.values()].flatMap((bulto: any) =>
        (bulto.package_trackings || []).map((tracking: any) => normTracking(tracking))
      ).filter(Boolean)
    )];
    const descripcionPorTracking = new Map<string, string>();
    for (let i = 0; i < trackings.length; i += CHUNK) {
      const chunk = trackings.slice(i, i + CHUNK);
      const paquetes = await fetchAllFilter(svc.Package, { tracking_number: { $in: chunk } }, '-created_date');
      for (const paquete of paquetes) {
        const description = text((paquete as any).description);
        if (description) descripcionPorTracking.set(normTracking((paquete as any).tracking_number), description);
      }
    }

    const descripcionDeBulto = (label: string): string => {
      const bulto: any = bultoPorLabel.get(label);
      const propia = text(bulto?.description);
      if (propia) return propia;
      const opciones = [...new Set(
        (bulto?.package_trackings || [])
          .map((tracking: any) => descripcionPorTracking.get(normTracking(tracking)))
          .filter(Boolean)
      )];
      if (!opciones.length) return '';
      return opciones[randInt(opciones.length)];
    };

    const clientList = [...clientes.values()].map((cliente) => {
      const containers = [...cliente.containers.values()]
        .map((bucket: any) => {
          const labels = [...bucket.labels].sort();
          const descripciones = [...new Set(labels.map(descripcionDeBulto).filter(Boolean))].slice(0, 10);
          return {
            container: bucket.container,
            bultos: labels.length + bucket.unlabeled,
            description: descripciones.join(' · '),
            guides: [...bucket.guides].sort(),
          };
        })
        .sort((a, b) => String(a.container).localeCompare(String(b.container), 'es', { numeric: true }));

      return {
        key: cliente.key,
        name: cliente.name,
        shipping_mark: cliente.shipping_mark,
        email: cliente.email,
        cedula: cliente.cedula,
        whatsapp: cliente.whatsapp,
        address: cliente.address,
        city: cliente.city,
        state: cliente.state,
        orders: [...cliente.orders].sort((a: string, b: string) => a.localeCompare(b, 'es', { numeric: true })),
        guides: [...cliente.guides].sort(),
        containers,
        totals: {
          containers: containers.length,
          bultos: containers.reduce((sum, row) => sum + row.bultos, 0),
          orders: cliente.orders.size,
        },
      };
    });

    // La búsqueda se resuelve aquí: cliente, shipping mark, contenedor o guía.
    const term = query.toLowerCase();
    const filtered = term
      ? clientList.filter((cliente) =>
          [cliente.name, cliente.shipping_mark, ...cliente.guides, ...cliente.containers.map((row: any) => row.container)]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term))
        )
      : clientList;

    // La guía más reciente va siempre primero: los clientes se ordenan por la
    // fecha de su última guía y cada guía se ofrece con su fecha.
    const ultimaFecha = (cliente: any) =>
      (cliente.guides || []).reduce((max: string, numero: string) => {
        const fecha = fechasGuia.get(numero) || '';
        return fecha > max ? fecha : max;
      }, '');

    filtered.sort((a, b) => ultimaFecha(b).localeCompare(ultimaFecha(a)) || a.name.localeCompare(b.name, 'es'));

    const guideOptions = [...new Set(filtered.flatMap((cliente: any) => cliente.guides || []))]
      .map((numero: string) => ({ number: numero, emitted_date: fechasGuia.get(numero) || '' }))
      .sort(
        (a: any, b: any) =>
          b.emitted_date.localeCompare(a.emitted_date) ||
          b.number.localeCompare(a.number, 'es', { numeric: true })
      );

    const page = filtered.slice(skip, skip + limit);

    return Response.json({
      clients: page,
      guide_options: guideOptions,
      matched: filtered.length,
      has_more: skip + page.length < filtered.length,
      next_skip: skip + page.length,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return Response.json({ error: errorMessage(error) || 'No se pudo consultar las guías' }, { status: 500 });
  }
}