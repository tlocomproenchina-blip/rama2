// Foto con la que el cliente respalda la fecha en que el vendedor entregó el
// paquete al almacén. Vive en el almacenamiento privado de la app: nunca se
// guarda ni se envía su dirección, solo un enlace temporal firmado de pocos
// minutos que se pide en el momento de abrirla.
export const SELLER_PHOTO_FIELD = 'seller_delivery_photo_uri';

export function sellerPhotoUriOf(pkg: any): string {
  return String(pkg?.[SELLER_PHOTO_FIELD] || '').trim();
}

// Personal de TLEC CARGO: administradores y empleados con rol por área.
export function isTlecStaff(user: any): boolean {
  if (!user) return false;
  return user.role === 'admin' || !!user.custom_role;
}

// La abre el personal de TLEC CARGO y el dueño del paquete.
export function canViewPackagePhoto(user: any, pkg: any): boolean {
  if (!user) return false;
  if (isTlecStaff(user)) return true;
  const owner = String(pkg?.client_email || '').trim().toLowerCase();
  const email = String(user.email || '').trim().toLowerCase();
  return !!owner && owner === email;
}

// Enlace temporal de un archivo privado, para abrirlo sin exponer la dirección
// real. Se genera en cada consulta y no se almacena.
export async function signPrivateFile(base44: any, fileUri: string, expiresIn = 600): Promise<string> {
  const res = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
    file_uri: String(fileUri || ''),
    expires_in: expiresIn,
  });
  return String(res?.signed_url || '');
}