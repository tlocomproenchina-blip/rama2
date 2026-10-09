import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  buildTrackingCandidates,
  consolidateOrphan,
  findDuplicateOrphans,
  findSameShipmentMatches,
  mergeDuplicateOrphans,
  pickConsolidationTarget,
  ORPHAN_ALREADY_CLAIMED,
} from '../../shared/orphanConsolidation.ts';

// Reclama huérfanos usando IA para leer el tracking de la foto.
// Procesa en lotes pequeños (default 3) para evitar timeout del navegador.
//
// Control de créditos de integración:
// - Ruta principal: Claude Sonnet 4.6 vía InvokeLLM (~4 créditos/call).
// - Ruta fallback: OpenAI directo (OPENAI_API_KEY) — NO consume créditos de integración.
// - El contador ai_reclaim_credits_used se rastrea en AppConfig y se resetea mensualmente.
// - Cuando el gasto estimado supera el 50% del presupuesto (ai_reclaim_monthly_budget),
//   se conmuta automáticamente a la ruta OpenAI directa.
//
// - Marca ai_unreadable=true si la IA no puede leer el tracking.
// - Marca ai_attempted_date si la IA lee el tracking pero no hay cliente coincidente
//   (se excluye por 10 minutos para evitar reprocesar el mismo lote en bucle).
// - Busca coincidencia por tracking_number (con sub-tracking), label_code en Package,
//   y label_code en ShippingLabel.
// - Unifica: si el envío ya tenía pre-alerta (o una etiqueta TLEC), el huérfano
//   recibido se queda como único registro del paquete y la pre-alerta se retira,
//   para no dejar el mismo envío registrado dos veces (orphanConsolidation.ts).
// - Fusiona huérfanos duplicados: si el tracking leído ya pertenece a otro huérfano
//   sin cliente (el mismo paquete dado de alta por otro método de identificación),
//   los dos registros se unen en uno en vez de dejar dos copias del mismo paquete.

const CLAUDE_COST_PER_CALL = 4; // créditos estimados por llamada a Claude Sonnet 4.6
const FALLBACK_THRESHOLD = 0.5;  // 50% del presupuesto

const VISION_PROMPT = `Eres un asistente de logística. Examina la foto de un paquete y extrae el número de tracking (tracking number) que aparece en la etiqueta de envío. El número de tracking suele ser una cadena alfanumérica larga (ej: YT2423123456789012, LP009876543210, 4PX1234567890, 79142337780380, etc.). NO devuelvas el código de barras numérico genérico (EAN/UPC de producto). Devuelve SOLO el número de tracking de la transportadora como una cadena CONTINUA sin espacios, guiones ni separadores de ningún tipo (ej: "YT2423123456789012", no "YT2423 1234 5678 9012"). Si no puedes leer ningún tracking claro, devuelve null.`;

// Extrae el tracking usando Claude Sonnet 4.6 vía InvokeLLM (consume créditos de integración).
async function extractTrackingClaude(base44: any, photoUrl: string): Promise<{ tracking: string | null; error?: string }> {
  try {
    const aiRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: VISION_PROMPT,
      file_urls: [photoUrl],
      model: 'claude_sonnet_4_6',
      response_json_schema: {
        type: 'object',
        properties: {
          tracking_number: { type: ['string', 'null'] },
        },
        required: ['tracking_number'],
      },
    });
    const extracted = (aiRes as any)?.tracking_number;
    const tracking = typeof extracted === 'string' ? extracted.replace(/\s+/g, '') : '';
    return { tracking: tracking || null };
  } catch (err: any) {
    return { tracking: null, error: err?.message || 'Claude InvokeLLM failed' };
  }
}

