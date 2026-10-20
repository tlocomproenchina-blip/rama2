// Lógica compartida del escaneo de bultos (almacén de Venezuela).
// Reutilizada por bultoScanLookup, createBultoFromScan, createBulto,
// assignBultoOrderNumbers, getBultoByLabelCode y searchBultoClients para que todos
// apliquen los mismos criterios (deducción del código, snapshot, totales y
// reconocimiento en Venezuela) sin duplicar código.
import { fetchAllFilter } from "./paginatedFetch.ts";

// Código de etiqueta de bulto: {shipping_mark}-B{##}
const LABEL_SUFFIX_RE = /-B\d+$/i;

// Separa un código escaneado en su shipping mark y su número de bulto.
export function deduceLabelParts(labelCode: string) {
  const code = String(labelCode || "").trim();
  const match = code.match(LABEL_SUFFIX_RE);
  if (!match) return { shippingMark: code, bultoNumber: null as number | null };
  const parsed = Number(match[0].replace(/-B/i, ""));
  return {
    shippingMark: code.slice(0, code.length - match[0].length).trim(),
    bultoNumber: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
  };
}

// Datos del cliente que se pueden mostrar sin sesión en la pantalla de escaneo.
export function publicClient(client: any) {
  if (!client) return null;
  return {
    email: client.email || "",
    shipping_mark: client.shipping_mark || "",
    full_name: client.full_name || "",
    cedula: client.cedula || "",
    whatsapp: client.whatsapp || "",
    city: client.city || "",
    state: client.state || "",
  };
}

export async function getClientByEmail(base44: any, email: string) {
  const rows = await base44.asServiceRole.entities.User
    .filter({ email: String(email || "").trim() }, "-created_date", 1)
    .catch(() => []);
  return rows?.[0] || null;
}

// Cliente por shipping mark: primero exacto y, si no aparece, sin distinguir mayúsculas.
export async function getClientByShippingMark(base44: any, shippingMark: string) {
  const mark = String(shippingMark || "").trim();
  if (!mark) return null;
  const exact = await base44.asServiceRole.entities.User
    .filter({ shipping_mark: mark }, "-created_date", 1)
    .catch(() => []);
  if (exact?.[0]) return exact[0];
  const all = await fetchAllFilter(base44.asServiceRole.entities.User, {}, "-created_date");
  const lower = mark.toLowerCase();
  return all.find((u: any) => String(u.shipping_mark || "").toLowerCase() === lower) || null;
}

// Búsqueda parcial (case-insensitive) por shipping mark, email, nombre o cédula.
export async function searchClientsByQuery(base44: any, query: string, limit = 10) {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 2) return [];
  const all = await fetchAllFilter(base44.asServiceRole.entities.User, {}, "-created_date");
  const matches = all.filter((u: any) =>
    String(u.shipping_mark || "").toLowerCase().includes(q) ||
    String(u.email || "").toLowerCase().includes(q) ||
    String(u.full_name || "").toLowerCase().includes(q) ||
    String(u.cedula || "").toLowerCase().includes(q)
  );
  return matches.slice(0, limit).map(publicClient);
}

// Snapshot que se imprime en la etiqueta y queda guardado en el bulto.
export function buildClientSnapshot(client: any, shippingMark: string, fallbackEmail = "") {
  return {
    full_name: client?.full_name || "",
    email: client?.email || fallbackEmail,
    cedula: client?.cedula || "",
    whatsapp: client?.whatsapp || "",
    address: client?.address || "",
    city: client?.city || "",
    state: client?.state || "",
    shipping_mark: client?.shipping_mark || shippingMark || "",
  };
}

// Estado de la factura más reciente del cliente (snapshot del bulto).
export async function latestInvoiceSnapshot(base44: any, clientEmail: string) {
  const invoices = await base44.asServiceRole.entities.Invoice
    .filter({ client_email: clientEmail }, "-invoice_date", 1)
    .catch(() => []);
  const latest = invoices?.[0] || null;
  return {
    invoicePaid: latest?.status === "pagada",
    invoiceStatus: latest?.status || "sin_factura",
    invoiceNumber: latest?.invoice_number || "",
  };
}

// Todos los bultos del cliente reflejan el mismo total.
export async function syncClientBultoTotals(base44: any, clientEmail: string, total: number, existingBultos?: any[]) {
  const bultos = existingBultos || await base44.asServiceRole.entities.Bulto
    .filter({ client_email: clientEmail }, "bulto_number", 500)
    .catch(() => []);
  if (!bultos?.length) return 0;
  const updates = bultos.map((b: any) => ({ id: b.id, total_bultos: total }));
  try {
    await base44.asServiceRole.entities.Bulto.bulkUpdate(updates);
    return updates.length;
  } catch (_) {
    let done = 0;
    for (const u of updates) {
      try {
        await base44.asServiceRole.entities.Bulto.update(u.id, { total_bultos: total });
        done++;
      } catch (_) {}
    }
    return done;
  }
}

