// Unificación de un paquete huérfano con la pre-alerta del mismo envío.
//
// Cuando una carga llega sin pre-alerta se registra como huérfano; más tarde el
// cliente declara ese mismo envío (pre-alerta) o el almacén escanea su etiqueta
// TLEC. Reclamar el huérfano sin retirar la pre-alerta dejaba DOS registros del
// mismo paquete en el sistema.
//
// Un solo motor, reutilizado por aiReclaimOrphanPhotos (reclamo con IA de la foto)
// y assignOrphanPackage (asignación manual desde el panel de huérfanos).
//
// Reglas:
// - Se conserva SIEMPRE el registro recibido (el huérfano: foto, ubicación, peso,
//   dimensiones, CBM, fecha de recepción y el tracking que se escaneó físicamente).
// - De la pre-alerta solo se copian los datos declarados por el cliente, y solo
//   cuando el huérfano todavía no tiene un valor propio: los datos de almacén
//   nunca se sobrescriben.
// - Solo se unifica una pre-alerta PENDIENTE (sin recepción en almacén). Si ya hay
//   un paquete recibido con ese tracking, o pre-alertas de más de un cliente, no se
//   borra nada: se reporta el conflicto para revisión.

export const ORPHAN_ALREADY_CLAIMED = 'orphan_already_claimed';

// Descripciones genéricas con las que se registra un huérfano: no aportan info.
const PREFILL_DESCRIPTIONS = ['paquete huérfano (sin pre-alerta)', 'pre-alerta rápida'];

// Campos declarados por el cliente en la pre-alerta que se copian al huérfano
// cuando este todavía no tiene un valor propio.
const TRANSFER_IF_EMPTY = [
  'description',
  'shipping_type',
  'risk_category',
  'has_insurance',
  'fob_value',
  'invoice_url',
  'product_image_url',
  'package_image_urls',
  'shipping_company',
  'shipping_address',
  'seller_delivery_date',
  'label_code',
  'consolidation_id',
];

// Conteo con el que nace un huérfano: si nadie lo corrigió a mano, el conteo que
// declaró el cliente en la pre-alerta manda.
const PREFILL_PACKAGE_COUNT = 1;

// Vínculos que apuntan al ID de un paquete y que deben seguir vivos después de
// retirar la pre-alerta (el ID viejo se re-apunta al registro que se conserva).
const PACKAGE_ID_LINKS = [
  { entity: 'ShippingLabel', field: 'linked_package_id', kind: 'single' },
  { entity: 'InsurancePayment', field: 'package_id', kind: 'single' },
  { entity: 'CargaRuta', field: 'package_id', kind: 'single' },
  { entity: 'Bulto', field: 'package_ids', kind: 'array' },
  { entity: 'Consolidation', field: 'package_ids', kind: 'array' },
  { entity: 'ConsolidationRequest', field: 'package_ids', kind: 'array' },
  // El aviso de recepción al mayorista apunta al paquete: sigue vivo tras unificar.
  { entity: 'WholesalerLog', field: 'package_id', kind: 'single' },
];

// El escáner suele leer el sub-tracking (master + sufijo de caja: 001, 002…),
// así que la coincidencia se busca por el tracking exacto y quitando 3, 2, 4, 1,
// 5 y 6 dígitos del final.
export function buildTrackingCandidates(tracking: string): string[] {
  const base = String(tracking || '').trim();
  if (!base) return [];
  const removalOrder = [0, 3, 2, 4, 1, 5, 6];
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const remove of removalOrder) {
    if (remove === 0) {
      if (!seen.has(base)) {
        seen.add(base);
        candidates.push(base);
      }
      continue;
    }
    if (base.length - remove < 5) continue;
    const candidate = base.slice(0, base.length - remove);
    if (!seen.has(candidate)) {
      seen.add(candidate);
      candidates.push(candidate);
    }
  }
  return candidates;
}

