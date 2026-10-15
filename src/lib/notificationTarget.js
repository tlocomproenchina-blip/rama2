import { createPageUrl } from '@/utils';

/**
 * Obtiene las páginas visibles del rol asignado al admin (si tiene área limitada).
 * Devuelve null si el admin tiene acceso total (sin custom_role o sin config).
 */
function getAllowedPages(user) {
  if (user?.role !== 'admin' || !user?.custom_role) return null;
  try {
    const cached = sessionStorage.getItem(`roleConfig:${user.custom_role}`);
    if (cached) {
      const cfg = JSON.parse(cached);
      if (Array.isArray(cfg?.visible_pages) && cfg.visible_pages.length > 0) {
        return cfg.visible_pages;
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Devuelve la URL a la que debe llevar una notificación al pulsarla.
 * Para admin se incluye un parámetro para abrir directamente el registro.
 * Si el admin tiene un área asignada y la página destino no está permitida,
 * devuelve null (no navega) para evitar redirecciones a paneles sin acceso.
 */
export function getNotificationUrl(notif, user) {
  const isAdmin = user?.role === 'admin';
  const ref = notif?.reference_id;
  const title = String(notif?.title || '');
  const isTicket = /ticket|respuesta/i.test(title);
  const allowedPages = getAllowedPages(user);

  // Construye la URL solo si la página está permitida para el rol del usuario
  const pageUrl = (pageName, query = '') => {
    if (allowedPages && !allowedPages.includes(pageName)) return null;
    return `${createPageUrl(pageName)}${query}`;
  };

  if (notif?.type === 'package' && ref) {
    return isAdmin
      ? pageUrl('AdminPackages', `?packageId=${ref}`)
      : pageUrl('MyPackages');
  }

  // Caso escalado al supervisor desde el Asistente ATC → abre el expediente en la pestaña Supervisor
  if (/caso escalado/i.test(title) && ref) {
    return pageUrl('AdminSupportAssistant', `?ticketId=${ref}`);
  }

  if (isTicket) {
    if (isAdmin) {
      return pageUrl('AdminSupportTickets', ref ? `?ticketId=${ref}` : '');
    }
    return pageUrl('Support');
  }

  if (notif?.type === 'consolidation') {
    return pageUrl(isAdmin ? 'ShipmentTracking' : 'MyConsolidations');
  }

  // Pago reportado por cliente → admin valida en AdminPayments
  if (notif?.type === 'payment_validation') {
    return pageUrl(isAdmin ? 'AdminPayments' : 'MyConsolidations');
  }

  // Solicitud de pago asistido → admin revisa en AdminAssistedPayments
  if (notif?.type === 'assisted_payment') {
    return pageUrl(isAdmin ? 'AdminAssistedPayments' : 'AssistedPayment');
  }

  if (notif?.type === 'payment') {
    return pageUrl(isAdmin ? 'AdminInvoices' : 'MyInvoices');
  }

  if (/usuario registrado|cliente/i.test(title) && isAdmin) {
    return pageUrl('AdminClients');
  }

  return null;
}