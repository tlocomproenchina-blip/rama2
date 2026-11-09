import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { linkLabelTracking, LinkError } from '../../shared/labelLink.ts';

// El cliente asigna el tracking a una de sus etiquetas de envío.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const labelCode = String(body.label_code || '').trim();
    const tracking = String(body.tracking_number || '').trim();
    if (!labelCode || !tracking) return Response.json({ error: 'Etiqueta y tracking requeridos' }, { status: 400 });
    const result = await linkLabelTracking(base44, { user, labelCode, tracking });
    return Response.json({ success: true, package: result.package, merged: result.merged });
  } catch (error) {
    const status = error instanceof LinkError ? error.status : 500;
    return Response.json({ error: error.message }, { status });
  }
});