// Todos los enlaces públicos de la app (los que se comparten fuera de la sesión:
// guías, seguimiento, presupuestos, portal, referidos, avisos por correo) usan el
// dominio registrado y nunca la dirección de vista previa.
export const PUBLIC_BASE_URL = 'https://tleccargo.com';

export function publicAppUrl(path = '/') {
  const clean = String(path || '').trim();
  if (!clean) return PUBLIC_BASE_URL;
  return `${PUBLIC_BASE_URL}${clean.startsWith('/') ? clean : `/${clean}`}`;
}