import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Mapeo página -> tipos de notificación relevantes (espejo de PAGE_NOTIFICATION_TYPES del frontend)
const PAGE_NOTIFICATION_TYPES = {
  AdminPayments: ['payment_validation', 'payment'],
  AdminAssistedPayments: ['assisted_payment'],
  AdminPackages: ['package'],
  AdminConsolidate: ['consolidation', 'request'],
  AdminSupportTickets: ['system'],
  MyPackages: ['package'],
  MyConsolidations: ['consolidation', 'payment_validation'],
  RequestConsolidation: ['request'],
  MyInvoices: ['payment'],
  AssistedPayment: ['assisted_payment'],
  Dashboard: ['system', 'general'],
};

function getRelevantTypes(visiblePages) {
  if (!visiblePages || visiblePages.length === 0) return null; // null = todo
  const types = new Set();
  for (const page of visiblePages) {
    const pageTypes = PAGE_NOTIFICATION_TYPES[page];
    if (pageTypes) pageTypes.forEach((t) => types.add(t));
  }
  // Si el rol no mapea a ningún tipo conocido, devolvemos null (todo) para no ocultar nada
  return types.size > 0 ? Array.from(types) : null;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Cargar notificaciones del usuario (service role para asegurar acceso)
    const notifs = await base44.asServiceRole.entities.Notification.filter(
      { user_email: user.email },
      '-created_date',
      50
    );

    // Si es admin con custom_role, filtrar por tipos relevantes a su área
    let allowedTypes = null;
    if (user.role === 'admin' && user.custom_role) {
      try {
        const roleRows = await base44.asServiceRole.entities.RoleConfig.filter(
          { role_code: user.custom_role, is_active: true },
          '-updated_date',
          1
        );
        const roleConfig = roleRows?.[0];
        if (roleConfig?.visible_pages?.length) {
          allowedTypes = getRelevantTypes(roleConfig.visible_pages);
        }
      } catch (_) {
        // Si no se puede cargar el rol, no filtrar
      }
    }

    let filtered = notifs || [];
    if (allowedTypes && allowedTypes.length > 0) {
      const typeSet = new Set(allowedTypes);
      filtered = filtered.filter((n) => {
        // Si la notificación tiene type y está en los permitidos, la muestra
        if (n.type && typeSet.has(n.type)) return true;
        // Si la notificación no tiene type (legacy/general), la muestra
        if (!n.type) return true;
        return false;
      });
    }

    return Response.json({ notifications: filtered });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}