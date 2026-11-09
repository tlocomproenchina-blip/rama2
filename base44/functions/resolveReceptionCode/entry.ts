import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { packageForReceptionLabel } from '../../shared/labelLink.ts';

// Recepción: resuelve un código escaneado que no es tracking como etiqueta de
// envío del cliente, sin crear paquetes duplicados.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const isWarehouse = user.role === 'admin' || user.custom_role === 'almacen' || user.custom_role === 'operaciones';
    if (!isWarehouse) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { code } = await req.json();
    if (!String(code || '').trim()) return Response.json({ error: 'Código requerido' }, { status: 400 });
    const result = await packageForReceptionLabel(base44, String(code));
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});