/**
 * Reemplaza variables en el texto del email con valores reales del cliente
 */
export function replaceEmailVariables(text, client, extraData = {}) {
  if (!text) return text;
  
  let result = text;
  
  // Variables del cliente
  const clientName = client.first_name && client.last_name 
    ? `${client.first_name} ${client.last_name}` 
    : client.full_name || client.email;
  
  const replacements = {
    // Cliente
    '{cliente_nombre}': clientName,
    '{email}': client.email || '',
    '{whatsapp}': client.whatsapp || '',
    '{ciudad}': client.city || '',
    '{shipping_mark}': client.shipping_mark || 'Pendiente asignacion',
    '{shipping_mark_anterior}': extraData.shipping_mark_anterior || '',
    
    // Paquetes
    '{tracking}': extraData.tracking || '',
    '{tipo_envio}': extraData.tipo_envio || extraData.shipping_type || '',
    '{descripcion}': extraData.descripcion || extraData.description || '',
    
    // Consolidación
    '{consolidation_tracking}': extraData.consolidation_tracking || '',
    '{peso}': extraData.peso || extraData.billable_weight || '',
    '{costo_envio}': extraData.costo_envio || extraData.shipping_cost || '',
    '{seguro}': extraData.seguro || extraData.insurance_cost || '',
    '{total}': extraData.total || extraData.total_cost || '',
    '{fecha_estimada}': extraData.fecha_estimada || extraData.estimated_delivery || '',
    
    // Marketing
    '{detalles_promocion}': extraData.detalles_promocion || '',
    '{fecha_vencimiento}': extraData.fecha_vencimiento || '',
    '{descuento}': extraData.descuento || ''
  };
  
  // Reemplazar todas las variables
  Object.keys(replacements).forEach(variable => {
    const value = replacements[variable];
    result = result.split(variable).join(value);
  });
  
  return result;
}