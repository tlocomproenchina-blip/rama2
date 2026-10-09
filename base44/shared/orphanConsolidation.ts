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
  'package_count',
  'has_insurance',
  'fob_value',
  'invoice_url',
  'product_image_url',
  'shipping_company',
  'shipping_address',
  'seller_delivery_date',
  'label_code',
  'consolidation_id',
];

// Vínculos que apuntan al ID de un paquete y que deben seguir vivos después de
// retirar la pre-alerta (el ID viejo se re-apunta al registro que se conserva).
const PACKAGE_ID_LINKS = [
  { entity: 'ShippingLabel', field: 'linked_package_id', kind: 'single' },
  { entity: 'InsurancePayment', field: 'package_id', kind: 'single' },
  { entity: 'CargaRuta', field: 'package_id', kind: 'single' },
  { entity: 'Bulto', field: 'package_ids', kind: 'array' },
  { entity: 'Consolidation', field: 'package_ids', kind: 'array' },
  { entity: 'ConsolidationRequest', field: 'package_ids', kind: 'array' },
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
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    return text !== '' && !PREFILL_DESCRIPTIONS.includes(text);
  }
  return true;
}

async function relinkPackageReferences(base44: any, oldId: string, newId: string): Promise<any[]> {
  const relinked: any[] = [];
  for (const link of PACKAGE_ID_LINKS) {
    try {
      const rows = await base44.asServiceRole.entities[link.entity].filter({ [link.field]: oldId }, '-created_date', 50);
      for (const row of rows || []) {
        const value = link.kind === 'array'
          ? (Array.isArray(row[link.field]) ? row[link.field].map((id: string) => (id === oldId ? newId : id)) : [])
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
export async function consolidateOrphan({
  base44,
  orphan,
  prealert,
  label,
  shippingMark,
}: {
  base44: any;
  orphan: any;
  prealert?: any;
  label?: any;
  shippingMark?: string;
}): Promise<{
  package: any;
  merged_fields: string[];
  relinked: any[];
  removed_prealert_id: string | null;
  source: 'prealert' | 'label';
}> {
  // Se relee el huérfano antes de tocar nada: si ya fue reclamado por otro proceso
  // (reclamo del cliente, otro empleado, otro lote de IA) no se repite la unificación.
  const freshRows = await base44.asServiceRole.entities.Package.filter({ id: orphan.id }, '-created_date', 1);
  const fresh = freshRows?.[0];
  if (!fresh) throw new Error('orphan_not_found');
  if (fresh.is_orphan !== true || fresh.client_email) throw new Error(ORPHAN_ALREADY_CLAIMED);

  const source = prealert || (label ? labelAsPrealert(label, fresh.tracking_number) : null);
  if (!source) throw new Error('Se necesita una pre-alerta o una etiqueta TLEC para unificar');

  const wasReceived = !!(fresh.warehouse_location_id || fresh.actual_weight_kg || fresh.received_date);

  const patch: Record<string, any> = {
    client_email: source.client_email,
    shipping_mark: source.shipping_mark || fresh.shipping_mark || shippingMark || '',
    is_orphan: false,
    ai_unreadable: false,
    ai_attempted_date: null,
    reported: true,
    status: wasReceived ? 'recibido' : 'pre_alerta',
  };
  if (!fresh.tracking_number && source.tracking_number) patch.tracking_number = source.tracking_number;

  const merged_fields: string[] = [];
  for (const field of TRANSFER_IF_EMPTY) {
    if (isFilled(source[field]) && !isFilled(fresh[field])) {
      patch[field] = source[field];
      merged_fields.push(field);
    }
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
    source: prealert ? 'prealert' : 'label',
  };
}