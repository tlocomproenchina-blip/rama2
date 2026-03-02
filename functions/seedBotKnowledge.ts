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

// Map intent titles to KB topics, categories and tags
function mapToKb(section) {
  const t = section.title.toLowerCase();
  if (t.includes('información general') || t.includes('informacion general')) {
    return {
      kbTitle: '🧭 Servicio: Información General',
      category: 'general',
      tags: ['bot_kb', 'tema:servicio', 'intent:info_servicio']
    };
  }
  if (t.includes('costo de envío') || t.includes('costo de envio') || t.includes('costos')) {
    return {
      kbTitle: '💵 Costos de Envío',
      category: 'envios',
      tags: ['bot_kb', 'tema:costos', 'intent:consulta_costos']
    };
  }
  if (t.includes('cálculo logístico') || t.includes('calculo logistico') || t.includes('cbm')) {
    return {
      kbTitle: '📦 Cálculo Logístico (CBM)',
      category: 'envios',
      tags: ['bot_kb', 'tema:calculo', 'intent:calculo_cbm']
    };
  }
  if (t.includes('tracking')) {
    return {
      kbTitle: '🔎 Tracking de Envío',
      category: 'envios',
      tags: ['bot_kb', 'tema:tracking', 'intent:tracking_envio']
    };
  }
  if (t.includes('pagos') || t.includes('métodos de pago') || t.includes('metodos de pago')) {
    return {
      kbTitle: '💳 Métodos de Pago',
      category: 'pagos',
      tags: ['bot_kb', 'tema:pagos', 'intent:metodos_pago']
    };
  }
  // Fallback: general
  return {
    kbTitle: `📘 ${section.title}`,
    category: 'general',
    tags: ['bot_kb']
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Allow passing custom file_url, but default to the uploaded one from chat
    const fileUrl = body.file_url || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695da428c9924ef9b68e8866/be9dd4c25_clientes-filtrados-2026-03-02.txt';

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