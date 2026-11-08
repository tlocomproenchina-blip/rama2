import { isAreaEmployee, presetFor } from './roleAreas.ts';

// Quién puede enviar correos y avisos (email / push) a otras personas.
// - Administradores sin área: siempre.
// - Empleados de área: solo si su área tiene acceso a una pantalla que envía
//   correos a clientes (configuración guardada del área o su predeterminada).
// - Cualquier otra cuenta (clientes, empleados sin permiso): solo a sí misma o
//   al equipo administrador.

// Pantallas desde las que se envían correos o avisos a los clientes.
export const EMAIL_PAGES = [
  'AdminClients', 'AdminPackages', 'AdminInvoices', 'AdminManualBilling', 'AdminConsolidate',
  'AdminQuotes', 'AdminShipmentApprovals', 'ShipmentTracking', 'ClientAnalytics',
  'AdminSupportCRM', 'AdminSupportClients', 'AdminSupportCollections', 'AdminSupportTickets',
  'AdminSupportAssistant', 'AdminSupportSupervisor', 'AdminPayments', 'AdminAssistedPayments',
  'AdminPaymentAlerts', 'AdminEmailCampaigns', 'AdminDeliveryProofCampaign', 'AdminMarketing',
];

const lower = (v: any) => String(v || '').trim().toLowerCase();

async function areaPages(base44: any, user: any): Promise<string[]> {
  const code = lower(user.custom_role);
  const page = await base44.asServiceRole.entities.RoleConfig
    .filter({ role_code: user.custom_role, is_active: true }, { sort: '-updated_date', limit: 1 })
    .catch(() => null);
  const saved = page?.items?.[0];
  if (saved) return Array.isArray(saved.visible_pages) ? saved.visible_pages : [];
  return presetFor(code)?.visible_pages || [];
}

export async function canSendToAnyone(base44: any, user: any) {
  if (user?.role !== 'admin') return false;
  if (!isAreaEmployee(user)) return true;
  const pages = await areaPages(base44, user);
  return pages.some((p) => EMAIL_PAGES.includes(p));
}

// Devuelve null si el envío está permitido, o el motivo del rechazo.
export async function sendDeniedReason(base44: any, user: any, recipients: any[]) {
  // Llamadas internas de otras funciones del sistema (identidad de servicio, sin email).
  if (!user?.email) return null;
  if (await canSendToAnyone(base44, user)) return null;
  const self = lower(user?.email);
  const others = recipients.map(lower).filter((r) => r && r !== self);
  if (!others.length) return null;
  const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
  const adminEmails = new Set((admins || []).map((u: any) => lower(u.email)));
  if (others.every((r) => adminEmails.has(r))) return null;
  return user?.role === 'admin'
    ? 'Tu área no tiene permiso para enviar correos o avisos a clientes'
    : 'Solo puedes enviar avisos a tu propia cuenta o al equipo';
}