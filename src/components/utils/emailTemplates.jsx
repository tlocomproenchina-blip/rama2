import { base44 } from '@/api/base44Client';

const defaultTemplates = {
  package_received: {
    subject: '📦 Tu paquete ha sido recibido - TLEC Logistics',
    body: '¡Buenas noticias!\n\nTu paquete con tracking {{tracking_number}} ha sido recibido en nuestro almacén.\n\nPronto será procesado para consolidación.\n\nPuedes verificar el estado en tu panel de cliente.'
  },
  package_in_transit: {
    subject: '✈️ Tu paquete está en tránsito - TLEC Logistics',
    body: 'Tu paquete {{tracking_number}} está en camino.\n\nEstá siendo transportado y pronto llegará a destino.\n\nPuedes seguir el estado en tu panel de cliente.'
  },
  package_available: {
    subject: '📍 Tu paquete está disponible para retiro - TLEC Logistics',
    body: '¡Tu paquete {{tracking_number}} ya está disponible para retiro!\n\nPuedes coordinarlo contactándonos.\n\nRevisa los detalles en tu panel de cliente.'
  },
  package_delivered: {
    subject: '✅ Tu paquete ha sido entregado - TLEC Logistics',
    body: 'Tu paquete {{tracking_number}} ha sido entregado exitosamente.\n\n¡Gracias por confiar en TLEC Logistics!\n\nEsperamos verte pronto.'
  },
  consolidation_created: {
    subject: '📦 Tu carga ha sido consolidada - TLEC Logistics',
    body: '¡Tu carga ha sido consolidada!\n\nNúmero de Consolidación: {{consolidation_tracking}}\nPaquetes incluidos: {{tracking_numbers}}\nCantidad de paquetes: {{package_count}}\n\nDetalles del envío:\n- Tipo: {{shipping_type}}\n- Peso: {{weight}} kg\n- Costo de envío: ${{shipping_cost}}\n- Costo de seguro: ${{insurance_cost}}\n- Total a pagar: ${{total_cost}}\n\n{{#if estimated_delivery}}Fecha estimada de entrega: {{estimated_delivery}}\n\n{{/if}}Por favor ingresa al sistema para realizar el pago y continuar con el proceso de envío.'
  },
  consolidation_in_transit: {
    subject: '✈️ Tu consolidación está en tránsito - TLEC Logistics',
    body: 'Tu consolidación está en camino.\n\nNúmero de Consolidación: {{consolidation_tracking}}\n\nPuedes seguir el estado en tu panel de cliente.'
  },
  consolidation_available: {
    subject: '📍 Tu consolidación está disponible - TLEC Logistics',
    body: '¡Tu consolidación está lista para ser retirada!\n\nNúmero de Consolidación: {{consolidation_tracking}}\n\nContacta con nosotros para coordinar la entrega.'
  },
  consolidation_delivered: {
    subject: '✅ Tu consolidación ha sido entregada - TLEC Logistics',
    body: '¡Tu consolidación ha sido entregada exitosamente!\n\nNúmero de Consolidación: {{consolidation_tracking}}\n\n¡Gracias por confiar en TLEC Logistics! Esperamos verte pronto.'
  },
  payment_validated: {
    subject: '✅ Pago validado - Tu carga está en camino - TLEC Logistics',
    body: '¡Excelente! Tu pago ha sido validado exitosamente.\n\nNúmero de Consolidación: {{consolidation_tracking}}\nMonto pagado: ${{payment_amount}}\nTotal: ${{total_cost}}\n\nTu carga está ahora en tránsito y pronto llegará a destino.\n\nPuedes seguir el estado de tu envío en tu panel de cliente.'
  },
  payment_rejected: {
    subject: '❌ Pago rechazado - Acción requerida - TLEC Logistics',
    body: 'Tu pago no pudo ser validado.\n\nNúmero de Consolidación: {{consolidation_tracking}}\nMonto total: ${{total_cost}}\n\nMotivo del rechazo: {{rejection_reason}}\n\nPor favor verifica la información y vuelve a enviar el comprobante de pago correcto desde tu panel de cliente.'
  },
  admin_new_user: {
    subject: '👤 Nuevo usuario registrado - TLEC Logistics',
    body: 'Un nuevo usuario ha completado su registro:\n\nNombre: {{first_name}} {{last_name}}\nCiudad: {{city}}\nWhatsApp: {{whatsapp}}\nEmail: {{email}}\n\nPor favor asigna un Shipping Mark al usuario.'
  },
  admin_payment_reported: {
    subject: '💳 Nuevo pago reportado - TLEC Logistics',
    body: 'Un cliente ha reportado un pago para la consolidación {{consolidation_tracking}}.\n\nMonto: ${{amount}}\nMétodo: {{payment_method}}\n\nPor favor revisa y valida el pago.'
  },
  admin_insured_shipment: {
    subject: '🛡️ Nuevo envío asegurado - TLEC Logistics',
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