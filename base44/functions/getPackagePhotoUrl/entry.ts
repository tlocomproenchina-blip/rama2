import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { canViewPackagePhoto, sellerPhotoUriOf, signPrivateFile } from '../../shared/packagePhoto.ts';

// Enlace temporal para ver la foto con la que el cliente respaldó la entrega
// del vendedor. La foto es un archivo privado: aquí se valida quién la pide
// antes de firmar el enlace, y este vence en minutos.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const packageId = String(body?.package_id || '').trim();
    if (!packageId) return Response.json({ error: 'package_id requerido' }, { status: 400 });

    const pkg = await base44.asServiceRole.entities.Package.get(packageId);
    if (!pkg) return Response.json({ error: 'Paquete no encontrado' }, { status: 404 });

    if (!canViewPackagePhoto(user, pkg)) {
      return Response.json({ error: 'No autorizado para ver esta foto' }, { status: 403 });
    }

    const uri = sellerPhotoUriOf(pkg);
    if (!uri) return Response.json({ error: 'Este paquete no tiene foto del vendedor' }, { status: 404 });

    const url = await signPrivateFile(base44, uri);
    if (!url) return Response.json({ error: 'No se pudo abrir la foto' }, { status: 500 });

    return Response.json({ ok: true, url, tracking_number: String(pkg?.tracking_number || '') });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'No se pudo abrir la foto' }, { status: 500 });
  }
}