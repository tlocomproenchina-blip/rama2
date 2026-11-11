import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { ensureOperatorCode } from '../../shared/operatorCode.ts';

// Devuelve el código de operador (ej. "01") de quien lo consulta si pertenece al área de
// almacén, asignándolo de forma consecutiva la primera vez.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e?.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const operator_code = await ensureOperatorCode(base44.asServiceRole.entities, user);
    return Response.json({ operator_code });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}