// Evidencia de que la carga ya pasó físicamente por el almacén de China: la
// ubicación, el peso o la fecha que dejó el escáner, o la foto que capturó TLEC
// CARGO al escanearla. Una pre-alerta declarada por el cliente no trae ninguna de
// esas fotos de recepción, así que por sí sola nunca marca la carga como recibida.
export function hasReceptionEvidence(pkg: any): boolean {
  if (!pkg) return false;
  if (pkg.warehouse_location_id || pkg.actual_weight_kg || pkg.received_date) return true;
  if (Array.isArray(pkg.package_image_urls) && pkg.package_image_urls.length > 0) return true;
  return !!String(pkg.package_image_url || '').trim();
}

// Un paquete ya recibido (con datos de almacén o en un estado posterior a la
// pre-alerta) no se puede unificar: sería perder la carga que ya está registrada.
export function isPendingPrealert(pkg: any): boolean {
  return !!pkg &&
    pkg.status === 'pre_alerta' &&
    !pkg.received_date &&
    !pkg.warehouse_location_id &&
    !pkg.ve_recognized_date;
}

// Busca, entre los trackings candidatos, los paquetes con cliente que corresponden
// al mismo envío: los que siguen en pre-alerta (unificables) y los ya recibidos
// (conflicto: el tracking ya está registrado como carga real).
export async function findSameShipmentMatches(
  base44: any,
  { candidates, labelCode, excludeId }: { candidates: string[]; labelCode?: string; excludeId?: string },
): Promise<{ pending: any[]; received: any[] }> {
  const pending: any[] = [];
  const received: any[] = [];
  const seen = new Set<string>();

  const collect = (rows: any[]) => {
    for (const row of rows || []) {
      if (!row?.client_email || row.is_orphan === true) continue;
      if (excludeId && row.id === excludeId) continue;
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      if (isPendingPrealert(row)) pending.push(row);
      else received.push(row);
    }
  };

  for (const candidate of candidates || []) {
    if (!candidate) continue;
    collect(await base44.asServiceRole.entities.Package.filter({ tracking_number: candidate }, '-created_date', 20));
  }

  // El código escaneado también puede ser el código de una etiqueta TLEC.
  if (labelCode) {
    collect(await base44.asServiceRole.entities.Package.filter({ label_code: labelCode }, '-created_date', 20));
  }

  return { pending, received };
}

// Descripción genérica con la que queda una carga que el almacén dio de alta por su
// cuenta (sin que el cliente la hubiera declarado): no es la descripción del cliente.
export function looksGenericDescription(pkg: any): boolean {
  const text = String(pkg?.description || '').trim().toLowerCase();
  if (!text) return true;
  return PREFILL_DESCRIPTIONS.includes(text)
    || text.startsWith('paquete huérfano')
    || text.startsWith('paquete sin pre-alerta')
    || text.startsWith('pre-alerta rápida')
    || text.startsWith('etiqueta tlec');
}

// Cuando el cliente tiene dos registros del mismo envío, el que se conserva es el
// suyo: manda su pre-alerta pendiente (es donde declaró la carga) y, si ya no hay
// pendiente, el que trae su descripción de producto o su foto.
export function pickClientRecordToKeep(records: any[]): any | null {
  const list = (records || []).filter(Boolean);
  if (list.length <= 1) return list[0] || null;

  const score = (pkg: any) => {
    let value = 0;
    if (isPendingPrealert(pkg)) value += 100;
    if (String(pkg?.product_image_url || '').trim()) value += 10;
    if (!looksGenericDescription(pkg)) value += 5;
    return value;
  };

  return [...list].sort((a, b) => score(b) - score(a))[0];
}

// Si hay pre-alertas de más de un cliente con el mismo tracking, la coincidencia no
// es inequívoca: no se unifica nada.
export function pickConsolidationTarget(pending: any[]): { target: any | null; ambiguous: boolean } {
  if (!pending || pending.length === 0) return { target: null, ambiguous: false };
  const clients = new Set(pending.map((p) => String(p.client_email || '').trim().toLowerCase()));
  if (clients.size > 1) return { target: null, ambiguous: true };
  return { target: pending[0], ambiguous: false };
}