// Extrae el tracking usando OpenAI directo (OPENAI_API_KEY) — NO consume créditos de integración.
async function extractTrackingOpenAI(photoUrl: string): Promise<{ tracking: string | null; error?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { tracking: null, error: 'OPENAI_API_KEY not configured' };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: VISION_PROMPT + '\n\nResponde en JSON: {"tracking_number": "..." o null}' },
              { type: 'image_url', image_url: { url: photoUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { tracking: null, error: `OpenAI ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { tracking: null, error: 'OpenAI empty response' };
    const parsed = JSON.parse(content);
    const extracted = parsed?.tracking_number;
    const tracking = typeof extracted === 'string' ? extracted.replace(/\s+/g, '') : '';
    return { tracking: tracking || null };
  } catch (err: any) {
    return { tracking: null, error: err?.message || 'OpenAI direct failed' };
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const onlyIds: string[] = Array.isArray(body?.only_ids) ? body.only_ids.filter(Boolean) : [];
    const limit = Math.min(Number(body?.limit) || 3, 10);

    // Cargar AppConfig para decidir ruta (Claude vs OpenAI directo)
    const configRows = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
    const config = configRows?.[0] || {};
    const budget = typeof config.ai_reclaim_monthly_budget === 'number' ? config.ai_reclaim_monthly_budget : 200;
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    let creditsUsed = typeof config.ai_reclaim_credits_used === 'number' ? config.ai_reclaim_credits_used : 0;

    // Reset mensual automático
    if (config.ai_reclaim_counter_month !== currentMonth) {
      creditsUsed = 0;
      try {
        await base44.asServiceRole.entities.AppConfig.update(config.id, {
          ai_reclaim_credits_used: 0,
          ai_reclaim_counter_month: currentMonth,
        });
      } catch (_) {}
    }

    const useFallback = creditsUsed >= budget * FALLBACK_THRESHOLD;
    const activeRoute = useFallback ? 'openai_direct' : 'claude_invoke';

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // 1) Cargar huérfanos, excluyendo los ya marcados como ai_unreadable o
    //    intentados recientemente (ai_attempted_date dentro de 10 min)
    let orphans: any[] = [];
    if (onlyIds.length > 0) {
      const rows = await base44.asServiceRole.entities.Package.filter({ is_orphan: true }, '-created_date', 200);
      orphans = rows.filter((r: any) =>
        onlyIds.includes(r.id) &&
        r.ai_unreadable !== true &&
        (!r.ai_attempted_date || r.ai_attempted_date < tenMinAgo)
      );
    } else {
      orphans = await base44.asServiceRole.entities.Package.filter({ is_orphan: true }, '-created_date', 200);
      orphans = orphans.filter((p: any) =>
        p.ai_unreadable !== true &&
        (!p.ai_attempted_date || p.ai_attempted_date < tenMinAgo)
      );
    }

    // Filtrar solo los que tienen al menos una foto
    const withPhotos = orphans.filter((p) => {
      const urls = Array.isArray(p.package_image_urls) && p.package_image_urls.length
        ? p.package_image_urls
        : (p.package_image_url ? [p.package_image_url] : []);
      return urls.length > 0;
    });

    const batch = withPhotos.slice(0, limit);
    const remaining = withPhotos.length - batch.length;

    const results: any[] = [];
    let assigned = 0;
    let consolidated = 0;
    let labelLinked = 0;
    let conflicts = 0;
    let unreadable = 0;
    let notFound = 0;
    let errors = 0;
    let mergedDuplicates = 0;
    // Huérfanos que se fusionaron dentro de este mismo lote: ya no existen.
    const absorbed = new Set<string>();
    let claudeCalls = 0;
    let openaiCalls = 0;
    let routeFailures = 0;
    const now = new Date().toISOString();

    for (const orphan of batch) {
      // Un huérfano que se fusionó unas vueltas atrás ya no existe: se salta.
      if (absorbed.has(orphan.id)) continue;

      const photoUrl = (Array.isArray(orphan.package_image_urls) && orphan.package_image_urls.length
        ? orphan.package_image_urls[0]
        : orphan.package_image_url) as string;

      try {
        // 2) Extraer tracking con IA (visión) — ruta decidida por presupuesto
        let tracking = '';
        let routeUsed = activeRoute;
        let routeError: string | undefined;

        if (useFallback) {
          const r = await extractTrackingOpenAI(photoUrl);
          tracking = r.tracking || '';
          routeError = r.error;
          if (routeError) routeFailures++;
          openaiCalls++;
        } else {
          const r = await extractTrackingClaude(base44, photoUrl);
          tracking = r.tracking || '';
          routeError = r.error;
          claudeCalls++;
          // Sumar costo estimado al contador y persistir
          creditsUsed += CLAUDE_COST_PER_CALL;
          try {
            await base44.asServiceRole.entities.AppConfig.update(config.id, {
              ai_reclaim_credits_used: creditsUsed,
            });
          } catch (_) {}
          // Si la ruta Claude falló y aún queda presupuesto, intentar OpenAI como respaldo
          if (routeError && creditsUsed < budget * FALLBACK_THRESHOLD) {
            const r2 = await extractTrackingOpenAI(photoUrl);
            if (r2.tracking) {
              tracking = r2.tracking;
              routeUsed = 'openai_direct';
              routeError = undefined;
            }
            openaiCalls++;
          }
        }

        if (!tracking || tracking.length < 5) {
          // Si hubo error de ruta (no ilegibilidad real), no marcar ai_unreadable para reintentar luego
          if (routeError) {
            results.push({ orphan_id: orphan.id, tracking_number: orphan.tracking_number, status: 'route_error', error: routeError, route: routeUsed });
            errors++;
          } else {
            await base44.asServiceRole.entities.Package.update(orphan.id, { ai_unreadable: true });
            results.push({ orphan_id: orphan.id, tracking_number: orphan.tracking_number, status: 'unreadable', route: routeUsed });
            unreadable++;
          }
          continue;
        }

        // 3) ¿El tracking leído ya pertenece a otro huérfano sin cliente? Es el
        //    mismo paquete dado de alta dos veces por métodos distintos (escáner,
        //    IA, registro manual): se fusionan en un solo registro.
        const candidates = buildTrackingCandidates(tracking);
        const twins = await findDuplicateOrphans(base44, { candidates, excludeId: orphan.id });
        if (twins.length > 0) {
          const merge = await mergeDuplicateOrphans({ base44, keep: twins[0], duplicate: orphan, by: user.email });
          absorbed.add(orphan.id);
          results.push({
            orphan_id: orphan.id,
            old_tracking: orphan.tracking_number,
            detected_tracking: tracking,
            kept_package_id: merge.package?.id,
            removed_duplicate_id: merge.removed_id,
            status: 'merged_duplicate',
            route: routeUsed,
          });
          mergedDuplicates++;
          continue;
        }

        // 4) Buscar la pre-alerta del mismo envío (tracking exacto y sub-trackings)
        const matches = await findSameShipmentMatches(base44, { candidates, labelCode: tracking, excludeId: orphan.id });
        const picked = pickConsolidationTarget(matches.pending);

        // Pre-alertas de más de un cliente con el mismo tracking: no se borra nada,
        // el huérfano queda para revisión.
        if (picked.ambiguous) {
          await base44.asServiceRole.entities.Package.update(orphan.id, { ai_attempted_date: now });
          results.push({ orphan_id: orphan.id, old_tracking: orphan.tracking_number, detected_tracking: tracking, status: 'conflict', reason: 'prealertas_de_varios_clientes', route: routeUsed });
          conflicts++;
          continue;
        }

        const prealert = picked.target;

        // Ya existe un paquete recibido con ese tracking: es un duplicado real, no se
        // unifica ni se borra nada.
        if (!prealert && matches.received.length > 0) {
          await base44.asServiceRole.entities.Package.update(orphan.id, { ai_attempted_date: now });
          results.push({
            orphan_id: orphan.id,
            old_tracking: orphan.tracking_number,
            detected_tracking: tracking,
            status: 'conflict',
            reason: 'paquete_ya_recibido',
            matched_package_id: matches.received[0].id,
            matched_client_email: matches.received[0].client_email,
            route: routeUsed,
          });
          conflicts++;
          continue;
        }

        // 4) Sin pre-alerta: buscar la etiqueta TLEC del código escaneado (su cliente
        //    y su contenido vienen en la etiqueta, así que no hace falta crear un
        //    segundo registro del paquete).
        let label: any = null;
        if (!prealert) {
          const labels = await base44.asServiceRole.entities.ShippingLabel.filter(
            { label_code: tracking }, '-created_date', 1
          );
          label = labels?.[0] || null;
        }

        // Sin pre-alerta ni etiqueta: el tracking todavía no está registrado
        if (!prealert && !label) {
          await base44.asServiceRole.entities.Package.update(orphan.id, {
            tracking_number: tracking,
            ai_attempted_date: now,
          });
          results.push({ orphan_id: orphan.id, old_tracking: orphan.tracking_number, detected_tracking: tracking, status: 'no_client_match', route: routeUsed });
          notFound++;
          continue;
        }

        // 5) Unificar: se conserva este paquete recibido (con su foto y sus datos de
        //    almacén) y se retira la pre-alerta, para no dejar el envío dos veces.
        let unification: any;
        try {
          unification = await consolidateOrphan({ base44, orphan, prealert, label });
        } catch (err: any) {
          if (err?.message === ORPHAN_ALREADY_CLAIMED) {
            results.push({ orphan_id: orphan.id, old_tracking: orphan.tracking_number, detected_tracking: tracking, status: 'already_claimed', route: routeUsed });
            continue;
          }
          throw err;
        }

        results.push({
          orphan_id: orphan.id,
          old_tracking: orphan.tracking_number,
          detected_tracking: tracking,
          assigned_to: unification.package?.client_email,
          matched_package_id: prealert?.id || null,
          merged_from_label: label ? label.label_code : null,
          merged_fields: unification.merged_fields,
          status: 'consolidated',
          route: routeUsed,
        });
        if (prealert) consolidated++;
        else labelLinked++;
        assigned++;
      } catch (err: any) {
        results.push({ orphan_id: orphan.id, tracking_number: orphan.tracking_number, status: 'error', error: err?.message || 'unknown' });
        errors++;
      }
    }

    return Response.json({
      batch_size: batch.length,
      assigned,
      consolidated,
      merged: mergedDuplicates,
      label_linked: labelLinked,
      conflicts,
      unreadable,
      not_found: notFound,
      errors,
      results,
      has_more: remaining > 0,
      remaining,
      route: activeRoute,
      credits_used: creditsUsed,
      credits_budget: budget,
      claude_calls: claudeCalls,
      openai_calls: openaiCalls,
      route_failures: routeFailures,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}