// Marca los paquetes como reconocidos en el almacén de Venezuela (fecha + responsable).
// Se ignoran los IDs locales del flujo offline (formato local_*).
export async function markPackagesRecognized(base44: any, packageIds: string[], now: string, assignedBy: string) {
  const ids = (packageIds || []).filter((id: any) => id && !String(id).startsWith("local_"));
  if (!ids.length) return 0;
  try {
    await base44.asServiceRole.entities.Package.bulkUpdate(
      ids.map((id: string) => ({ id, ve_recognized_date: now, ve_recognized_by: assignedBy }))
    );
    return ids.length;
  } catch (_) {
    let done = 0;
    for (const id of ids) {
      try {
        await base44.asServiceRole.entities.Package.update(id, { ve_recognized_date: now, ve_recognized_by: assignedBy });
        done++;
      } catch (_) {}
    }
    return done;
  }
}

// Al armar un bulto en el almacén los paquetes se escanean: el que llegó sin recepción
// registrada queda recibido en ese momento (status 'recibido' + fecha y responsable).
// Los que ya estaban recibidos, o más adelante en su recorrido, conservan su estado y su
// fecha: así la recepción no se cuenta dos veces ni se mueve la fecha con la que entraron.
const WAITING_RECEPTION = ["pre_alerta", "sin_cliente", ""];

export async function markPackagesReceivedIfMissing(
  base44: any,
  packageIds: string[],
  now: string,
  actor: string
) {
  const ids = [
    ...new Set(
      (packageIds || [])
        .map((id: any) => String(id || "").trim())
        .filter((id: string) => id && !id.startsWith("local_"))
    ),
  ];
  if (!ids.length) return 0;

  const pkgs = (await Promise.all(
    ids.map((id: string) => base44.asServiceRole.entities.Package.get(id).catch(() => null))
  )).filter((p: any) => p) as any[];

  const pending = pkgs
    .filter((p) => !p.received_date && WAITING_RECEPTION.includes(String(p.status || "")))
    .map((p) => ({ id: p.id, status: "recibido", received_date: now, received_by: actor }));

  if (!pending.length) return 0;

  try {
    await base44.asServiceRole.entities.Package.bulkUpdate(pending);
    return pending.length;
  } catch (_) {
    let done = 0;
    for (const item of pending) {
      try {
        await base44.asServiceRole.entities.Package.update(item.id, {
          status: item.status,
          received_date: item.received_date,
          received_by: item.received_by,
        });
        done++;
      } catch (_) {}
    }
    return done;
  }
}

// Un código escaneado puede ser la etiqueta del paquete o su tracking.
export async function resolvePackageByCode(base44: any, code: string) {
  const c = String(code || "").trim();
  if (!c) return null;
  const [byLabel, byTracking] = await Promise.all([
    base44.asServiceRole.entities.Package.filter({ label_code: c }, "-created_date", 1).catch(() => []),
    base44.asServiceRole.entities.Package.filter({ tracking_number: c }, "-created_date", 1).catch(() => []),
  ]);
  return byLabel?.[0] || byTracking?.[0] || null;
}

// Bulto que ya contiene el paquete (para no duplicarlo en dos bultos).
export async function findBultoContainingPackage(base44: any, packageId: string) {
  try {
    const rows = await base44.asServiceRole.entities.Bulto.filter({ package_ids: packageId }, "-created_date", 5);
    return (rows || []).find((b: any) => (b.package_ids || []).includes(packageId)) || null;
  } catch (_) {
    return null;
  }
}

// Proyección que consumen las pantallas de escaneo del bulto.
export function bultoScanProjection(bulto: any) {
  const snap = bulto?.client_snapshot || {};
  return {
    id: bulto.id,
    label_code: bulto.label_code,
    shipping_mark: bulto.shipping_mark,
    client_email: bulto.client_email,
    client_snapshot: {
      full_name: snap.full_name || "",
      cedula: snap.cedula || "",
      whatsapp: snap.whatsapp || "",
      address: snap.address || "",
      city: snap.city || "",
      state: snap.state || "",
    },
    bulto_number: bulto.bulto_number,
    total_bultos: bulto.total_bultos,
    status: bulto.status,
    // Los códigos sin registrar cuentan como un paquete más del bulto.
    package_count: ((bulto.package_ids || []).length + (bulto.unregistered_codes || []).length)
      || (bulto.package_trackings || []).length,
    // IDs de los paquetes que van dentro: los usa el armado de cajas al absorberlo.
    package_ids: bulto.package_ids || [],
    package_trackings: bulto.package_trackings || [],
    unregistered_codes: bulto.unregistered_codes || [],
    cbm_order_numbers: bulto.cbm_order_numbers || [],
    order_locked: !!bulto.order_locked,
    order_assigned_by: bulto.order_assigned_by || "",
    // Control de impresiones de etiqueta (la pantalla de escaneo puede imprimir).
    print_count: Number(bulto.print_count || 0),
    reprint_unlocked: !!bulto.reprint_unlocked,
    // Bultos que este bulto absorbió y se eliminaron (historial visible al escanear).
    absorbed_bultos: bulto.absorbed_bultos || [],
  };
}