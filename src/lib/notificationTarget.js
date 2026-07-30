import { createPageUrl } from '@/utils';

/**
 * Devuelve la URL a la que debe llevar una notificación al pulsarla.
 * Para admin se incluye un parámetro para abrir directamente el registro.
 */
export function getNotificationUrl(notif, user) {
  const isAdmin = user?.role === 'admin';
  const ref = notif?.reference_id;
  const title = String(notif?.title || '');
  const isTicket = /ticket|respuesta/i.test(title);

  if (notif?.type === 'package' && ref) {
    return isAdmin
      ? `${createPageUrl('AdminPackages')}?packageId=${ref}`
      : createPageUrl('MyPackages');
  }

  if (isTicket) {
    if (isAdmin) {
      return ref
        ? `${createPageUrl('AdminSupportTickets')}?ticketId=${ref}`
        : createPageUrl('AdminSupportTickets');
    }
    return createPageUrl('Support');
  }

  if (notif?.type === 'consolidation') {
    return createPageUrl(isAdmin ? 'ShipmentTracking' : 'MyConsolidations');
  }

  if (notif?.type === 'payment') {
    return createPageUrl(isAdmin ? 'AdminInvoices' : 'MyInvoices');
  }

  if (/usuario registrado|cliente/i.test(title) && isAdmin) {
    return createPageUrl('AdminClients');
  }

  return null;
}