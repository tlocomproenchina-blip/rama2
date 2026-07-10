import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper: trim and normalize newlines
function clean(text) {
  return (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .trim();
}

// Parse the TXT into sections by "🟦 ... INTENT: <TITLE>"
function extractSections(raw) {
  const text = clean(raw);
  const lines = text.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    const hdr = line.match(/^🟦\s*\d+\.\s*INTENT:\s*(.+)$/i);
    if (hdr) {
      if (current) sections.push(current);
      current = { title: hdr[1].trim(), body: '' };
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line;
    }
  }
  if (current) sections.push(current);
  return sections;
  }

  // Extract explicit Intent ID from section body (if present)
  function extractIntentId(body) {
  const text = clean(body || '');
  const lower = text.toLowerCase();
  const idx = lower.indexOf('intent id');
  if (idx === -1) return null;
  const after = text.slice(idx).split('\n').slice(1)
    .map(l => l.trim())
    .filter(Boolean);
  const cand = after.find(l => /^[a-z0-9_]+$/.test(l));
  return cand || null;
  }

  // Map intent titles/ids to KB topics, categories and tags
  function mapToKb(section) {
  const t = (section.title || '').toLowerCase();
  const intentId = extractIntentId(section.body);

  const dict = {
    info_servicio: { kbTitle: '🧭 Servicio: Información General', category: 'general', tags: ['bot_kb', 'tema:servicio', 'intent:info_servicio'] },
    consulta_costos: { kbTitle: '💵 Costos de Envío', category: 'envios', tags: ['bot_kb', 'tema:costos', 'intent:consulta_costos'] },
    calculo_cbm: { kbTitle: '📦 Cálculo Logístico (CBM)', category: 'envios', tags: ['bot_kb', 'tema:calculo', 'intent:calculo_cbm'] },
    tracking_envio: { kbTitle: '🔎 Tracking de Envío', category: 'envios', tags: ['bot_kb', 'tema:tracking', 'intent:tracking_envio'] },
    tiempos_envio: { kbTitle: '⏱️ Tiempos de Envío', category: 'envios', tags: ['bot_kb', 'tema:tiempos', 'intent:tiempos_envio'] },
    reclamo_logistico: { kbTitle: '🛠️ Reclamos Logísticos', category: 'soporte', tags: ['bot_kb', 'tema:reclamos', 'intent:reclamo_logistico'] },
    metodos_pago: { kbTitle: '💳 Métodos de Pago', category: 'pagos', tags: ['bot_kb', 'tema:pagos', 'intent:metodos_pago'] },
    delivery_nacional: { kbTitle: '🚚 Delivery Nacional (VE)', category: 'envios', tags: ['bot_kb', 'tema:delivery', 'intent:delivery_nacional'] },
    compra_asistida: { kbTitle: '🛒 Compra Asistida', category: 'general', tags: ['bot_kb', 'tema:compra', 'intent:compra_asistida'] },
    gestion_cuenta: { kbTitle: '👤 Gestión de Cuenta', category: 'soporte', tags: ['bot_kb', 'tema:cuenta', 'intent:gestion_cuenta'] },
    mercancia_prohibida: { kbTitle: '⛔ Mercancía Prohibida', category: 'politicas', tags: ['bot_kb', 'tema:politicas', 'intent:mercancia_prohibida'] },
    verificacion_seguridad: { kbTitle: '🛡️ Seguridad y Verificación', category: 'politicas', tags: ['bot_kb', 'tema:seguridad', 'intent:verificacion_seguridad'] },
    consulta_irreal: { kbTitle: '❓ Consultas No Viables', category: 'soporte', tags: ['bot_kb', 'tema:otros', 'intent:consulta_irreal'] },
    educacion_importador: { kbTitle: '📚 Educación para Importadores', category: 'general', tags: ['bot_kb', 'tema:educacion', 'intent:educacion_importador'] },
  };

  if (intentId && dict[intentId]) return dict[intentId];

  // Title-based heuristics fallback
  if (t.includes('información general') || t.includes('informacion general')) return dict.info_servicio;
  if (t.includes('costo de envío') || t.includes('costo de envio') || t.includes('costos')) return dict.consulta_costos;
  if (t.includes('cálculo logístico') || t.includes('calculo logistico') || t.includes('cbm')) return dict.calculo_cbm;
  if (t.includes('tracking')) return dict.tracking_envio;
  if (t.includes('tiempos')) return dict.tiempos_envio;
  if (t.includes('reclamo') || t.includes('reclamos')) return dict.reclamo_logistico;
  if (t.includes('pagos') || t.includes('métodos de pago') || t.includes('metodos de pago')) return dict.metodos_pago;
  if (t.includes('delivery')) return dict.delivery_nacional;
  if (t.includes('compra asistida')) return dict.compra_asistida;
  if (t.includes('gestión de cuenta') || t.includes('gestion de cuenta') || t.includes('cuenta')) return dict.gestion_cuenta;
  if (t.includes('prohibida') || t.includes('prohibidos')) return dict.mercancia_prohibida;
  if (t.includes('seguridad') || t.includes('verificación') || t.includes('verificacion')) return dict.verificacion_seguridad;

  return { kbTitle: `📘 ${section.title}`, category: 'general', tags: ['bot_kb'] };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch { user = null; }
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    // Allow passing custom file_url, but default to the uploaded one from chat
    const fileUrl = body.file_url || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695da428c9924ef9b68e8866/089268fd0_clientes-filtrados-2026-03-02.txt';

    // SSRF guard: only HTTPS URLs from trusted storage hosts are allowed
    const ALLOWED_HOSTS = ['qtrypzzcjebvfcihiynt.supabase.co', 'media.base44.com', 'base44.app'];
    let parsedUrl;
    try { parsedUrl = new URL(fileUrl); } catch {
      return Response.json({ error: 'file_url inválida' }, { status: 400 });
    }
    if (parsedUrl.protocol !== 'https:' || !ALLOWED_HOSTS.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h))) {
      return Response.json({ error: 'file_url no permitida: solo HTTPS desde almacenamiento autorizado' }, { status: 400 });
    }

    const res = await fetch(fileUrl);
    if (!res.ok) {
      return Response.json({ error: `No se pudo descargar el archivo (${res.status})` }, { status: 400 });
    }

    const raw = await res.text();
    const sections = extractSections(raw);

    if (!sections.length) {
      return Response.json({ error: 'No se encontraron secciones con el patrón de INTENT en el archivo' }, { status: 400 });
    }

    const results = [];

    for (const sec of sections) {
      const meta = mapToKb(sec);
      const content = `${sec.body.trim()}`; // Mantener emojis y estilo tal cual

      // Upsert por (title + category)
      const existing = await base44.asServiceRole.entities.KnowledgeBase.filter({ title: meta.kbTitle, category: meta.category }, '-created_date', 1);
      if (existing && existing.length > 0) {
        const updated = await base44.asServiceRole.entities.KnowledgeBase.update(existing[0].id, {
          content,
          tags: meta.tags,
          status: 'published',
          document_url: fileUrl
        });
        results.push({ action: 'updated', id: updated.id, title: meta.kbTitle, category: meta.category });
      } else {
        const created = await base44.asServiceRole.entities.KnowledgeBase.create({
          title: meta.kbTitle,
          content,
          category: meta.category,
          tags: meta.tags,
          status: 'published',
          document_url: fileUrl
        });
        results.push({ action: 'created', id: created.id, title: meta.kbTitle, category: meta.category });
      }
    }

    return Response.json({ success: true, count: results.length, items: results });
  } catch (error) {
    return Response.json({ error: error.message || 'Server error' }, { status: 500 });
  }
});