// Pre-alerta equivalente a la que crea el almacén al escanear una etiqueta TLEC
// cuyo tracking todavía no tenía pre-alerta.
function labelAsPrealert(label: any, tracking: string) {
  return {
    client_email: label.client_email,
    shipping_mark: label.shipping_mark,
    label_code: label.label_code,
    tracking_number: tracking,
    shipping_type: 'maritimo',
    risk_category: (label.has_battery || label.has_liquid || label.has_powder || label.has_fbrand) ? 'alto_riesgo' : 'general',
    package_count: label.box_count || 1,
    description: label.content || 'Etiqueta TLEC',
  };
}

function isFilled(value: any): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    return text !== '' && !PREFILL_DESCRIPTIONS.includes(text);
  }
  return true;
}

// Nota de trazabilidad que se deja en el paquete que se conserva: el tracking que
// declaró el cliente no se pierde cuando el código escaneado es distinto.
function buildMergeNote({ fresh, source, isPrealert, isWholesaler }: { fresh: any; source: any; isPrealert: boolean; isWholesaler?: boolean }): string | null {
  const declared = String(source?.tracking_number || '').trim();
  const current = String(fresh?.tracking_number || '').trim();
  const parts: string[] = [];
  if (declared && declared !== current) {
    parts.push(`tracking declarado en ${isPrealert ? 'la pre-alerta' : 'la etiqueta'}: ${declared}`);
  }
  if (isPrealert) parts.push('pre-alerta unificada y retirada');
  else if (isWholesaler) parts.push('pre-alerta del mayorista vinculada');
  if (parts.length === 0) return null;
  return `Unificado ${caracasStamp()}: ${parts.join('; ')}.`;
}

