// Registro de una captura del almacén de China en el sistema.
//
// Este módulo es el que decide qué pasa con una carga capturada: busca el paquete
// por el código (sub-tracking, código de etiqueta TLEC y etiqueta sin pre-alerta),
// marca la pre-alerta como recibida, o registra la carga como huérfana cuando no
// hay titular. Un solo motor, usado por el procesador de la cola de capturas.
//
// Las búsquedas y la vinculación con pre-alertas son exactamente las de siempre:
// variantes del sub-tracking para no duplicar el mismo envío, y vinculación
// automática solo con una pre-alerta pendiente y de un único cliente.
import {
  absorbIntoOrphan,
  buildTrackingCandidates,
  linkOrphanToPrealert,
} from './orphanConsolidation.ts';
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

// Lee el tracking de la foto con visión, como respaldo cuando la lectura del
// código en el servidor no obtuvo nada legible.
export async function extractTrackingFromPhoto(base44: any, photoUrl: string): Promise<string> {
  if (!photoUrl) return '';
  try {
    const aiRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Eres un asistente de logística. Examina la foto de un paquete y extrae el número de tracking (tracking number) que aparece en la etiqueta de envío. El número de tracking suele ser una cadena alfanumérica larga (ej: YT2423123456789012, LP009876543210, 4PX1234567890, 79142337780380, etc.). NO devuelvas el código de barras numérico genérico (EAN/UPC de producto). Devuelve SOLO el número de tracking de la transportadora como una cadena CONTINUA sin espacios, guiones ni separadores de ningún tipo (ej: "YT2423123456789012", no "YT2423 1234 5678 9012"). Si no puedes leer ningún tracking claro, devuelve null.`,
      file_urls: [photoUrl],
      model: 'gpt_5_mini',
      response_json_schema: {
        type: 'object',
        properties: {
          tracking_number: { type: ['string', 'null'] },
        },
        required: ['tracking_number'],
      },
    });
    const extracted = aiRes?.tracking_number;
    if (typeof extracted === 'string' && extracted.replace(/\s+/g, '').length >= 5) {
      return extracted.replace(/\s+/g, '');
    }
  } catch (_) {
    // Sin lectura de IA se sigue con el registro de la carga.
  }
  return '';
}

// Busca el paquete del envío: primero por el tracking probando las variantes del
// sub-tracking (el escáner suele leer master + sufijo de caja), después por el
// código de etiqueta TLEC.
async function findRegisteredPackage(base44: any, code: string) {
  for (const candidate of buildTrackingCandidates(code)) {
    const matches = await base44.asServiceRole.entities.Package.filter(
      { tracking_number: candidate }, '-created_date', 1
    );
    if (matches?.[0]) return matches[0];
  }

  const byLabel = await base44.asServiceRole.entities.Package.filter(
    { label_code: code }, '-created_date', 1
  );
  return byLabel?.[0] || null;
}

// Código de etiqueta TLEC escaneado sin pre-alerta: la pre-alerta se crea con el
// cliente de la etiqueta, así la carga nunca queda sin titular por ese motivo.
async function packageFromLabel(base44: any, code: string) {
  const labels = await base44.asServiceRole.entities.ShippingLabel.filter(
    { label_code: code }, '-created_date', 1
  );
  const label = labels?.[0];
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

export type ScanOutcome = {
  result_type: 'recibido' | 'huerfano' | 'duplicado';
  tracking_number: string;
  shipping_mark: string;
  package_id: string | null;
  client_email: string;
  detection: 'ia' | 'manual' | null;
  // Carga a la que hay que avisarle al mayorista su recepción (null cuando no
  // corresponde avisar: el paquete ya estaba registrado y no entró por el almacén).
  wholesaler_pkg: any | null;
};

// Registro de una carga con su código ya conocido.
async function receiveByCode(
  base44: any,
  { code, photoUrl, now, receivedBy, orphanDescription }: { code: string; photoUrl: string | null; now: string; receivedBy: string; orphanDescription: string },
) {
  const pkg = (await findRegisteredPackage(base44, code)) || (await packageFromLabel(base44, code));

  if (!pkg) {
    // No existe pre-alerta ni etiqueta TLEC: la carga entró sin que nadie la
    // declarara. Se registra como huérfana y, si su cliente ya había declarado ese
    // mismo tracking, queda enlazada a él sin que nadie la asigne a mano.
    const orphan = await base44.asServiceRole.entities.Package.create({
      tracking_number: code,
      client_email: '',
      shipping_type: 'maritimo',
      description: orphanDescription,
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

  // Ya estaba recibido o en otro estado. Si sigue siendo un huérfano sin cliente,
  // es el mismo paquete reconocido por otro método: esta foto se suma a su registro
  // y se le manda a su titular en la app del mayorista.
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

// Registra una captura. `tracking` es el código que ya se leyó (del servidor o del
// teléfono); si viene vacío, se intenta leer el tracking de la foto con IA y, si
// tampoco se obtiene, la carga queda registrada como huérfana sin código.
export async function applyScanCapture(
  base44: any,
  { tracking, photoUrl, receivedBy }: { tracking: string; photoUrl: string | null; receivedBy: string },
): Promise<ScanOutcome> {
  const now = new Date().toISOString();
  const code = String(tracking || '').trim();

  if (code) {
    const outcome = await receiveByCode(base44, {
      code,
      photoUrl,
      now,
      receivedBy,
      orphanDescription: 'Paquete huérfano (Bodega China, sin pre-alerta)',
    });
    return { ...outcome, detection: null };
  }

  const aiCode = await extractTrackingFromPhoto(base44, photoUrl || '');
  if (aiCode) {
    const outcome = await receiveByCode(base44, {
      code: aiCode,
      photoUrl,
      now,
      receivedBy,
      orphanDescription: 'Paquete huérfano (Bodega China, tracking extraído por IA sin pre-alerta)',
    });
    return { ...outcome, detection: 'ia' };
  }

  // Sin código legible: la carga queda registrada igual, con un código interno
  // temporal, para que nadie la deje fuera del almacén.
  const pseudoTracking = `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const orphan = await base44.asServiceRole.entities.Package.create({
    tracking_number: pseudoTracking,
    client_email: '',
    shipping_type: 'maritimo',
    description: 'Paquete huérfano (Bodega China, foto sin tracking)',
    status: 'sin_cliente',
    is_orphan: true,
    received_date: now,
    received_by: receivedBy,
    package_image_url: photoUrl,
    package_image_urls: photoUrl ? [photoUrl] : [],
  });

  return {
    result_type: 'huerfano',
    tracking_number: pseudoTracking,
    shipping_mark: '',
    package_id: orphan.id,
    client_email: '',
    detection: 'manual',
    wholesaler_pkg: null,
  };
}