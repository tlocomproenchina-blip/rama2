// Textos y etiquetas del Portal de Consulta Compartido.
export const PORTAL_ESTADO_LABELS = { recibido: 'Recibido', por_recibir: 'Por recibir' };
export const PORTAL_ORIGEN_LABELS = { mayorista: 'Cliente mayorista', directo: 'Registro directo' };

export function portalEstadoLabel(estado) {
  return PORTAL_ESTADO_LABELS[estado] || 'Por recibir';
}

export function portalOrigenLabel(origen) {
  return PORTAL_ORIGEN_LABELS[origen] || 'Registro directo';
}

export function portalDayText(value) {
  return value ? String(value) : 'Pendiente';
}

export function portalDateTimeText(value) {
  if (!value) return 'Nunca';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nunca';
  return date.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function portalLinkStatus(link) {
  if (!link) return 'activo';
  if (link.active === false || link.revoked_date) return 'revocado';
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return 'vencido';
  return 'activo';
}

export function portalScopeText(link) {
  if (!link) return '';
  if (String(link.scope_mode || 'global') !== 'limitado') return 'Todos los mayoristas y registros directos';
  const parts = [];
  const names = (link.scope_wholesaler_names || []).filter(Boolean);
  if (names.length) parts.push(`Mayoristas: ${names.join(', ')}`);
  if ((link.scope_client_emails || []).length) parts.push(`${link.scope_client_emails.length} cliente(s)`);
  if ((link.scope_shipping_marks || []).length) parts.push(`${link.scope_shipping_marks.length} Shipping Mark(s)`);
  return parts.length ? parts.join(' · ') : 'Sin alcance definido: no muestra registros';
}

// El vencimiento se guarda como el inicio del día siguiente en hora de Caracas
// (el día elegido queda vigente completo); aquí se vuelve a ese día.
export function portalExpiryInput(iso) {
  if (!iso) return '';
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '';
  return new Date(time - 4 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Todos los enlaces del portal se construyen sobre el dominio registrado de la app.
export const PORTAL_BASE_URL = 'https://tleccargo.com';

export function portalLinkUrl(token) {
  if (!token) return '';
  return `${PORTAL_BASE_URL}/Portal/${token}`;
}

export async function copyText(value) {
  const text = String(value || '');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const area = document.createElement('textarea');
  area.value = text;
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  document.body.removeChild(area);
  return true;
}