// Fecha y hora local de Caracas, para dejar rastro en las notas de unificación.
function caracasStamp(): string {
  return new Date().toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

async function relinkPackageReferences(base44: any, oldId: string, newId: string): Promise<any[]> {
  const relinked: any[] = [];
  for (const link of PACKAGE_ID_LINKS) {
    try {
      const rows = await base44.asServiceRole.entities[link.entity].filter({ [link.field]: oldId }, '-created_date', 50);
      for (const row of rows || []) {
        // Al re-apuntar se quita el ID repetido: si el registro que se conserva ya
        // estaba en esa lista, el mismo paquete no se cuenta dos veces.
        const value = link.kind === 'array'
          ? (Array.isArray(row[link.field])
            ? Array.from(new Set(row[link.field].map((id: string) => (id === oldId ? newId : id))))
            : [])
          : newId;
        await base44.asServiceRole.entities[link.entity].update(row.id, { [link.field]: value });
        relinked.push({ entity: link.entity, id: row.id, field: link.field });
      }
    } catch (_) {
      // Un vínculo que no se pueda re-apuntar no impide la unificación.
    }
  }
  return relinked;
}

// Fusiona la pre-alerta con el huérfano recibido en un solo paquete.
// `prealert` es el registro de pre-alerta a retirar; `label` la etiqueta TLEC cuando
// no existe pre-alerta (en ese caso no hay nada que borrar, solo se vincula).
// `claim` son los datos declarados que llegan sin registro propio (la pre-alerta que
// reporta la app del mayorista): se copian igual, pero no hay nada que retirar.
export async function consolidateOrphan({
  base44,
  orphan,
  prealert,
  claim,
  label,
  shippingMark,
}: {
  base44: any;
  orphan: any;
  prealert?: any;
  claim?: any;
  label?: any;
  shippingMark?: string;
}): Promise<{
  package: any;
  merged_fields: string[];
  relinked: any[];
  removed_prealert_id: string | null;
  source: 'prealert' | 'wholesaler' | 'label';
}> {
  // Se relee el huérfano antes de tocar nada: si ya fue reclamado por otro proceso
  // (reclamo del cliente, otro empleado, otro lote de IA) no se repite la unificación.
  const freshRows = await base44.asServiceRole.entities.Package.filter({ id: orphan.id }, '-created_date', 1);
  const fresh = freshRows?.[0];
  if (!fresh) throw new Error('orphan_not_found');
  if (fresh.is_orphan !== true || fresh.client_email) throw new Error(ORPHAN_ALREADY_CLAIMED);

  const source = prealert || claim || (label ? labelAsPrealert(label, fresh.tracking_number) : null);
  if (!source) throw new Error('Se necesita una pre-alerta, los datos del mayorista o una etiqueta TLEC para unificar');

  const wasReceived = hasReceptionEvidence(fresh);

  const patch: Record<string, any> = {
    client_email: source.client_email,
    shipping_mark: source.shipping_mark || fresh.shipping_mark || shippingMark || '',
    is_orphan: false,
    ai_unreadable: false,
    ai_attempted_date: null,
    reported: true,
    status: wasReceived ? 'recibido' : 'pre_alerta',
  };

  // La carga ya estaba en el almacén: si el escaneo no dejó fecha de recepción, se
  // completa aquí para que quede registrada igual que una entrada normal.
  if (wasReceived && !fresh.received_date) {
    patch.received_date = new Date().toISOString();
    if (!fresh.received_by) patch.received_by = 'Registro en almacén';
  }
  if (!fresh.tracking_number && source.tracking_number) patch.tracking_number = source.tracking_number;

  const merged_fields: string[] = [];
  for (const field of TRANSFER_IF_EMPTY) {
    if (isFilled(source[field]) && !isFilled(fresh[field])) {
      patch[field] = source[field];
      merged_fields.push(field);
    }
  }

  // El conteo declarado por el cliente no se pierde frente al conteo por defecto.
  const declaredCount = Number(source.package_count) || 0;
  const currentCount = Number(fresh.package_count) || 0;
  if (declaredCount > 0 && declaredCount !== currentCount && currentCount <= PREFILL_PACKAGE_COUNT) {
    patch.package_count = declaredCount;
    merged_fields.push('package_count');
  }

  // El tracking declarado y la unificación quedan anotados en el paquete conservado.
  const mergeNote = buildMergeNote({ fresh, source, isPrealert: !!prealert, isWholesaler: !!claim });
  if (mergeNote) {
    patch.reception_notes = fresh.reception_notes ? `${fresh.reception_notes}\n${mergeNote}` : mergeNote;
  }

  const updated = await base44.asServiceRole.entities.Package.update(fresh.id, patch);

  let relinked: any[] = [];
  let removed_prealert_id: string | null = null;

  if (prealert) {
    relinked = await relinkPackageReferences(base44, prealert.id, fresh.id);
    await base44.asServiceRole.entities.Package.delete(prealert.id);
    removed_prealert_id = prealert.id;
  } else if (label) {
    try {
      await base44.asServiceRole.entities.ShippingLabel.update(label.id, {
        status: 'vinculada',
        linked_package_id: fresh.id,
      });
      relinked.push({ entity: 'ShippingLabel', id: label.id, field: 'linked_package_id' });
    } catch (_) {}
  }

  return {
    package: updated,
    merged_fields,
    relinked,
    removed_prealert_id,
    source: prealert ? 'prealert' : (claim ? 'wholesaler' : 'label'),
  };
}

// ---------------------------------------------------------------------------
// Fusión de huérfanos duplicados
//
// El mismo paquete puede quedar registrado DOS veces cuando cada método de
// identificación lo da de alta por su cuenta: un huérfano con el tracking que
// escaneó el almacén y otro con el que leyó la IA de la foto (o con el que
// registró un empleado a mano). La regla es una sola: si el tracking coincide
// exactamente, los dos registros son el mismo paquete y se fusionan en uno solo,
// conservando las fotos y los datos de almacén de ambos.

// Campos que se copian al registro que se conserva cuando este todavía no tiene
// un valor propio. Nunca se sobrescribe nada de lo que ya estaba.
const EVIDENCE_IF_EMPTY = [
  'description',
  'shipping_type',
  'risk_category',
  'has_insurance',
  'fob_value',
  'invoice_url',
  'product_image_url',
  'shipping_company',
  'shipping_address',
  'seller_delivery_date',
  'label_code',
  'consolidation_id',
  'warehouse_id',
  'warehouse_name',
  'warehouse_city',
  'warehouse_country',
  'warehouse_location_id',
  'warehouse_location_code',
  'warehouse_location_name',
  'warehouse_zone',
  'actual_weight_kg',
  'actual_length_cm',
  'actual_width_cm',
  'actual_height_cm',
  'actual_cbm',
  'received_date',
  'received_by',
  'reception_notes',
];

// Un huérfano sin cliente: todavía nadie lo reclamó, así que puede fusionarse.
function isUnclaimedOrphan(pkg: any): boolean {
  return !!pkg && pkg.is_orphan === true && !String(pkg.client_email || '').trim();
}

// Fotos de los dos registros sin repetir. La ficha guarda hasta 3.
function unionPhotos(keep: any, incoming: any): string[] {
  const photos: string[] = [];
  const push = (urls: any) => {
    for (const url of urls || []) {
      const value = String(url || '').trim();
      if (value && !photos.includes(value)) photos.push(value);
    }
  };
  push(Array.isArray(keep?.package_image_urls) ? keep.package_image_urls : []);
  push(keep?.package_image_url ? [keep.package_image_url] : []);
  push(Array.isArray(incoming?.package_image_urls) ? incoming.package_image_urls : []);
  push(incoming?.package_image_url ? [incoming.package_image_url] : []);
  return photos.slice(0, 3);
}

// Cambios que dejan el mismo paquete en un solo registro: manda el registro que
// se conserva y del otro solo se agrega lo que todavía le falta.
function buildOrphanMergePatch({ keep, incoming }: { keep: any; incoming: any }): {
  patch: Record<string, any>;
  merged_fields: string[];
} {
  const patch: Record<string, any> = {};
  const merged_fields: string[] = [];

  if (!isFilled(keep?.tracking_number) && isFilled(incoming?.tracking_number)) {
    patch.tracking_number = incoming.tracking_number;
    merged_fields.push('tracking_number');
  }

  const photos = unionPhotos(keep, incoming);
  const currentPhotos = Array.isArray(keep?.package_image_urls) ? keep.package_image_urls : [];
  if (photos.length > 0 && photos.join('|') !== currentPhotos.join('|')) {
    patch.package_image_urls = photos;
    patch.package_image_url = photos[0];
    merged_fields.push('package_image_urls');
  }

  for (const field of EVIDENCE_IF_EMPTY) {
    if (isFilled(incoming?.[field]) && !isFilled(keep?.[field])) {
      patch[field] = incoming[field];
      merged_fields.push(field);
    }
  }

  // El conteo declarado por el cliente no se pierde frente al conteo por defecto.
  const incomingCount = Number(incoming?.package_count) || 0;
  const currentCount = Number(keep?.package_count) || 0;
  if (incomingCount > 0 && incomingCount !== currentCount && currentCount <= PREFILL_PACKAGE_COUNT) {
    patch.package_count = incomingCount;
    merged_fields.push('package_count');
  }

  return { patch, merged_fields };
}

// Nota de trazabilidad que queda en el registro conservado.
function buildDuplicateNote({ keep, incoming, by }: { keep: any; incoming: any; by?: string }): string {
  const parts = [`Fusionado ${caracasStamp()}: el mismo paquete ya estaba registrado con el tracking ${keep?.tracking_number || ''}`];
  const other = String(incoming?.tracking_number || '').trim();
  if (other && other !== String(keep?.tracking_number || '').trim()) parts.push(`tracking del otro registro: ${other}`);
  if (by) parts.push(`por ${by}`);
  return `${parts.join('; ')}.`;
}

// Huérfanos sin cliente que corresponden al MISMO envío (tracking exacto): el
// mismo paquete dado de alta dos veces por métodos de identificación distintos.
export async function findDuplicateOrphans(
  base44: any,
  { candidates, excludeId }: { candidates: string[]; excludeId?: string },
): Promise<any[]> {
  const found: any[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates || []) {
    const code = String(candidate || '').trim();
    if (!code || code.startsWith('MANUAL-')) continue;
    const rows = await base44.asServiceRole.entities.Package.filter({ tracking_number: code }, '-created_date', 20);
    for (const row of rows || []) {
      if (!row || row.id === excludeId || seen.has(row.id)) continue;
      if (!isUnclaimedOrphan(row)) continue;
      seen.add(row.id);
      found.push(row);
    }
  }
  return found;
}

// Suma los datos que llegan (una foto del almacén, un alta manual) al huérfano
// que ya existe, sin crear un segundo registro. Devuelve null cuando el registro
// que ya existe no es un huérfano sin cliente: ese caso no se toca.
export async function absorbIntoOrphan({
  base44,
  keep,
  incoming,
  by,
  note = true,
}: {
  base44: any;
  keep: any;
  incoming: any;
  by?: string;
  note?: boolean;
}): Promise<any | null> {
  if (!isUnclaimedOrphan(keep)) return null;

  const { patch } = buildOrphanMergePatch({ keep, incoming });
  if (note) {
    const text = buildDuplicateNote({ keep, incoming, by });
    patch.reception_notes = [patch.reception_notes ?? keep?.reception_notes, text].filter(Boolean).join('\n');
  }
  if (Object.keys(patch).length === 0) return keep;

  return await base44.asServiceRole.entities.Package.update(keep.id, patch);
}

// Fusiona dos registros del mismo paquete huérfano: se conserva `keep` con toda
// la evidencia de ambos y se retira `duplicate`, re-apuntando antes sus vínculos.
export async function mergeDuplicateOrphans({
  base44,
  keep,
  duplicate,
  by,
}: {
  base44: any;
  keep: any;
  duplicate: any;
  by?: string;
}): Promise<{ skipped: boolean; package: any; merged_fields: string[]; relinked: any[]; removed_id: string | null }> {
  // Se releen los dos registros antes de tocar nada: si alguno ya no está (lo
  // reclamó el cliente o lo fusionó otro proceso) no se hace nada.
  const keepRows = await base44.asServiceRole.entities.Package.filter({ id: keep?.id }, '-created_date', 1);
  const duplicateRows = await base44.asServiceRole.entities.Package.filter({ id: duplicate?.id }, '-created_date', 1);
  const freshKeep = keepRows?.[0];
  const freshDuplicate = duplicateRows?.[0];
  if (!freshKeep || !freshDuplicate) {
    return { skipped: true, package: null, merged_fields: [], relinked: [], removed_id: null };
  }

  const { patch, merged_fields } = buildOrphanMergePatch({ keep: freshKeep, incoming: freshDuplicate });
  const note = buildDuplicateNote({ keep: freshKeep, incoming: freshDuplicate, by });
  patch.reception_notes = [patch.reception_notes ?? freshKeep.reception_notes, note].filter(Boolean).join('\n');

  const updated = await base44.asServiceRole.entities.Package.update(freshKeep.id, patch);
  const relinked = await relinkPackageReferences(base44, freshDuplicate.id, freshKeep.id);
  await base44.asServiceRole.entities.Package.delete(freshDuplicate.id);

  return { skipped: false, package: updated, merged_fields, relinked, removed_id: freshDuplicate.id };
}

// ---------------------------------------------------------------------------
// Unificación sobre el registro del cliente
//
// Cuando la carga sin titular se asigna a un cliente que YA tenía registrado ese
// mismo envío (su pre-alerta), no se dejan dos paquetes del mismo paquete: se
// conserva el registro del cliente —su descripción, sus datos y su foto de
// producto— y ahí se completa la carga: queda recibida, con la foto de la
// recepción del almacén y con todo lo que la carga sin titular traía (ubicación,
// peso, medidas, CBM y las marcas internas de facturación). El registro sin
// titular se retira, re-apuntando antes sus vínculos, así que el cliente ve un
// solo paquete, recibido y con sus fotos.

// Del registro sin titular solo se suma lo que el registro del cliente todavía no
// tenía: nada de lo que el cliente declaró se pisa.
const ABSORB_IF_EMPTY = [
  'description',
  'shipping_type',
  'risk_category',
  'has_insurance',
  'fob_value',
  'invoice_url',
  'shipping_company',
  'shipping_address',
  'seller_delivery_date',
  'label_code',
  'consolidation_id',
  'warehouse_id',
  'warehouse_name',
  'warehouse_city',
  'warehouse_country',
  'warehouse_zone',
  'warehouse_location_id',
  'warehouse_location_code',
  'warehouse_location_name',
  'actual_weight_kg',
  'actual_length_cm',
  'actual_width_cm',
  'actual_height_cm',
  'actual_cbm',
  'received_by',
  'billing_marked',
  'billing_marked_by',
  'billing_marked_date',
  'billed_invoice_id',
  'billed_date',
  'order_locked',
  'order_assigned_by',
  'order_assigned_date',
  've_recognized_date',
  've_recognized_by',
  've_notified_date',
];

// Nota de trazabilidad que queda en el registro del cliente.
function buildAbsorbNote({ tracking, by }: { tracking: string; by?: string }): string {
  const who = by ? ` por ${by}` : '';
  const declared = tracking ? ` con el tracking ${tracking}` : '';
  return `Unificado ${caracasStamp()}${who}: la carga sin titular${declared} se unió a esta pre-alerta del cliente; se conservan su foto y sus datos y se agregó la foto de la recepción del almacén.`;
}

// Une la carga sin titular al registro que el cliente ya tenía de ese envío. El
// registro que se conserva es el del cliente (la pre-alerta que él hizo) y el otro
// se retira. Devuelve null cuando el registro del cliente ya no existe.
export async function unifyOrphanIntoClientRecord({
  base44,
  orphan,
  clientRecord,
  shippingMark,
  by,
}: {
  base44: any;
  orphan: any;
  clientRecord: any;
  shippingMark?: string;
  by?: string;
}): Promise<{
  package: any;
  merged_fields: string[];
  removed_orphan_id: string;
  kept_package_id: string;
  relinked: any[];
} | null> {
  // Se releen los dos registros antes de tocar nada.
  const orphanRows = await base44.asServiceRole.entities.Package.filter({ id: orphan?.id }, '-created_date', 1);
  const fresh = orphanRows?.[0];
  if (!fresh) throw new Error('orphan_not_found');

  const clientRows = await base44.asServiceRole.entities.Package.filter({ id: clientRecord?.id }, '-created_date', 1);
  const keep = clientRows?.[0];
  if (!keep || keep.id === fresh.id) return null;

  // La carga ya pasó por el almacén (cualquiera de los dos registros lo respalda).
  const wasReceived = hasReceptionEvidence(fresh) || hasReceptionEvidence(keep);

  const merged_fields: string[] = [];
  const patch: Record<string, any> = {
    client_email: keep.client_email,
    shipping_mark: keep.shipping_mark || shippingMark || fresh.shipping_mark || '',
    is_orphan: false,
    reported: true,
    // El registro del cliente no es un huérfano: no queda en la lista de huérfanos.
    orphan_pending_reception: false,
    ai_unreadable: false,
    ai_attempted_date: null,
  };

  if (wasReceived) {
    patch.status = 'recibido';
    merged_fields.push('status');
    if (!keep.received_date) {
      patch.received_date = fresh.received_date || new Date().toISOString();
      patch.received_by = keep.received_by || fresh.received_by || by || 'Registro en almacén';
      merged_fields.push('received_date');
    }
  }

  // Fotos: primero las del cliente (su foto del producto) y después la de la
  // recepción del almacén. La ficha guarda hasta 3.
  const photos = unionPhotos(keep, fresh);
  const currentPhotos = Array.isArray(keep.package_image_urls) ? keep.package_image_urls : [];
  if (photos.length > 0 && photos.join('|') !== currentPhotos.join('|')) {
    patch.package_image_urls = photos;
    if (!isFilled(keep.package_image_url)) patch.package_image_url = photos[0];
    merged_fields.push('package_image_urls');
  }

  for (const field of ABSORB_IF_EMPTY) {
    if (isFilled(fresh[field]) && !isFilled(keep[field])) {
      patch[field] = fresh[field];
      merged_fields.push(field);
    }
  }

  // Las notas del registro que se retira se conservan: son el rastro del alta en el
  // almacén (quién la recibió y cómo se identificó).
  const absorbedNotes = String(fresh.reception_notes || '').trim();
  const keepNotes = String(keep.reception_notes || '').trim();
  const note = buildAbsorbNote({ tracking: String(fresh.tracking_number || ''), by });
  patch.reception_notes = [
    keepNotes,
    absorbedNotes && !keepNotes.includes(absorbedNotes) ? absorbedNotes : '',
    note,
  ].filter(Boolean).join('\n');

  const updated = await base44.asServiceRole.entities.Package.update(keep.id, patch);
  const relinked = await relinkPackageReferences(base44, fresh.id, keep.id);
  await base44.asServiceRole.entities.Package.delete(fresh.id);

  return {
    package: updated,
    merged_fields,
    removed_orphan_id: fresh.id,
    kept_package_id: keep.id,
    relinked,
  };
}

// ---------------------------------------------------------------------------
// Enlace automático: huérfano ↔ pre-alerta que ya existía
//
// Quien registra la carga en el almacén no ve a todos los clientes del sistema,
// así que un huérfano no siempre se puede asignar a mano. Si el cliente ya había
// declarado ese mismo envío (pre-alerta) con el tracking exacto, el huérfano se
// queda con su cliente sin intervención de nadie: conserva su foto y sus datos de
// recepción, y la pre-alerta se retira para no dejar el mismo paquete dos veces.
//
// Solo se enlaza con una pre-alerta PENDIENTE y de un único cliente: sin
// coincidencia exacta, o con pre-alertas de varios clientes, el huérfano queda
// intacto para revisión.

export async function linkOrphanToPrealert(
  base44: any,
  pkg: any,
): Promise<{ linked: boolean; reason?: string; package?: any; prealert_id?: string; client_email?: string }> {
  // Se relee antes de tocar nada: si otro proceso ya lo reclamó, no se repite.
  const rowsById = await base44.asServiceRole.entities.Package.filter({ id: pkg?.id }, '-created_date', 1);
  const fresh = rowsById?.[0];
  if (!isUnclaimedOrphan(fresh)) return { linked: false, reason: 'no_orphan' };

  const tracking = String(fresh.tracking_number || '').trim();
  if (!tracking || tracking.startsWith('MANUAL-')) return { linked: false, reason: 'sin_tracking' };

  // Coincidencia EXACTA: las variantes del sub-tracking (master + sufijo de caja)
  // sirven para no duplicar el mismo envío, pero no para asignar un cliente.
  const rows = await base44.asServiceRole.entities.Package.filter({ tracking_number: tracking }, '-created_date', 20);
  const prealerts = (rows || []).filter((row: any) =>
    row?.id !== fresh.id &&
    !!String(row?.client_email || '').trim() &&
    row.is_orphan !== true &&
    isPendingPrealert(row),
  );

  const { target, ambiguous } = pickConsolidationTarget(prealerts);
  if (ambiguous) return { linked: false, reason: 'prealertas_de_varios_clientes' };
  if (!target) return { linked: false, reason: 'sin_prealerta' };

  try {
    const result = await consolidateOrphan({ base44, orphan: fresh, prealert: target });
    return {
      linked: true,
      package: result.package,
      prealert_id: target.id,
      client_email: String(target.client_email || '').trim(),
    };
  } catch (err: any) {
    if (err?.message === ORPHAN_ALREADY_CLAIMED) return { linked: false, reason: 'ya_reclamado' };
    throw err;
  }
}