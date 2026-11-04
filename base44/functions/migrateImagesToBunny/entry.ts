import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { copyUrlToBunny } from '../../shared/bunnyUpload.ts';

// Migra a Bunny las imágenes que todavía viven en el almacenamiento de Base44
// (enlaces públicos y archivos privados) y actualiza los registros con el enlace
// nuevo. Se procesa por páginas: { entity, cursor?, limit? } → { next_cursor, has_more }.
// También acepta { urls: [...] } para migrar enlaces sueltos y devolver el mapa viejo → nuevo.
// Los archivos que no son imágenes (PDF, Excel) se dejan donde están.

const ENTITIES = [
  'AppConfig', 'AssistedPaymentRequest', 'BlogPost', 'BodegaScanJob', 'Bulto', 'CajaInventoryReview',
  'DeliveryProofCampaign', 'EmailTemplate', 'EscaneoBodega', 'InsurancePayment', 'InternalCaseMessage',
  'InternalMessage', 'Invoice', 'InvoicePayment', 'Package', 'PackageEditRequest', 'PrivacyConfig',
  'ProviderCredit', 'ProviderInvoice', 'Quote', 'QuoteFeePayment', 'SupportClientNote',
  'SupportQuickMessage', 'SupportTicket', 'WarehouseIncident', 'KnowledgeBase', 'MarketingCampaign',
  'Promotion', 'ShippingProvider', 'FAQ', 'SeguimientoRuta',
];

const PUBLIC_RE = /https:\/\/(?:base44\.app\/api\/apps\/[A-Za-z0-9]+\/files\/[^\s"'<>)\]]+|media\.base44\.com\/[^\s"'<>)\]]+|[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/base44-prod\/[^\s"'<>)\]]+)/gi;
const PRIVATE_RE = /^(?:mp\/)?private\/[A-Za-z0-9_\-/.]+$/;
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|heic|heif|svg|avif|tiff?)$/i;

function collectRefs(value: any, refs: Set<string>) {
  if (typeof value === 'string') {
    for (const m of value.match(PUBLIC_RE) || []) refs.add(m);
    if (PRIVATE_RE.test(value) && IMAGE_EXT_RE.test(value)) refs.add(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectRefs(v, refs));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => collectRefs(v, refs));
  }
}

function replaceRefs(value: any, map: Map<string, string>): any {
  if (typeof value === 'string') {
    if (map.has(value)) return map.get(value);
    let out = value;
    for (const [from, to] of map) if (out.includes(from)) out = out.split(from).join(to);
    return out;
  }
  if (Array.isArray(value)) return value.map((v) => replaceRefs(v, map));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceRefs(v, map)]));
  }
  return value;
}

async function migrateRef(base44: any, ref: string): Promise<string | null> {
  let url = ref;
  if (PRIVATE_RE.test(ref)) {
    const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: ref, expires_in: 300 });
    url = signed?.signed_url;
    if (!url) throw new Error('sin enlace firmado');
  }
  return copyUrlToBunny(url, ref);
}

async function migrateAll(base44: any, refs: string[]) {
  const map = new Map<string, string>();
  const failed: string[] = [];
  let skipped = 0;
  for (let i = 0; i < refs.length; i += 5) {
    const chunk = refs.slice(i, i + 5);
    const results = await Promise.allSettled(chunk.map((r) => migrateRef(base44, r)));
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value) map.set(chunk[idx], r.value);
      else if (r.status === 'fulfilled') skipped += 1;
      else failed.push(`${chunk[idx].slice(-60)}: ${r.reason?.message || r.reason}`);
    });
  }
  return { map, failed, skipped };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));

    if (Array.isArray(body.urls)) {
      const { map, failed, skipped } = await migrateAll(base44, body.urls.map(String));
      return Response.json({ mapping: Object.fromEntries(map), failed, skipped });
    }

    const entity = String(body.entity || '');
    if (!ENTITIES.includes(entity)) {
      return Response.json({ error: 'entity inválida', entities: ENTITIES }, { status: 400 });
    }
    const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200);
    const page = await base44.asServiceRole.entities[entity].list({
      sort: 'created_date', limit, ...(body.cursor ? { cursor: body.cursor } : {}),
    });

    const pending: any[] = [];
    const allRefs = new Set<string>();
    for (const record of page.items || []) {
      const refs = new Set<string>();
      collectRefs(record, refs);
      if (refs.size) {
        pending.push(record);
        refs.forEach((r) => allRefs.add(r));
      }
    }

    const { map, failed, skipped } = await migrateAll(base44, [...allRefs]);

    let updated = 0;
    const updates = pending.map((record) => {
      const changes: Record<string, any> = {};
      for (const [key, value] of Object.entries(record)) {
        if (['id', 'created_date', 'updated_date', 'created_by_id', 'created_by'].includes(key)) continue;
        const next = replaceRefs(value, map);
        if (JSON.stringify(next) !== JSON.stringify(value)) changes[key] = next;
      }
      return Object.keys(changes).length ? { id: record.id, changes } : null;
    }).filter(Boolean) as { id: string; changes: Record<string, any> }[];

    for (let i = 0; i < updates.length; i += 5) {
      const chunk = updates.slice(i, i + 5);
      const results = await Promise.allSettled(
        chunk.map((u) => base44.asServiceRole.entities[entity].update(u.id, u.changes))
      );
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') updated += 1;
        else failed.push(`registro ${chunk[idx].id}: ${r.reason?.message || r.reason}`);
      });
    }

    return Response.json({
      entity,
      scanned: (page.items || []).length,
      images_migrated: map.size,
      skipped_non_image: skipped,
      records_updated: updated,
      failed: failed.slice(0, 20),
      failed_count: failed.length,
      has_more: !!page.has_more,
      next_cursor: page.has_more ? page.next_cursor : null,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}