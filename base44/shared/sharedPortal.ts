// Portal de Consulta Compartido: enlace de solo lectura con alcance configurable.
// Reúne los trackings de los clientes mayoristas y los registros directos de
// TLEC CARGO sin duplicar datos: consulta la entidad Package y el índice de
// clientes mayoristas que ya existe en la app.
import { fetchAllFilter } from './paginatedFetch.ts';
import { connectionKeyOf, connectionLabel, listWholesalerConnections } from './wholesalerCore.ts';
import { emailKeyOf, markKeyOf, stampKeyOf } from './wholesalerBilling.ts';

export const PORTAL_PAGE_SIZE = 25;
export const PORTAL_EXPORT_PAGE = 200;
export const PORTAL_MAX_EXPORT = 5000;

// Campos mínimos de seguimiento: el portal no expone documentos, credenciales
// ni datos internos de la carga.
export const PORTAL_PAGE_FIELDS = [
  'tracking_number',
  'shipping_mark',
  'client_email',
  'received_date',
  'created_date',
  'status',
  'seller_delivery_photo_uri',
];

const CARACAS_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function randomPortalToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(value: any) {
  const data = new TextEncoder().encode(String(value ?? ''));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function tokenHint(token: any) {
  return String(token || '').slice(-6);
}

// Día de Caracas (UTC-4 todo el año) al que pertenece un momento dado.
export function caracasDayKey(iso: any) {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return null;
  return new Date(time - CARACAS_OFFSET_MS).toISOString().slice(0, 10);
}

// Rango ISO para un día o intervalo de días de Caracas, con el día final incluido.
export function caracasRange(from: any, to: any) {
  const range: any = {};
  const start = String(from || '');
  const end = String(to || '');
  if (DATE_KEY.test(start)) range.$gte = `${start}T04:00:00.000Z`;
  if (DATE_KEY.test(end)) {
    const endMs = new Date(`${end}T04:00:00.000Z`).getTime() + DAY_MS;
    range.$lt = new Date(endMs).toISOString();
  }
  return Object.keys(range).length ? range : null;
}

export function escapeRegex(value: any) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function strList(value: any, max = 500) {
  const list = Array.isArray(value) ? value : [];
  return list.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, max);
}

export function isoOrNull(value: any) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (DATE_KEY.test(raw)) {
    // El día elegido queda vigente hasta el final de ese día en Caracas.
    const endMs = new Date(`${raw}T04:00:00.000Z`).getTime() + DAY_MS;
    return new Date(endMs).toISOString();
  }
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : '';
}

// Índice de clientes mayoristas: dice de quién es cada tracking y de qué
// mayorista es ese cliente. Sin él, un tracking solo se puede leer como
// registro directo de TLEC CARGO.
// El índice de clientes mayoristas cambia con los cortes diarios, no con cada
// consulta: se guarda unos minutos en memoria para que el portal responda rápido.
let indexCache: { at: number; value: any } | null = null;
const INDEX_TTL_MS = 5 * 60 * 1000;

export async function loadWholesalerIndex(base44: any) {
  if (indexCache && Date.now() - indexCache.at < INDEX_TTL_MS) return indexCache.value;
  const rows = (await fetchAllFilter(base44.asServiceRole.entities.WholesalerClient, {}, '-fetched_date')) || [];
  const byEmail = new Map<string, any>();
  const byMark = new Map<string, any>();
  for (const row of rows) {
    const email = emailKeyOf(row?.email);
    const mark = markKeyOf(row?.shipping_mark);
    if (email && !byEmail.has(email)) byEmail.set(email, row);
    if (mark && !byMark.has(mark)) byMark.set(mark, row);
  }
  const value = { rows, byEmail, byMark, emails: [...byEmail.keys()], marks: [...byMark.keys()] };
  indexCache = { at: Date.now(), value };
  return value;
}

