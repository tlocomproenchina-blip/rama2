// Registro de una captura del almacén de China en el sistema.
//
// Este módulo es el que decide qué pasa con una carga capturada. La regla es una sola:
// no inventar un huérfano. Por eso el código que llegó se valida contra los registros
// existentes antes de dar de alta nada:
//
//   1. Si el código leído encuentra el envío (el tracking con sus variantes de
//      sub-tracking, o el código de una etiqueta TLEC) la carga queda recibida.
//   2. Si el código no encuentra nada pero la lectura es confiable (código 2D, o 1D
//      con verificación propia, y con forma de tracking) la carga entró sin que nadie
//      la declarara: queda huérfana con ese tracking.
//   3. Si la lectura no es confiable se lee la etiqueta con visión (OpenAI y, si no
//      responde, Gemini): un tracking leído por IA también registra la carga.
//   4. Si al final no hay ningún tracking, la captura queda pendiente de
//      identificación: no se crea un huérfano sin código.
//
// Un solo motor, usado por el procesador de la cola de capturas.
//
// Las búsquedas y la vinculación con pre-alertas son las de siempre: variantes del
// sub-tracking para no duplicar el mismo envío, y vinculación automática solo con una
// pre-alerta pendiente y de un único cliente.
import { isProductCodeShape, isTrackingShape } from './barcodeDecode.ts';
import {
  absorbIntoOrphan,
  buildTrackingCandidates,
  linkOrphanToPrealert,
} from './orphanConsolidation.ts';
import { extractTrackingWithAI } from './visionTracking.ts';
import { confirmReceptionToWholesaler, noticeDeliveredWithPhoto, setOrphanFollowup } from './wholesalerNotify.ts';

