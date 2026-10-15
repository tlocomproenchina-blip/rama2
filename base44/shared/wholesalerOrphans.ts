// Paquetes huérfanos que se comparten con las apps de los mayoristas: la lista
// común de cargas que entraron al almacén sin pre-alerta, tienen foto y siguen sin
// titular. Cada mayorista reconoce las suyas por la foto y las reclama desde su
// propia app, sin que nadie las asigne a mano.
//
// Reglas:
// - Cada conexión solo ve las cargas registradas desde que se creó su conexión: lo
//   anterior a esa fecha no se comparte con su app.
// - Solo se comparten huérfanos SIN titular y con foto: sin foto su app no tiene
//   cómo reconocer la carga.
// - El reclamo solo se cierra para un cliente de ese mismo mayorista, y con una
//   asignación condicional (solo si la carga sigue siendo un huérfano sin titular):
//   dos reclamos al mismo tiempo no la asignan dos veces y el que llega segundo
//   recibe el aviso de que ya no está disponible.
import {
  DEFAULT_CONNECTION_KEY,
  connectionKeyOf,
  formatCaracasDateTime,
  logWholesalerEvent,
  stampOf,
  truncate,
} from './wholesalerCore.ts';
import {
  ORPHAN_ALREADY_CLAIMED,
  buildTrackingCandidates,
  consolidateOrphan,
  findSameShipmentMatches,
  hasReceptionEvidence,
} from './orphanConsolidation.ts';
import { findClientForNotice, packagePhotos } from './wholesalerPackages.ts';
import { confirmReceptionToWholesaler, noticeDeliveredWithPhoto, setOrphanFollowup } from './wholesalerNotify.ts';

// Tope de cargas que se revisan para armar la lista compartida: se lee una ventana
// reciente de huérfanos y de ahí salen los que se comparten de verdad.
const MAX_LIST = 50;
const DEFAULT_LIST = 20;
const CLAIM_SOURCE = 'Reclamado desde la app del mayorista';

// Fecha desde la que esa conexión comparte sus cargas: el momento en que se creó la
// conexión. Sin fecha (conexión recién armada en memoria) no se recorta nada.
function sharedSince(connection: any) {
  return String(connection?.created_date || '').trim();
}

function sinceTime(connection: any) {
  const value = sharedSince(connection);
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
}

// Un huérfano que todavía no tiene titular: nadie lo ha reclamado.
function isUnassignedOrphan(pkg: any) {
  return pkg?.is_orphan === true && !String(pkg?.client_email || '').trim();
}

// Dentro del período que esa conexión comparte con su app.
function withinSharedPeriod(connection: any, pkg: any) {
  const since = sinceTime(connection);
  if (!since) return true;
  const created = new Date(String(pkg?.created_date || '')).getTime();
  if (!Number.isFinite(created)) return true;
  return created >= since;
}

// Se comparte solo lo que su app puede reconocer: carga sin titular, con foto y
// registrada desde la creación de su conexión.
function isShareable(connection: any, pkg: any) {
  if (!isUnassignedOrphan(pkg)) return false;
  if (packagePhotos(pkg).length === 0) return false;
  return withinSharedPeriod(connection, pkg);
}

// Conexiones a las que les aparece esa carga en su lista compartida (la misma
// regla de isShareable): sirve para saber a qué mayoristas se les está ofreciendo
// una carga sin titular, aunque todavía no la hayan reclamado ni consultado.
export function sharedConnectionsFor(connections: any[], pkg: any) {
  return (connections || []).filter((connection: any) => isShareable(connection, pkg));
}

function describeOrphan(pkg: any) {
  const fotos = packagePhotos(pkg);
  return {
    package_id: pkg.id,
    tracking: String(pkg?.tracking_number || ''),
    shipping_mark: String(pkg?.shipping_mark || ''),
    descripcion: String(pkg?.description || ''),
    estado: pkg?.status || null,
    creado: pkg?.created_date || null,
    recibido: pkg?.received_date || null,
    almacen: String(pkg?.warehouse_name || ''),
    ciudad: String(pkg?.warehouse_city || ''),
    peso_kg: Number(pkg?.actual_weight_kg) || 0,
    cbm: Number(pkg?.actual_cbm) || 0,
    fotos,
    fotos_count: fotos.length,
  };
}

