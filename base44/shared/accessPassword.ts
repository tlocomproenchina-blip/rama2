// Contraseña opcional de ingreso para enlaces públicos (portal de proveedores, presupuestos).
// Se guarda solo el hash con sal; la contraseña nunca queda en texto plano.

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Campos a guardar en el registro. Contraseña vacía = quitar la protección.
export async function passwordFields(plain: any) {
  const clean = String(plain || '').trim();
  if (!clean) return { access_password_hash: '', access_password_salt: '' };
  const salt = crypto.randomUUID();
  return { access_password_hash: await sha256Hex(`${salt}:${clean}`), access_password_salt: salt };
}

// null = acceso permitido; si no, el motivo del rechazo.
export async function passwordError(record: any, plain: any) {
  if (!record?.access_password_hash) return null;
  const clean = String(plain || '').trim();
  if (!clean) return 'Este enlace pide contraseña';
  const hash = await sha256Hex(`${record.access_password_salt || ''}:${clean}`);
  return hash === record.access_password_hash ? null : 'Contraseña incorrecta';
}

export function passwordDenied(reason: string) {
  return Response.json({ error: reason, password_required: true }, { status: 401 });
}

export function stripPassword(record: any) {
  if (!record) return record;
  const { access_password_hash, access_password_salt, ...safe } = record;
  return { ...safe, access_password_set: !!access_password_hash };
}