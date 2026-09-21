import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Reclama huérfanos usando IA para leer el tracking de la foto.
// Procesa en lotes pequeños (default 3) para evitar timeout del navegador.
// - Marca ai_unreadable=true si la IA no puede leer el tracking.
// - Marca ai_attempted_date si la IA lee el tracking pero no hay cliente coincidente
//   (se excluye por 10 minutos para evitar reprocesar el mismo lote en bucle).
// - Busca coincidencia por tracking_number (con sub-tracking), label_code en Package,
//   y label_code en ShippingLabel (auto-crea pre-alerta como processBodegaScan).
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const onlyIds: string[] = Array.isArray(body?.only_ids) ? body.only_ids.filter(Boolean) : [];
    const limit = Math.min(Number(body?.limit) || 3, 10);

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
    let unreadable = 0;
    let notFound = 0;
    let errors = 0;
    const now = new Date().toISOString();

    for (const orphan of batch) {
      const photoUrl = (Array.isArray(orphan.package_image_urls) && orphan.package_image_urls.length
        ? orphan.package_image_urls[0]
        : orphan.package_image_url) as string;

      try {
        // 2) Extraer tracking con IA (visión)
        const aiRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Eres un asistente de logística. Examina la foto de un paquete y extrae el número de tracking (tracking number) que aparece en la etiqueta de envío. El número de tracking suele ser una cadena alfanumérica larga (ej: YT2423123456789012, LP009876543210, 4PX1234567890, 79142337780380, etc.). NO devuelvas el código de barras numérico genérico (EAN/UPC de producto). Devuelve SOLO el número de tracking de la transportadora. Si no puedes leer ningún tracking claro, devuelve null.`,
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

        const extracted = (aiRes as any)?.tracking_number;
        const tracking = typeof extracted === 'string' ? extracted.trim() : '';

        if (!tracking || tracking.length < 5) {
          await base44.asServiceRole.entities.Package.update(orphan.id, { ai_unreadable: true });
          results.push({ orphan_id: orphan.id, tracking_number: orphan.tracking_number, status: 'unreadable' });
          unreadable++;
          continue;
        }

        // 3) Buscar por tracking_number con candidatos de sub-tracking
        //    (relajado: cualquier Package con client_email, sin exigir is_orphan === false)
        const removalOrder = [0, 3, 2, 4, 1, 5, 6];
        const seenCandidates = new Set<string>();
        const candidates: string[] = [];
        for (const remove of removalOrder) {
          if (remove === 0) {
            if (!seenCandidates.has(tracking)) {
              seenCandidates.add(tracking);
              candidates.push(tracking);
            }
            continue;
          }
          if (tracking.length - remove < 5) continue;
          const candidate = tracking.slice(0, tracking.length - remove);
          if (!seenCandidates.has(candidate)) {
            seenCandidates.add(candidate);
            candidates.push(candidate);
          }
        }

        let matchedPkg: any = null;
        for (const candidate of candidates) {
          const matches = await base44.asServiceRole.entities.Package.filter(
            { tracking_number: candidate }, '-created_date', 5
          );
          const found = matches?.find((m: any) => m.client_email);
          if (found) {
            matchedPkg = found;
            break;
          }
        }

        // 4) Buscar por label_code en Package
        if (!matchedPkg) {
          const labelMatches = await base44.asServiceRole.entities.Package.filter(
            { label_code: tracking }, '-created_date', 5
          );
          const found = labelMatches?.find((m: any) => m.client_email);
          if (found) matchedPkg = found;
        }

        // 5) Buscar por label_code en ShippingLabel → auto-crear pre-alerta
        if (!matchedPkg) {
          const labels = await base44.asServiceRole.entities.ShippingLabel.filter(
            { label_code: tracking }, '-created_date', 1
          );
          const label = labels?.[0];
          if (label) {
            matchedPkg = await base44.asServiceRole.entities.Package.create({
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
                linked_package_id: matchedPkg.id,
              });
            } catch (_) {}
          }
        }

        if (!matchedPkg) {
          // IA leyó el tracking pero no hay cliente coincidente → marcar fecha de intento
          await base44.asServiceRole.entities.Package.update(orphan.id, { ai_attempted_date: now });
          results.push({ orphan_id: orphan.id, tracking_number: orphan.tracking_number, detected_tracking: tracking, status: 'no_client_match' });
          notFound++;
          continue;
        }

        // 6) Asignar el huérfano al cliente del paquete encontrado
        await base44.asServiceRole.entities.Package.update(orphan.id, {
          tracking_number: matchedPkg.tracking_number || tracking,
          client_email: matchedPkg.client_email,
          shipping_mark: matchedPkg.shipping_mark || '',
          is_orphan: false,
          ai_unreadable: false,
          ai_attempted_date: null,
          status: matchedPkg.status === 'pre_alerta' ? 'recibido' : matchedPkg.status,
          shipping_type: matchedPkg.shipping_type || orphan.shipping_type || 'maritimo',
        });

        results.push({
          orphan_id: orphan.id,
          old_tracking: orphan.tracking_number,
          detected_tracking: tracking,
          assigned_to: matchedPkg.client_email,
          matched_package_id: matchedPkg.id,
          status: 'assigned',
        });
        assigned++;
      } catch (err: any) {
        results.push({ orphan_id: orphan.id, tracking_number: orphan.tracking_number, status: 'error', error: err?.message || 'unknown' });
        errors++;
      }
    }

    return Response.json({
      batch_size: batch.length,
      assigned,
      unreadable,
      not_found: notFound,
      errors,
      results,
      has_more: remaining > 0,
      remaining,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}