// Lista compartida: las cargas sin titular que ese mayorista puede reclamar.
export async function listOrphansForWholesaler(base44: any, connection: any, options: any = {}) {
  const limit = Math.min(MAX_LIST, Math.max(1, Number(options?.limit) || DEFAULT_LIST));
  const since = sharedSince(connection);

  // Se piden los huérfanos del período y el descarte de los que no tienen foto o ya
  // tienen titular se hace aquí: el "con foto" no es un campo que se pueda filtrar.
  const page: any = await base44.asServiceRole.entities.Package.filter(
    { is_orphan: true, ...(since ? { created_date: { $gte: since } } : {}) },
    { sort: '-created_date', limit: MAX_LIST },
  );
  const rows: any[] = Array.isArray(page) ? page : (page?.items || []);
  const compartibles = rows.filter((pkg) => isShareable(connection, pkg));
  const huerfanos = compartibles.slice(0, limit).map(describeOrphan);

  await logWholesalerEvent(base44, {
    event_type: 'huerfano_consultado',
    result: `${huerfanos.length} disponible(s)`,
    detail: truncate(
      `La app del mayorista consultó las cargas sin titular compartidas: ${huerfanos.length} disponible(s) para reclamar`,
      300,
    ),
    ...stampOf(connection),
  });

  return {
    ok: true,
    total: huerfanos.length,
    desde: since || null,
    hay_mas: compartibles.length > limit || rows.length >= MAX_LIST,
    huerfanos,
    mensaje: huerfanos.length
      ? `${huerfanos.length} carga(s) sin titular y con foto, creadas desde tu conexión: reclama la que sea de tu cliente.`
      : 'No hay cargas sin titular para reclamar en este momento.',
  };
}

function escapeRegex(value: string) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// El cliente al que el mayorista le atribuye la carga: tiene que ser uno de los
// suyos (los que su app nos reportó), así ninguna carga termina en el cliente de
// otro mayorista.
async function findOwnClient(base44: any, connection: any, { email, mark }: any) {
  const key = connectionKeyOf(connection);
  const esDeLaConexion = (row: any) =>
    (String(row?.wholesaler_key || '').trim() || DEFAULT_CONNECTION_KEY) === key;

  const buscar = async (query: any) => {
    const rows = await base44.asServiceRole.entities.WholesalerClient
      .filter(query, '-fetched_date', 20)
      .catch(() => []);
    return (rows || []).find(esDeLaConexion) || null;
  };

  if (email) {
    const exacto = await buscar({ email });
    if (exacto) return exacto;
    const sinMayusculas = await buscar({ email: { $regex: `^${escapeRegex(email)}$`, $options: 'i' } });
    if (sinMayusculas) return sinMayusculas;
  }
  if (mark) {
    const porMarca = await buscar({ shipping_mark: mark });
    if (porMarca) return porMarca;
  }
  return null;
}

function claimedAnswer() {
  return {
    ok: false,
    resultado: 'ya_reclamado',
    mensaje: 'Esa carga ya fue reclamada: no está disponible para reclamar.',
  };
}

// Deja el intento de reclamo en el historial de movimientos: así el panel muestra
// qué reclamó cada mayorista y qué quedó rechazado.
async function logClaim(base44: any, connection: any, pkg: any, { result, detail, client_email }: any) {
  await logWholesalerEvent(base44, {
    event_type: 'huerfano_reclamado',
    tracking_number: String(pkg?.tracking_number || ''),
    client_email: client_email || String(pkg?.client_email || ''),
    shipping_mark: String(pkg?.shipping_mark || ''),
    package_id: pkg?.id || null,
    result,
    detail: truncate(detail, 300),
    ...stampOf(connection),
  });
}