export function ownerOf(index: any, pkg: any) {
  const email = emailKeyOf(pkg?.client_email);
  const mark = markKeyOf(pkg?.shipping_mark);
  const row = (email && index.byEmail.get(email)) || (mark && index.byMark.get(mark)) || null;
  const clientName = row
    ? String(row.full_name || '').trim() || [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
    : '';
  return {
    origen: row ? 'mayorista' : 'directo',
    wholesaler_key: row ? stampKeyOf(row) : '',
    wholesaler_name: row ? String(row.wholesaler_name || '').trim() : '',
    client_name: clientName,
  };
}

export function scopeIsGlobal(link: any) {
  return String(link?.scope_mode || 'global') !== 'limitado';
}

export function scopeKeys(link: any) {
  return strList(link?.scope_wholesaler_keys);
}

function clientSetsForRows(rows: any[], keys: string[]) {
  const emails = new Set<string>();
  const marks = new Set<string>();
  for (const row of rows || []) {
    if (!keys.includes(stampKeyOf(row))) continue;
    const email = emailKeyOf(row?.email);
    const mark = markKeyOf(row?.shipping_mark);
    if (email) emails.add(email);
    if (mark) marks.add(mark);
  }
  return { emails, marks };
}

function ownersChunk(emails: Set<string>, marks: Set<string>) {
  return { $or: [{ client_email: { $in: [...emails] } }, { shipping_mark: { $in: [...marks] } }] };
}

// Alcance del enlace: global (todo) o limitado a mayoristas, clientes y
// Shipping Marks concretos. Un alcance limitado sin nada elegido no ve nada.
export function scopeChunk(link: any, index: any) {
  if (scopeIsGlobal(link)) return null;
  const keys = scopeKeys(link);
  const emails = new Set<string>();
  const marks = new Set<string>();
  strList(link?.scope_client_emails).forEach((value) => emails.add(emailKeyOf(value)));
  strList(link?.scope_shipping_marks).forEach((value) => marks.add(markKeyOf(value)));
  if (keys.length) {
    const fromKeys = clientSetsForRows(index?.rows || [], keys);
    fromKeys.emails.forEach((email) => emails.add(email));
    fromKeys.marks.forEach((mark) => marks.add(mark));
  }
  emails.delete('');
  marks.delete('');
  return ownersChunk(emails, marks);
}

export function wholesalerChunk(key: any, index: any) {
  const sets = clientSetsForRows(index?.rows || [], [String(key || '').trim()]);
  return ownersChunk(sets.emails, sets.marks);
}

export function andFilters(...chunks: any[]) {
  const list = chunks.filter((chunk) => chunk && Object.keys(chunk).length > 0);
  if (list.length === 0) return {};
  if (list.length === 1) return list[0];
  return { $and: list };
}

// Filtros del portal, todos resueltos en el servidor. La fecha de recepción es
// la recepción física en almacén: un tracking por recibir no tiene ninguna, así
// que nunca se confunde con la fecha de registro del sistema.
export function portalQuery(params: any) {
  const link = params?.link;
  const index = params?.index;
  const f = params?.filters || {};
  const chunks: any[] = [];

  const scope = scopeChunk(link, index);
  if (scope) chunks.push(scope);

  const q = String(f.q || '').trim();
  if (q) {
    chunks.push({
      $or: [
        { tracking_number: { $regex: escapeRegex(q), $options: 'i' } },
        { shipping_mark: { $regex: escapeRegex(q), $options: 'i' } },
      ],
    });
  }

  const client = emailKeyOf(f.cliente);
  if (client) chunks.push({ client_email: { $regex: escapeRegex(client), $options: 'i' } });

  const estado = String(f.estado || '').trim();
  if (estado === 'recibido') chunks.push({ received_date: { $ne: null } });
  else if (estado === 'por_recibir') chunks.push({ received_date: null });

  const wholesalerKey = String(f.wholesaler_key || '').trim();
  if (wholesalerKey) chunks.push(wholesalerChunk(wholesalerKey, index));

  const origen = String(f.origen || '').trim();
  if (origen === 'mayorista') {
    chunks.push({ $or: [{ client_email: { $in: index.emails } }, { shipping_mark: { $in: index.marks } }] });
  } else if (origen === 'directo') {
    chunks.push({ client_email: { $nin: index.emails }, shipping_mark: { $nin: index.marks } });
  }

  const registro = caracasRange(f.registro_desde, f.registro_hasta);
  if (registro) chunks.push({ created_date: registro });

  const recepcion = caracasRange(f.recepcion_desde, f.recepcion_hasta);
  if (recepcion) chunks.push({ received_date: recepcion });

  return andFilters(...chunks);
}

// Contar con búsqueda por texto libre cuesta demasiado en la base (la consulta
// se cuelga): cuando hay texto el portal no calcula el total filtrado y lo
// informa como no disponible, en vez de arriesgar un error o un número falso.
export function portalQueryHasText(filters: any) {
  const f = filters || {};
  return !!String(f.q || '').trim() || !!String(f.cliente || '').trim();
}

export async function portalPage(base44: any, query: any, limit: number, cursor?: string) {
  const options: any = { sort: '-created_date', limit, fields: PORTAL_PAGE_FIELDS };
  if (cursor) options.cursor = cursor;
  return await base44.asServiceRole.entities.Package.filter(query, options);
}

// La foto del vendedor es un archivo privado y solo se abre con un enlace
// temporal. Antes de firmarlo se busca el paquete con el mismo alcance del
// enlace: si no aparece entre los registros permitidos, no hay foto que dar.
export async function portalPhotoPackage(base44: any, link: any, index: any, packageId: any) {
  const id = String(packageId || '').trim();
  if (!id) return null;
  const page = await portalPage(base44, andFilters(scopeChunk(link, index), { id }), 1);
  return (page?.items || [])[0] || null;
}

export function portalRow(pkg: any, index: any) {
  const owner = ownerOf(index, pkg);
  const registro = caracasDayKey(pkg?.created_date);
  const recepcion = caracasDayKey(pkg?.received_date);
  const email = emailKeyOf(pkg?.client_email);
  return {
    id: pkg?.id || '',
    tracking_number: String(pkg?.tracking_number || ''),
    shipping_mark: String(pkg?.shipping_mark || ''),
    wholesaler: owner.wholesaler_name,
    client: owner.client_name || email,
    client_email: email,
    registro,
    recepcion,
    estado: recepcion ? 'recibido' : 'por_recibir',
    origen: owner.origen,
    // Solo se informa que hay foto: la dirección del archivo privado nunca sale
    // del servidor, que la firma al momento de abrirla.
    has_photo: !!String(pkg?.seller_delivery_photo_uri || '').trim(),
  };
}

export async function portalWholesalerOptions(base44: any, link: any) {
  const connections = await listWholesalerConnections(base44);
  const keys = scopeKeys(link);
  const allowed = scopeIsGlobal(link) ? connections : connections.filter((c: any) => keys.includes(connectionKeyOf(c)));
  return allowed.map((c: any) => ({ key: connectionKeyOf(c), name: connectionLabel(c) }));
}

export function publicLink(link: any) {
  return {
    label: String(link?.label || ''),
    scope_mode: scopeIsGlobal(link) ? 'global' : 'limitado',
    scope_wholesaler_names: strList(link?.scope_wholesaler_names),
    scope_clients: strList(link?.scope_client_emails).length,
    scope_marks: strList(link?.scope_shipping_marks).length,
    access_code_required: !!link?.access_code_set,
    expires_at: link?.expires_at || null,
    read_only: true,
  };
}

export async function loadPortalLink(base44: any, token: any) {
  const clean = String(token || '').trim();
  if (!clean) return { ok: false, reason: 'sin_token' };
  const hash = await sha256Hex(clean);
  const page = await base44.asServiceRole.entities.SharedPortalLink.filter(
    { token_hash: hash },
    { sort: '-created_date', limit: 1 }
  );
  const link = (page?.items || [])[0];
  if (!link) return { ok: false, reason: 'no_existe' };
  if (link.active === false || link.revoked_date) return { ok: false, reason: 'revocado', link };
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return { ok: false, reason: 'vencido', link };
  return { ok: true, link };
}

export async function codeMatches(link: any, code: any) {
  if (!link?.access_code_set || !link?.access_code_hash) return { ok: true };
  const clean = String(code || '').trim();
  if (!clean) return { ok: false, reason: 'codigo_requerido' };
  const hash = await sha256Hex(clean);
  return hash === link.access_code_hash ? { ok: true } : { ok: false, reason: 'codigo_incorrecto' };
}

export function portalErrorText(reason: any) {
  if (reason === 'revocado') return 'Este enlace fue revocado por TLEC CARGO';
  if (reason === 'vencido') return 'Este enlace ya venció';
  if (reason === 'sin_token') return 'Falta el enlace de acceso';
  return 'El enlace no es válido';
}

export function portalFiltersSummary(filters: any) {
  const f = filters || {};
  const parts: string[] = [];
  const estadoText: any = { recibido: 'recibido', por_recibir: 'por recibir' };
  const origenText: any = { mayorista: 'mayorista', directo: 'registro directo' };
  if (f.q) parts.push(`búsqueda: ${String(f.q).slice(0, 60)}`);
  if (f.estado) parts.push(`estado: ${estadoText[f.estado] || f.estado}`);
  if (f.origen) parts.push(`origen: ${origenText[f.origen] || f.origen}`);
  if (f.cliente) parts.push(`cliente: ${String(f.cliente).slice(0, 60)}`);
  if (f.wholesaler_key) parts.push(`mayorista: ${String(f.wholesaler_key).slice(0, 40)}`);
  if (f.registro_desde || f.registro_hasta) {
    parts.push(`registro: ${f.registro_desde || 'inicio'} a ${f.registro_hasta || 'hoy'}`);
  }
  if (f.recepcion_desde || f.recepcion_hasta) {
    parts.push(`recepción: ${f.recepcion_desde || 'inicio'} a ${f.recepcion_hasta || 'hoy'}`);
  }
  return parts.join(' · ') || 'sin filtros';
}

export async function logPortalEvent(base44: any, link: any, event: any) {
  await base44.asServiceRole.entities.SharedPortalAccessLog.create({
    link_id: link?.id || '',
    link_label: String(link?.label || ''),
    event_date: new Date().toISOString(),
    ...event,
  });
}

export async function touchPortalLink(base44: any, link: any, patch: any) {
  await base44.asServiceRole.entities.SharedPortalLink.update(link.id, patch);
}

export function portalShortFormat(value: any) {
  return String(value || '').trim().slice(0, 12);
}