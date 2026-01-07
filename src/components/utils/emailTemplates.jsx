import { base44 } from '@/api/base44Client';

const defaultTemplates = {
  // Cliente - Pre-alerta creada
  prealert_created: {
    subject: 'Confirmación de Pre-Alerta de Paquete #{{tracking_number}} - TLEC Logistics',
    body: 'Hola {{client_name}},\n\nTu pre-alerta para el tracking {{tracking_number}} ha sido recibida exitosamente.\n\nDetalles:\n- Tipo de envío: {{shipping_type}}\n{{#if description}}- Descripción: {{description}}\n{{/if}}{{#if has_insurance}}- Envío asegurado: Sí (Valor FOB: ${{fob_value}})\n{{/if}}\nPuedes seguir su estado en tu dashboard.'
  },
  
  // Cliente - Paquete recibido
  package_received: {
    subject: 'Tu Paquete {{tracking_number}} ha sido Recibido - TLEC Logistics',
    body: 'Hola {{client_name}},\n\nTu paquete con tracking {{tracking_number}} ha sido recibido en nuestro warehouse el {{received_date}}.\n\nAhora está listo para ser consolidado.\n\nPuedes verificar el estado en tu panel de cliente.'
  },
  
  // Cliente - Consolidación lista
  consolidation_created: {
    subject: 'Tu Consolidación #{{consolidation_tracking}} está Lista para Pago - TLEC Logistics',
    body: 'Hola {{client_name}},\n\nTu consolidación #{{consolidation_tracking}} con {{package_count}} paquete(s) está lista.\n\nPaquetes incluidos: {{tracking_numbers}}\n\nDetalles del envío:\n- Tipo: {{shipping_type}}\n- Peso: {{weight}} kg\n- Costo de envío: ${{shipping_cost}}\n- Costo de seguro: ${{insurance_cost}}\n- Total a pagar: ${{total_cost}}\n{{#if estimated_delivery}}\nFecha estimada de entrega: {{estimated_delivery}}\n{{/if}}\nPuedes ver más detalles y realizar el pago en tu dashboard.'
  },
  
  // Cliente - Pago validado
  payment_validated: {
    subject: 'Tu Pago para Consolidación #{{consolidation_tracking}} ha sido Validado - TLEC Logistics',
    body: 'Hola {{client_name}},\n\nTu pago de ${{total_cost}} para la consolidación #{{consolidation_tracking}} ha sido validado.\n\nTu envío ahora está en proceso y pronto estará en camino.\n\nPuedes seguir el estado de tu envío en tu panel de cliente.'
  },
  
  // Cliente - Pago rechazado
  payment_rejected: {
    subject: 'Tu Pago para Consolidación #{{consolidation_tracking}} ha sido Rechazado - TLEC Logistics',
    body: 'Hola {{client_name}},\n\nTu pago para la consolidación #{{consolidation_tracking}} ha sido rechazado.\n\nMotivo: {{rejection_reason}}\n\nPor favor, revisa los detalles en tu dashboard y realiza un nuevo pago si es necesario.'
  },
  
  // Cliente - En tránsito
  consolidation_in_transit: {
    subject: 'Tu Consolidación #{{consolidation_tracking}} está En Tránsito - TLEC Logistics',
    body: 'Hola {{client_name}},\n\nTu consolidación #{{consolidation_tracking}} ha salido de nuestro warehouse y está en camino.\n{{#if estimated_delivery}}\nFecha estimada de entrega: {{estimated_delivery}}\n{{/if}}\nPuedes seguir el estado en tu panel de cliente.'
  },
  
  // Cliente - Disponible
  consolidation_available: {
    subject: 'Tu Consolidación #{{consolidation_tracking}} está Disponible - TLEC Logistics',
    body: 'Hola {{client_name}},\n\nTu consolidación #{{consolidation_tracking}} ya está disponible para retiro/entrega.\n\nContacta con nosotros para coordinar la entrega.'
  },
  
  // Cliente - Entregada
  consolidation_delivered: {
    subject: 'Confirmación de Entrega - Consolidación #{{consolidation_tracking}} - TLEC Logistics',
    body: 'Hola {{client_name}},\n\nTu consolidación #{{consolidation_tracking}} ha sido entregada exitosamente.\n\n¡Gracias por confiar en TLEC Logistics! Esperamos verte pronto.'
  },
  
  // Admin - Nuevo cliente
  admin_new_user: {
    subject: 'Nuevo Cliente Registrado: {{first_name}} {{last_name}} - TLEC Logistics',
    body: 'Se ha registrado un nuevo cliente:\n\nNombre: {{first_name}} {{last_name}}\nEmail: {{email}}\nCiudad: {{city}}\nWhatsApp: {{whatsapp}}\n\nPor favor, asigna un Shipping Mark al usuario en el Panel de Administración.'
  },
  
  // Admin - Nueva pre-alerta
  admin_prealert_created: {
    subject: 'Nueva Pre-Alerta de Paquete de {{client_name}} ({{tracking_number}}) - TLEC Logistics',
    body: 'El cliente {{client_name}} ({{client_email}}) ha creado una nueva pre-alerta:\n\nTracking: {{tracking_number}}\nTipo de envío: {{shipping_type}}\n{{#if description}}Descripción: {{description}}\n{{/if}}{{#if has_insurance}}Envío asegurado: Sí (Valor FOB: ${{fob_value}})\n{{/if}}\nRevisa los detalles en el Panel de Administración.'
  },
  
  // Admin - Paquete recibido
  admin_package_received: {
    subject: 'Paquete Recibido en Warehouse: {{tracking_number}} - TLEC Logistics',
    body: 'El paquete {{tracking_number}} del cliente {{client_name}} ({{client_email}}) ha sido recibido en el warehouse.\n\nRecibido por: {{received_by}}\nFecha: {{received_date}}\n\nRevisa los detalles en el Panel de Administración.'
  },
  
  // Admin - Consolidación creada
  admin_consolidation_created: {
    subject: 'Nueva Consolidación Creada: #{{consolidation_tracking}} - TLEC Logistics',
    body: 'Se ha creado una nueva consolidación #{{consolidation_tracking}} para el cliente {{client_name}} ({{client_email}}).\n\nDetalles:\n- Paquetes: {{package_count}}\n- Tipo de envío: {{shipping_type}}\n- Peso: {{weight}} kg\n- Total: ${{total_cost}}\n\nRevisa los detalles en el Panel de Administración.'
  },
  
  // Admin - Pago reportado
  admin_payment_reported: {
    subject: 'Nuevo Pago Pendiente de Validación para Consolidación #{{consolidation_tracking}} - TLEC Logistics',
    body: 'El cliente {{client_name}} ({{client_email}}) ha reportado un pago:\n\nConsolidación: #{{consolidation_tracking}}\nMonto reportado: ${{amount}}\nMétodo de pago: {{payment_method}}\n\nPor favor, valida el pago en el Panel de Administración.'
  },
  
  // Admin - Envío asegurado (ya existente, lo mantengo)
  admin_insured_shipment: {
    subject: '🛡️ Nuevo Envío Asegurado - TLEC Logistics',
    body: 'Un cliente ha registrado un envío asegurado:\n\nTracking: {{tracking_number}}\nCliente: {{client_name}}\nEmail: {{client_email}}\nValor FOB: ${{fob_value}}\n\nPor favor revisa la factura adjunta.'
  }
};

