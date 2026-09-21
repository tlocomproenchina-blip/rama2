import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const onlyIds: string[] = Array.isArray(body?.only_ids) ? body.only_ids.filter(Boolean) : [];
    // Lote pequeño por defecto para evitar timeout del navegador
    const limit = Math.min(Number(body?.limit) || 3, 10);

    // 1) Cargar huérfanos con fotos, excluyendo los ya marcados como ai_unreadable
    let orphans: any[] = [];
    if (onlyIds.length > 0) {
      // Cargar por IDs (filtrar ai_unreadable en memoria)
      const rows = await base44.asServiceRole.entities.Package.filter({ is_orphan: true }, '-created_date', 200);
      orphans = rows.filter((r: any) => onlyIds.includes(r.id) && r.ai_unreadable !== true);
    } else {
      orphans = await base44.asServiceRole.entities.Package.filter({ is_orphan: true }, '-created_date', 200);
      // Excluir los marcados como no legibles por IA
      orphans = orphans.filter((p: any) => p.ai_unreadable !== true);
    }

    // Filtrar solo los que tienen al menos una foto
    const withPhotos = orphans.filter((p) => {
      const urls = Array.isArray(p.package_image_urls) && p.package_image_urls.length
        ? p.package_image_urls
        : (p.package_image_url ? [p.package_image_url] : []);
      return urls.length > 0;
    });

    // Procesar solo el lote actual
    const batch = withPhotos.slice(0, limit);
    const remaining = withPhotos.length - batch.length;

    const results: any[] = [];
    let assigned = 0;
    let unreadable = 0;
    let notFound = 0;
    let errors = 0;

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
          // Marcar como no legible por IA para excluir de futuros escaneos
          await base44.asServiceRole.entities.Package.update(orphan.id, { ai_unreadable: true });
          results.push({ orphan_id: orphan.id, tracking_number: orphan.tracking_number, status: 'unreadable' });
          unreadable++;
          continue;
        }

        // 3) Buscar un paquete NO huérfano con ese tracking (o sub-tracking)
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
          const found = matches?.find((m: any) => m.is_orphan === false && m.client_email);
          if (found) {
            matchedPkg = found;
            break;
          }
        }

        // 4) Buscar también por label_code (etiqueta TLEC)
        if (!matchedPkg) {
          const labelMatches = await base44.asServiceRole.entities.Package.filter(
            { label_code: tracking }, '-created_date', 5
          );
          const found = labelMatches?.find((m: any) => m.is_orphan === false && m.client_email);
          if (found) matchedPkg = found;
        }

        if (!matchedPkg) {
          results.push({ orphan_id: orphan.id, tracking_number: orphan.tracking_number, detected_tracking: tracking, status: 'no_client_match' });
          notFound++;
          continue;
        }

        // 5) Asignar el huérfano al cliente del paquete encontrado
        await base44.asServiceRole.entities.Package.update(orphan.id, {
          tracking_number: matchedPkg.tracking_number || tracking,
          client_email: matchedPkg.client_email,
          shipping_mark: matchedPkg.shipping_mark || '',
          is_orphan: false,
          ai_unreadable: false,
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