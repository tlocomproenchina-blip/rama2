import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    const event = payload?.event; // from entity automations
    const direct = payload && !event;

    const typeMap = {
      Package: 'package',
      Consolidation: 'consolidation',
      ConsolidationRequest: 'request',
      Invoice: 'invoice',
      SupportTicket: 'support',
      AccountsPayable: 'accounts_payable',
      System: 'system'
    };

    const readEntityData = async (entityName, id) => {
      if (!entityName || !id) return null;
      try {
        // Prefer generic get for reliability in functions
        const data = await base44.asServiceRole.entities.get(entityName, id);
        return data || null;
      } catch (_e) {
        return null;
      }
    };

    const buildFromEvent = async () => {
      const entityType = event?.entity_name;
      const entityId = event?.entity_id;
      const action = event?.type; // create | update | delete
      const data = payload?.data || (await readEntityData(entityType, entityId));

      const typeKey = typeMap[entityType] || 'system';

      // Determine affected email per entity kind
      let affectedEmail = null;
      if (data) {
        affectedEmail = data.client_email || data.user_email || data.owner_email || null;
      }

      // Titles/messages
      const actionText = action === 'create' ? 'creado' : action === 'update' ? 'actualizado' : action === 'delete' ? 'eliminado' : 'actualizado';

      const labelByEntity = {
        Package: 'Paquete',
        Consolidation: 'Consolidación',
        ConsolidationRequest: 'Solicitud de Consolidación',
        Invoice: 'Factura',
        SupportTicket: 'Ticket de Soporte',
        AccountsPayable: 'Cuenta por Pagar'
      };

      const label = labelByEntity[entityType] || entityType || 'Registro';

      const mainRef = (
        data?.tracking_number ||
        data?.consolidation_tracking ||
        data?.invoice_number ||
        data?.ticket_number ||
        data?.vendor_name ||
        entityId
      );

      const title = `${label} ${actionText}`;
      const message = mainRef ? `${label} ${actionText}: ${mainRef}` : `${label} ${actionText}`;

      return { entityType, entityId, type: typeKey, title, message, affectedEmail };
    };

    const buildFromDirect = () => {
      const {
        entityType,
        entityId,
        title,
        message,
        affectedEmail,
        notifyAdmins = true,
        priority = 'medium',
        icon = 'bell',
        type
      } = payload || {};
      if (!entityType || !title || !message) {
        return { error: 'Missing required fields' };
      }
      return { entityType, entityId, title, message, affectedEmail, notifyAdmins, priority, icon, type: type || typeMap[entityType] || 'system' };
    };

    const built = event ? await buildFromEvent() : buildFromDirect();
    if (built?.error) {
      return Response.json({ error: built.error }, { status: 400 });
    }

    const {
      entityType,
      entityId,
      title,
      message,
      affectedEmail,
      notifyAdmins = true,
      priority = 'medium',
      icon = 'bell',
      type
    } = built;

    const targets = new Set();
    if (affectedEmail) targets.add(affectedEmail);

    if (notifyAdmins) {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      admins.forEach(a => a?.email && targets.add(a.email));
    }

    if (targets.size === 0) {
      return Response.json({ created: 0, reason: 'no-targets' });
    }

    const records = Array.from(targets).map(email => ({
      user_email: email,
      title,
      message,
      type,
      priority,
      reference_id: entityId || null,
      entity_type: entityType,
      icon,
      read: false
    }));

    await base44.asServiceRole.entities.Notification.bulkCreate(records);

    return Response.json({ created: records.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});