// Template replacement with conditional support
function replaceVariables(template, variables) {
  let result = template;
  
  // Handle conditional blocks {{#if variable}}content{{/if}}
  result = result.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, varName, content) => {
    return variables[varName] && variables[varName] !== '' ? content : '';
  });
  
  // Replace all variables
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, variables[key] ?? '');
  });
  
  return result;
}

export async function sendTemplateEmail(templateKey, recipientEmail, variables = {}) {
  try {
    const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
    const customTemplates = configs[0]?.email_templates || {};
    
    const template = customTemplates[templateKey] || defaultTemplates[templateKey];
    
    if (!template) {
      console.error(`Template ${templateKey} not found`);
      return false;
    }
    
    // Check if user has notifications enabled (for client emails)
    if (!templateKey.startsWith('admin_')) {
      const users = await base44.entities.User.filter({ email: recipientEmail });
      if (users[0]?.email_notifications_enabled === false) {
        console.log(`Notifications disabled for ${recipientEmail}`);
        return false;
      }
    }
    
    const subject = replaceVariables(template.subject, variables);
    const body = replaceVariables(template.body, variables);
    
    await base44.integrations.Core.SendEmail({
      to: recipientEmail,
      subject,
      body
    });
    
    return true;
  } catch (error) {
    console.error('Error sending template email:', error);
    return false;
  }
}

export async function sendTemplateEmailToAdmins(templateKey, variables = {}) {
  try {
    const admins = await base44.entities.User.filter({ role: 'admin' });
    const promises = admins.map(admin => 
      sendTemplateEmail(templateKey, admin.email, variables)
    );
    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Error sending to admins:', error);
    return false;
  }
}