// Aviso al mayorista titular de esa carga, en su app, con la foto del almacén.
// Sale solo, sin confirmación de nadie, y también cuando la carga entró como
// huérfana: el titular se reconoce en el contexto de ese mayorista, no por tener
// cuenta en TLEC CARGO. Un fallo de conexión no rompe el registro: el aviso queda
// pendiente y se reintenta en el corte siguiente.
export async function notifyWholesalerReception(base44: any, pkg: any, photoUrl: any, now: string, by: string) {
  if (!pkg?.id) return;
  try {
    const received = {
      ...pkg,
      status: 'recibido',
      received_date: now,
      package_image_url: photoUrl || pkg.package_image_url || null,
      package_image_urls: photoUrl ? [photoUrl] : (pkg.package_image_urls || []),
    };
    const aviso = await confirmReceptionToWholesaler(base44, received, by);
    if (noticeDeliveredWithPhoto(aviso)) await setOrphanFollowup(base44, pkg.id, false);
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// El código leído: normalización y búsqueda del envío
// ---------------------------------------------------------------------------

// El código llega con espacios o comillas de la lectura: se limpia antes de buscar.
function normalizeCode(raw: any): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/^["'`]+|["'`]+$/g, '');
}

// Los candidatos se consultan en la caja en que llegaron, en mayúsculas y en
// minúsculas: la lectura puede venir en minúsculas aunque el registro esté en
// mayúsculas. Se agrupan para resolverlo en pocas búsquedas.
function caseGroups(codes: string[]): string[][] {
  const groups: string[][] = [];
  const seen = new Set<string>();
  const push = (list: string[]) => {
    const values = Array.from(new Set(list.map((code) => String(code || '')).filter(Boolean)))
      .filter((value) => !seen.has(value));
    if (!values.length) return;
    values.forEach((value) => seen.add(value));
    groups.push(values);
  };
  push(codes);
  push(codes.map((code) => code.toUpperCase()));
  push(codes.map((code) => code.toLowerCase()));
  return groups;
}

// Paquete del envío, por el tracking leído (con las variantes del sub-tracking) o por
// el código de etiqueta TLEC que ya quedó vinculado a un paquete.
async function findRegisteredPackage(base44: any, code: string) {
  const candidates = buildTrackingCandidates(code);

  for (const group of caseGroups(candidates)) {
    const rows = await base44.asServiceRole.entities.Package.filter(
      { tracking_number: { $in: group } }, '-created_date', 50
    );
    // La coincidencia exacta manda: se recorre el orden de candidatos.
    for (const candidate of candidates) {
      const wanted = candidate.toUpperCase();
      const row = (rows || []).find((r: any) => String(r?.tracking_number || '').toUpperCase() === wanted);
      if (row) return row;
    }
  }

  for (const group of caseGroups([code])) {
    const rows = await base44.asServiceRole.entities.Package.filter(
      { label_code: { $in: group } }, '-created_date', 1
    );
    if (rows?.[0]) return rows[0];
  }

  return null;
}

// Código de etiqueta TLEC escaneado sin pre-alerta: la pre-alerta se crea con el
// cliente de la etiqueta, así la carga nunca queda sin titular por ese motivo.
async function packageFromLabel(base44: any, code: string) {
  let label: any = null;
  for (const group of caseGroups([code])) {
    const rows = await base44.asServiceRole.entities.ShippingLabel.filter(
      { label_code: { $in: group } }, '-created_date', 1
    );
    if (rows?.[0]) {
      label = rows[0];
      break;
    }
  }
  if (!label) return null;

  const pkg = await base44.asServiceRole.entities.Package.create({
    tracking_number: '',
    client_email: label.client_email,
    shipping_mark: label.shipping_mark,
    label_code: label.label_code,
    shipping_type: 'maritimo',
    risk_category: (label.has_battery || label.has_liquid || label.has_powder || label.has_fbrand) ? 'alto_riesgo' : 'general',
    package_count: label.box_count || 1,
    description: label.content || 'Etiqueta TLEC',
    status: 'pre_alerta',
    is_orphan: false,
  });

  try {
    await base44.asServiceRole.entities.ShippingLabel.update(label.id, {
      status: 'vinculada',
      linked_package_id: pkg.id,
    });
  } catch (_) {}

  return pkg;
}

// ¿Los caracteres de `code` aparecen todos en `tracking`, en el mismo orden? Es lo que
// pasa cuando la lectura se come algún dígito de un número largo.
function isSubsequence(code: string, tracking: string): boolean {
  let i = 0;
  for (let j = 0; j < tracking.length && i < code.length; j++) {
    if (tracking[j] === code[i]) i++;
  }
  return i === code.length;
}

// El código leído puede quedar cortado o perder algún dígito: un tracking largo de
// solo números (18 a 22 dígitos de una etiqueta china, por ejemplo) se lee a medias
// tanto por el escáner como por la IA. Si lo leído es el comienzo de un tracking que
// ya está registrado —o el mismo número con algún dígito de menos— es el mismo envío.
// Solo se acepta cuando la coincidencia es una sola: con varias, la carga no se puede
// dar por identificada.
async function findShipmentByCodeShape(base44: any, code: string) {
  if (code.length < 8) return null;

  const longNumeric = /^\d{14,}$/.test(code);
  const anchor = longNumeric ? code.slice(0, 10) : code;
  const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rows = await base44.asServiceRole.entities.Package.filter(
    { tracking_number: { $regex: `^${escaped}`, $options: 'i' } }, '-created_date', 20
  );

  const matches = (rows || []).filter((row: any) => {
    const tracking = String(row?.tracking_number || '');
    if (tracking.length <= code.length) return false;
    if (tracking.toUpperCase().startsWith(code.toUpperCase())) return true;
    return longNumeric
      && /^\d+$/.test(tracking)
      && tracking.length - code.length <= 3
      && isSubsequence(code, tracking);
  });

  return matches.length === 1 ? matches[0] : null;
}

// El envío que corresponde a ese código: el tracking exacto (con sus variantes de
// sub-tracking), el tracking del que este parece una lectura cortada o incompleta, o el
// paquete que ya trae la etiqueta TLEC vinculada.
async function findShipment(base44: any, code: string) {
  return (await findRegisteredPackage(base44, code))
    || (await findShipmentByCodeShape(base44, code))
    || (await packageFromLabel(base44, code));
}

// ---------------------------------------------------------------------------
// Registro de la carga
// ---------------------------------------------------------------------------

export type ScanOutcome = {
  result_type: 'recibido' | 'huerfano' | 'duplicado' | 'pendiente';
  tracking_number: string;
  shipping_mark: string;
  package_id: string | null;
  client_email: string;
  // De dónde salió el tracking que registró la carga (null cuando no hubo ninguno).
  detection: 'escaner' | 'telefono' | 'ia' | 'manual' | null;
  // Carga a la que hay que avisarle al mayorista su recepción (null cuando no
  // corresponde avisar: el paquete ya estaba registrado y no entró por el almacén).
  wholesaler_pkg: any | null;
  // Motivo cuando la captura quedó pendiente de identificar: para dejar rastro de por
  // qué la lectura con visión no dio un tracking.
  reason?: string;
};

// La carga ya tenía su envío registrado: se marca recibida, o se suma la foto si el
// registro era un huérfano sin cliente esperando por la misma carga.
async function registerFound(
  base44: any,
  { pkg, code, photoUrl, now, receivedBy }: { pkg: any; code: string; photoUrl: string | null; now: string; receivedBy: string },
) {
  if (pkg.status === 'pre_alerta') {
    await base44.asServiceRole.entities.Package.update(pkg.id, {
      status: 'recibido',
      received_date: now,
      received_by: receivedBy,
      package_image_url: photoUrl,
      package_image_urls: photoUrl ? [photoUrl] : (pkg.package_image_urls || []),
    });
    return {
      result_type: 'recibido' as const,
      tracking_number: code,
      shipping_mark: pkg.shipping_mark || '',
      package_id: pkg.id,
      client_email: pkg.client_email || '',
      wholesaler_pkg: pkg,
    };
  }

  // Ya estaba recibido o en otro estado. Si sigue siendo un huérfano sin cliente, es
  // el mismo paquete reconocido por otro método: esta foto se suma a su registro y se
  // le manda a su titular en la app del mayorista.
  if (pkg.is_orphan === true && !pkg.client_email) {
    await absorbIntoOrphan({
      base44,
      keep: pkg,
      incoming: { package_image_url: photoUrl, package_image_urls: photoUrl ? [photoUrl] : [] },
      by: receivedBy,
      note: false,
    });
    return {
      result_type: 'duplicado' as const,
      tracking_number: code,
      shipping_mark: pkg.shipping_mark || '',
      package_id: pkg.id,
      client_email: pkg.client_email || '',
      wholesaler_pkg: pkg,
    };
  }

  return {
    result_type: 'duplicado' as const,
    tracking_number: code,
    shipping_mark: pkg.shipping_mark || '',
    package_id: pkg.id,
    client_email: pkg.client_email || '',
    wholesaler_pkg: null,
  };
}

// Carga que entró sin que nadie la declarara: se registra como huérfana y, si su
// cliente ya había declarado ese mismo tracking, queda enlazada a él sin que nadie la
// asigne a mano.
async function createOrphan(
  base44: any,
  { code, photoUrl, now, receivedBy, description }: { code: string; photoUrl: string | null; now: string; receivedBy: string; description: string },
) {
  const orphan = await base44.asServiceRole.entities.Package.create({
    tracking_number: code,
    client_email: '',
    shipping_type: 'maritimo',
    description,
    status: 'sin_cliente',
    is_orphan: true,
    received_date: now,
    received_by: receivedBy,
    package_image_url: photoUrl,
    package_image_urls: photoUrl ? [photoUrl] : [],
  });

  const linked = await linkOrphanToPrealert(base44, orphan);
  const target = linked.package || orphan;

  return {
    result_type: 'huerfano' as const,
    tracking_number: code,
    shipping_mark: target.shipping_mark || '',
    package_id: target.id,
    client_email: target.client_email || '',
    wholesaler_pkg: target,
  };
}

// Registra una captura. Decide con lo que haya: el código leído en el servidor, el que
// leyó el teléfono al encuadrar y, si ninguno es confiable, la lectura de la etiqueta
// con visión.
export async function applyScanCapture(
  base44: any,
  {
    scanner,
    hint,
    photoUrl,
    receivedBy,
    allowUntrackedOrphan = false,
  }: {
    scanner: { code: string; reliable: boolean } | null;
    hint: string;
    photoUrl: string | null;
    receivedBy: string;
    allowUntrackedOrphan?: boolean;
  },
): Promise<ScanOutcome> {
  const now = new Date().toISOString();
  const scannerCode = normalizeCode(scanner?.code);
  const hintCode = normalizeCode(hint);

  // 1) El código leído en el servidor encuentra el envío: la carga queda recibida. La
  //    coincidencia con un registro vale aunque la lectura no haya sido confiable.
  if (scannerCode) {
    const pkg = await findShipment(base44, scannerCode);
    if (pkg) {
      const outcome = await registerFound(base44, { pkg, code: scannerCode, photoUrl, now, receivedBy });
      return { ...outcome, detection: 'escaner' };
    }
  }

  // 2) El código que el teléfono alcanzó a leer también sirve para encontrar el envío.
  if (hintCode && hintCode !== scannerCode) {
    const pkg = await findShipment(base44, hintCode);
    if (pkg) {
      const outcome = await registerFound(base44, { pkg, code: hintCode, photoUrl, now, receivedBy });
      return { ...outcome, detection: 'telefono' };
    }
  }

  // 3) Lectura confiable que no encuentra nada: la carga entró sin pre-alerta.
  if (scannerCode && scanner?.reliable) {
    const outcome = await createOrphan(base44, {
      code: scannerCode,
      photoUrl,
      now,
      receivedBy,
      description: 'Paquete huérfano (Bodega China, sin pre-alerta)',
    });
    return { ...outcome, detection: 'escaner' };
  }

  // 4) Lectura no confiable: se lee la etiqueta con visión (OpenAI y, si no responde,
  //    Gemini).
  const ai = await extractTrackingWithAI(photoUrl || '');
  if (ai.code) {
    const pkg = await findShipment(base44, ai.code);
    if (pkg) {
      const outcome = await registerFound(base44, { pkg, code: ai.code, photoUrl, now, receivedBy });
      return { ...outcome, detection: 'ia' };
    }
    const outcome = await createOrphan(base44, {
      code: ai.code,
      photoUrl,
      now,
      receivedBy,
      description: 'Paquete huérfano (Bodega China, tracking leído de la foto)',
    });
    return { ...outcome, detection: 'ia' };
  }

  // 5) El código del teléfono, aunque no sea confiable por sí solo, es una lectura del
  //    operador sobre la etiqueta: sirve para dar de alta la carga. Un código de
  //    producto no: eso no identifica un envío.
  if (hintCode && !isProductCodeShape(hintCode)) {
    const outcome = await createOrphan(base44, {
      code: hintCode,
      photoUrl,
      now,
      receivedBy,
      description: 'Paquete huérfano (Bodega China, código leído por el teléfono)',
    });
    return { ...outcome, detection: 'telefono' };
  }

  // 6) Captura registrada a propósito sin foto: el operador decidió dar la carga de
  //    alta igual, sin código que leer.
  if (allowUntrackedOrphan) {
    const pseudoTracking = `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const outcome = await createOrphan(base44, {
      code: pseudoTracking,
      photoUrl,
      now,
      receivedBy,
      description: 'Paquete huérfano (Bodega China, foto sin tracking)',
    });
    return { ...outcome, detection: 'manual' };
  }

  // 7) Nada legible: la captura queda pendiente de identificación. No se crea un
  //    huérfano sin tracking: es mejor que alguien la revise o la vuelva a escanear
  //    antes que llenar la lista de huérfanos de paquetes sin identificar.
  return {
    result_type: 'pendiente',
    // Tracking sugerido para quien revise: solo un código con forma de envío (el QR
    // de WeChat de una caja, por ejemplo, no ayuda a identificar la carga).
    tracking_number: [scannerCode, hintCode].find((code) => isTrackingShape(code)) || '',
    shipping_mark: '',
    package_id: null,
    client_email: '',
    detection: null,
    wholesaler_pkg: null,
    reason: ai.error,
  };
}