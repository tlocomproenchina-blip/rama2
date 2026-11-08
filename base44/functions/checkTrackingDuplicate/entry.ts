import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { findTrackingOwners, publicOwner } from '../../shared/trackingDuplicates.ts';

// Al escanear un tracking en la Mesa de empaque: dice si ya está en una caja o bulto
// (abierto o registrado) para bloquear el doble registro antes de empacarlo.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo personal del almacén' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const code = String(body.code || '').trim();
    if (!code) return Response.json({ error: 'Falta el código' }, { status: 400 });

    const owners = await findTrackingOwners(base44, [{ code, package_id: String(body.package_id || '') }]);
    return Response.json({ duplicate: owners[0] ? publicOwner(owners[0]) : null });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}