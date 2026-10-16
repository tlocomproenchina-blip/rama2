import { base44 } from '@/components/api/ApiQueueManager';
import { replaceEmailVariables } from '@/components/EmailVariableReplacer';
import { PUBLIC_BASE_URL } from '@/lib/publicLinks';

const BASE_NOTIFICATION_TEMPLATES = [
  {
    name: 'Base - Nuevo Cliente',
    description: 'Bienvenida inicial para clientes nuevos',
    category: 'bienvenida',
    subject: '¡Bienvenido a {app_name}!',
    body: 'Hola {cliente_nombre},\n\nTu cuenta ya está activa en {app_name}. Muy pronto podrás gestionar tus envíos desde tu panel.',
    variables: ['cliente_nombre', 'app_name']
  },
  {
    name: 'Base - Shipping Mark Asignado',
    description: 'Notificación de shipping mark asignado',
    category: 'general',
    subject: 'Tu Shipping Mark ha sido asignado',
    body: 'Hola {cliente_nombre},\n\nTu Shipping Mark es: {shipping_mark}. Ya puedes usarlo en tus próximos envíos.',
    variables: ['cliente_nombre', 'shipping_mark']
  },
  {
    name: 'Base - Factura Generada',
    description: 'Notificación de nueva factura',
    category: 'pagos',
    subject: 'Nueva factura disponible: {invoice_number}',
    body: 'Hola {cliente_nombre},\n\nSe generó la factura {invoice_number} por un total de {total}.',
    variables: ['cliente_nombre', 'invoice_number', 'total']
  },
  {
    name: 'Base - Factura Pagada',
    description: 'Confirmación de factura pagada',
    category: 'pagos',
    subject: 'Pago confirmado para la factura {invoice_number}',
    body: 'Hola {cliente_nombre},\n\nConfirmamos el pago de la factura {invoice_number}. Gracias por tu pago.',
    variables: ['cliente_nombre', 'invoice_number']
  },
  {
    name: 'Base - Factura Vencida',
    description: 'Aviso de factura vencida',
    category: 'pagos',
    subject: 'Factura vencida: {invoice_number}',
    body: 'Hola {cliente_nombre},\n\nLa factura {invoice_number} se encuentra vencida. Por favor revisa tu panel para regularizarla.',
    variables: ['cliente_nombre', 'invoice_number']
  },
  {
    name: 'Base - Solicitud Pago Asistido',
    description: 'Confirmación o aviso sobre pago asistido',
    category: 'pagos',
    subject: 'Nueva solicitud de pago asistido',
    body: 'Se registró una nueva solicitud de pago asistido para {cliente_nombre}.',
    variables: ['cliente_nombre']
  },
  {
    name: 'Base - Ruta Asignada',
    description: 'Asignación de chofer o ruta',
    category: 'general',
    subject: 'Nueva asignación de ruta: {route_name}',
    body: 'Hola {chofer_nombre},\n\nHas sido asignado a la ruta {route_name}.',
    variables: ['chofer_nombre', 'route_name']
  },
  {
    name: 'Base - Estado Ruta Actualizado',
    description: 'Cambio de estado de una ruta',
    category: 'general',
    subject: 'Actualización de ruta: {route_name}',
    body: 'La ruta {route_name} cambió a estado {status}.',
    variables: ['route_name', 'status']
  },
  {
    name: 'Base - Alerta Administrativa',
    description: 'Plantilla genérica para alertas internas',
    category: 'general',
    subject: '{title}',
    body: '{message}',
    variables: ['title', 'message']
  }
];

let ensureTemplatesPromise = null;

function normalizeValue(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function toGenericVariables(source = {}) {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, normalizeValue(value)])
  );
}

export function buildNotificationTemplateVariables({ client = {}, user = {}, extraData = {} } = {}) {
  const person = client?.email ? client : user;
  const clientName = person?.first_name && person?.last_name
    ? `${person.first_name} ${person.last_name}`
    : person?.full_name || person?.email || '';

  return {
    app_name: 'TLEC CARGO',
    app_url: PUBLIC_BASE_URL,
    cliente_nombre: clientName,
    chofer_nombre: clientName,
    email: person?.email || '',
    whatsapp: person?.whatsapp || '',
    ciudad: person?.city || '',
    shipping_mark: person?.shipping_mark || '',
    tracking: extraData?.tracking || extraData?.tracking_number || '',
    tipo_envio: extraData?.tipo_envio || extraData?.shipping_type || '',
    descripcion: extraData?.descripcion || extraData?.description || '',
    consolidation_tracking: extraData?.consolidation_tracking || '',
    peso: extraData?.peso || extraData?.billable_weight || '',
    costo_envio: extraData?.costo_envio || extraData?.shipping_cost || '',
    seguro: extraData?.seguro || extraData?.insurance_cost || '',
    total: extraData?.total || extraData?.total_cost || extraData?.amount || '',
    fecha_estimada: extraData?.fecha_estimada || extraData?.estimated_delivery || '',
    invoice_number: extraData?.invoice_number || '',
    status: extraData?.status || '',
    route_name: extraData?.route_name || extraData?.route_code || extraData?.name || '',
    title: extraData?.title || '',
    message: extraData?.message || '',
    ...toGenericVariables(extraData),
  };
}

export function applyTemplateVariables(text, variables = {}, client = {}, extraData = {}) {
  let result = replaceEmailVariables(text || '', client || {}, extraData || {});

  Object.entries(variables).forEach(([key, value]) => {
    const normalizedValue = normalizeValue(value);
    result = result.split(`{${key}}`).join(normalizedValue);
    result = result.split(`{{${key}}}`).join(normalizedValue);
  });

  return result;
}

export async function getEmailTemplateByName(name) {
  const rows = await base44.entities.EmailTemplate.filter({ name }, '-updated_date', 1);
  return rows?.[0] || null;
}

export async function ensureBaseNotificationTemplates() {
  if (ensureTemplatesPromise) return ensureTemplatesPromise;

  ensureTemplatesPromise = (async () => {
    const existingTemplates = await base44.entities.EmailTemplate.list('-updated_date', 200);
    const existingNames = new Set((existingTemplates || []).map((template) => template.name));
    const missingTemplates = BASE_NOTIFICATION_TEMPLATES.filter((template) => !existingNames.has(template.name));

    if (missingTemplates.length > 0) {
      await Promise.all(
        missingTemplates.map((template) => base44.entities.EmailTemplate.create({
          ...template,
          attachments: [],
          is_default: false,
          usage_count: 0,
        }))
      );
    }

    return true;
  })();

  return ensureTemplatesPromise;
}

export async function renderEmailTemplate({
  templateName,
  variables = {},
  client = {},
  user = {},
  extraData = {},
  fallbackSubject = '',
  fallbackBody = '',
}) {
  const template = templateName ? await getEmailTemplateByName(templateName) : null;
  const mergedVariables = {
    ...buildNotificationTemplateVariables({ client, user, extraData }),
    ...toGenericVariables(variables),
  };

  return {
    template,
    subject: applyTemplateVariables(template?.subject || fallbackSubject, mergedVariables, client, extraData),
    body: applyTemplateVariables(template?.body || fallbackBody, mergedVariables, client, extraData),
  };
}

export async function markTemplateAsUsed(template) {
  if (!template?.id) return;

  await base44.entities.EmailTemplate.update(template.id, {
    usage_count: Number(template.usage_count || 0) + 1,
  });
}