function claimAnswer(pkg: any, { titularEmail, aviso, unificado }: any) {
  const fotos = packagePhotos(pkg);
  return {
    ok: true,
    resultado: 'reclamado',
    unificado: unificado === true,
    package_id: pkg.id,
    tracking: String(pkg?.tracking_number || ''),
    client_email: String(pkg?.client_email || titularEmail || ''),
    shipping_mark: String(pkg?.shipping_mark || ''),
    estado: pkg?.status || null,
    fotos,
    fotos_count: fotos.length,
    aviso: {
      enviado: aviso?.enviado === true,
      ya_avisado: aviso?.ya_avisado === true,
      mayorista: String(aviso?.mayorista || ''),
      fotos_count: Number(aviso?.fotos_count) || 0,
      mensaje: String(aviso?.mensaje || ''),
    },
    mensaje: unificado === true
      ? 'La carga quedó asignada a tu cliente y se unificó con la pre-alerta que ya teníamos de ese envío.'
      : 'La carga quedó asignada a tu cliente en TLEC CARGO.',
  };
}

// Reclamo de una carga compartida: la asigna al cliente de ese mayorista y le
// confirma la recepción en su app, con la foto del almacén.
export async function claimOrphanForWholesaler(base44: any, payload: any, connection: any = null) {
  const packageId = String(payload?.package_id || payload?.id || '').trim();
  const email = String(payload?.client_email || '').trim().toLowerCase();
  const mark = String(payload?.shipping_mark || '').trim();

  if (!packageId) {
    return { ok: false, resultado: 'error', mensaje: 'Falta la carga a reclamar.' };
  }
  if (!email && !mark) {
    return {
      ok: false,
      resultado: 'cliente_requerido',
      mensaje: 'Indica a qué cliente tuyo pertenece esa carga: su correo o su shipping mark.',
    };
  }

  const rows = await base44.asServiceRole.entities.Package.filter({ id: packageId }, '-created_date', 1);
  const pkg = rows?.[0];
  if (!pkg) {
    return { ok: false, resultado: 'no_encontrado', mensaje: 'Esa carga no está registrada en TLEC CARGO.' };
  }

  if (!withinSharedPeriod(connection, pkg)) {
    await logClaim(base44, connection, pkg, {
      result: 'fuera_de_periodo',
      detail: 'Intento de reclamo de una carga anterior a la creación de la conexión',
    });
    return {
      ok: false,
      resultado: 'fuera_de_periodo',
      mensaje: 'Esa carga es anterior a la conexión de tu app: no se comparte con tu lista.',
    };
  }

  if (packagePhotos(pkg).length === 0) {
    return {
      ok: false,
      resultado: 'sin_foto',
      mensaje: 'Esa carga todavía no tiene foto del almacén: se comparte cuando ya esté fotografiada.',
    };
  }

  if (!isUnassignedOrphan(pkg)) {
    await logClaim(base44, connection, pkg, {
      result: 'ya_reclamado',
      detail: 'Intento de reclamo de una carga que ya tenía titular',
    });
    return claimedAnswer();
  }

  const client = await findOwnClient(base44, connection, { email, mark });
  if (!client) {
    await logClaim(base44, connection, pkg, {
      result: 'cliente_no_encontrado',
      detail: `El cliente ${email || mark} no está en la lista de clientes de ese mayorista`,
      client_email: email,
    });
    return {
      ok: false,
      resultado: 'cliente_no_encontrado',
      mensaje: 'Ese cliente no está en tu lista: la carga solo se puede reclamar para un cliente tuyo.',
    };
  }

  // Titular de la carga: la cuenta TLEC CARGO del cliente si ya la tiene y, si no,
  // el correo con el que ese mayorista nos reportó a su cliente.
  const cuenta = await findClientForNotice(base44, {
    client_email: String(client.email || email || '').trim(),
    shipping_mark: String(client.shipping_mark || mark || '').trim(),
  });
  const titularEmail = String(cuenta?.email || client.email || email || '').trim();
  const titularMark = String(cuenta?.shipping_mark || client.shipping_mark || mark || '').trim();

  // Si ese cliente ya había declarado el mismo envío (pre-alerta pendiente), se
  // unifica en una sola carga en vez de dejar dos registros del mismo paquete.
  const candidates = buildTrackingCandidates(String(pkg.tracking_number || ''));
  const matches = candidates.length
    ? await findSameShipmentMatches(base44, {
      candidates,
      labelCode: String(pkg.tracking_number || ''),
      excludeId: pkg.id,
    })
    : { pending: [], received: [] };

  const propias = (matches.pending || []).filter(
    (row: any) => String(row?.client_email || '').trim().toLowerCase() === titularEmail.toLowerCase(),
  );

  if (propias.length > 0) {
    try {
      const consolidado = await consolidateOrphan({
        base44,
        orphan: pkg,
        prealert: propias[0],
        shippingMark: titularMark,
      });
      const unificada = consolidado.package || pkg;
      const aviso = await confirmReceptionToWholesaler(base44, unificada, CLAIM_SOURCE);
      const sigueEnLista = !(hasReceptionEvidence(unificada) && noticeDeliveredWithPhoto(aviso));
      await setOrphanFollowup(base44, unificada.id, sigueEnLista);
      await logClaim(base44, connection, unificada, {
        result: 'reclamado',
        client_email: titularEmail,
        detail: `Carga sin titular reclamada desde la app del mayorista para ${titularEmail}: se unificó con la pre-alerta de ese envío`,
      });
      return claimAnswer(unificada, { titularEmail, aviso, unificado: true });
    } catch (err: any) {
      if (err?.message !== ORPHAN_ALREADY_CLAIMED) throw err;
      await logClaim(base44, connection, pkg, {
        result: 'ya_reclamado',
        detail: 'Otro proceso reclamó la carga en el mismo momento',
      });
      return claimedAnswer();
    }
  }

  // Ese tracking ya está registrado como carga recibida: reclamarlo dejaría dos
  // registros del mismo envío, así que se reporta para revisión.
  if ((matches.received || []).length > 0) {
    await logClaim(base44, connection, pkg, {
      result: 'conflicto',
      detail: 'El tracking ya figura como carga recibida en TLEC CARGO: revisar antes de asignarlo',
    });
    return {
      ok: false,
      resultado: 'tracking_ocupado',
      mensaje: 'Ese tracking ya figura como carga recibida en TLEC CARGO: no se pudo reclamar. Escríbenos para revisarlo.',
    };
  }

  const wasReceived = hasReceptionEvidence(pkg);
  const now = new Date().toISOString();
  const patch: Record<string, any> = {
    client_email: titularEmail,
    shipping_mark: titularMark || String(pkg.shipping_mark || ''),
    is_orphan: false,
    status: wasReceived ? 'recibido' : 'pre_alerta',
    reported: true,
    // La carga asignada sigue en la lista de huérfanos del panel hasta que conste
    // recibida y su foto de recepción haya salido al mayorista.
    orphan_pending_reception: true,
    reception_notes: [
      String(pkg.reception_notes || '').trim(),
      `${CLAIM_SOURCE} ${formatCaracasDateTime(now)}: asignada a ${titularEmail}`,
    ].filter(Boolean).join('\n'),
  };
  if (wasReceived && !pkg.received_date) {
    patch.received_date = now;
    patch.received_by = CLAIM_SOURCE;
  }

  // Asignación condicional: solo la toma quien encuentre la carga todavía como
  // huérfano sin titular. Un segundo reclamo del mismo paquete no la sobrescribe.
  await base44.asServiceRole.entities.Package.updateMany({ id: pkg.id, is_orphan: true }, { $set: patch });

  const updatedRows = await base44.asServiceRole.entities.Package.filter({ id: pkg.id }, '-created_date', 1);
  const updated = updatedRows?.[0] || null;
  const quedoMia = !!updated &&
    updated.is_orphan !== true &&
    String(updated.client_email || '').trim().toLowerCase() === titularEmail.toLowerCase();
  if (!quedoMia) {
    await logClaim(base44, connection, pkg, {
      result: 'ya_reclamado',
      client_email: titularEmail,
      detail: 'Otro reclamo tomó la carga en el mismo momento',
    });
    return claimedAnswer();
  }

  // El mayorista ya reclamó la carga: se le confirma en su app, con la foto del
  // almacén, y queda fuera de la lista compartida.
  const aviso = await confirmReceptionToWholesaler(base44, updated, CLAIM_SOURCE);
  const sigueEnLista = !(wasReceived && noticeDeliveredWithPhoto(aviso));
  if (!sigueEnLista) await setOrphanFollowup(base44, updated.id, false);

  await logClaim(base44, connection, updated, {
    result: 'reclamado',
    client_email: titularEmail,
    detail: `Carga sin titular con foto reclamada desde la app del mayorista para ${titularEmail}`,
  });

  return claimAnswer(updated, { titularEmail, aviso, unificado: false });
}