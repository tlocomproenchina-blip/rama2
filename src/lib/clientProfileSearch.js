// Búsqueda de datos del perfil del cliente (sin IA).
// Detecta intenciones en el mensaje del cliente (shipping mark, dirección,
// paquetes, facturas, tarifas) y devuelve resultados formateados como
// "artículos" para que se rendericen en el mismo panel de sugerencias.

import { base44 } from '@/components/api/ApiQueueManager';
import { normalize } from '@/lib/kbSearch';

// Palabras clave por intención. Si el mensaje normalizado contiene alguna,
// se considera que el cliente pregunta por ese tipo de dato.
const INTENT_KEYWORDS = {
  shipping_mark: ['shipping mark', 'shippingmark', 'marca de envio', 'marca envio', 'mi marca', 'shiping mark', 'shipin mark', 'marc de envio'],
  address: ['direccion', 'dirreccion', 'direcion', 'mi direccion', 'direccion de envio', 'direccion de entrega', 'a donde envian', 'donde entregan', 'mi envio a'],
  packages: ['paquete', 'paquetes', 'mis paquetes', 'mi paquete', 'bulto', 'bultos', 'mis bultos', 'donde esta mi', 'estado de mi paquete', 'tracking', 'mi tracking', 'mis trackings', 'seguimiento'],
  invoices: ['factura', 'facturas', 'mi factura', 'mis facturas', 'abono', 'abonos', 'saldo', 'mi saldo', 'cuanto debo', 'deuda', 'pago', 'mi pago', 'pagos pendientes', 'factura pendiente'],
  rates: ['tarifa', 'tarifas', 'precio', 'precios', 'cuanto cuesta', 'costo', 'costo de envio', 'cuanto es el envio', 'rate', 'rates', 'cuanto cobran', 'precio por cbm', 'precio por kg']
};

const PROFILE_BADGE = 'Mi perfil';

/**
 * Detecta las intenciones presentes en el mensaje del cliente.
 * @param {string} query - mensaje del cliente
 * @returns {string[]} array de intenciones detectadas (ej: ['shipping_mark', 'packages'])
 */
export function detectProfileIntents(query) {
  const q = normalize(query || '');
  if (!q) return [];
  const intents = [];
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some((kw) => q.includes(normalize(kw)))) {
      intents.push(intent);
    }
  }
  return intents;
}

/**
 * Obtiene los datos del perfil del cliente relevantes a las intenciones detectadas.
 * Devuelve un array de "artículos" compatibles con el panel de sugerencias.
 * @param {object} user - usuario actual (de base44.auth.me())
 * @param {string[]} intents - intenciones detectadas
 * @returns {Promise<Array>} artículos de perfil
 */
export async function fetchProfileResults(user, intents) {
  if (!user?.email || !intents?.length) return [];

  const results = [];

  // Cargar datos en paralelo según las intenciones
  const tasks = [];
  const taskKeys = [];

  if (intents.includes('shipping_mark') || intents.includes('address')) {
    // El usuario ya lo tenemos, no hace falta fetch
  }

  if (intents.includes('packages')) {
    taskKeys.push('packages');
    tasks.push(
      base44.entities.Package
        .filter({ client_email: user.email }, '-created_date', 50)
        .catch(() => [])
    );
  }

  if (intents.includes('invoices')) {
    taskKeys.push('invoices');
    tasks.push(
      base44.entities.Invoice
        .filter({ client_email: user.email }, '-created_date', 50)
        .catch(() => [])
    );
  }

  if (intents.includes('rates')) {
    taskKeys.push('config');
    tasks.push(
      base44.entities.AppConfig
        .filter({ config_key: 'main' }, '-updated_date', 1)
        .catch(() => [])
    );
  }

  const responses = await Promise.all(tasks);
  const data = {};
  taskKeys.forEach((key, i) => { data[key] = responses[i]; });

  // --- Shipping Mark ---
  if (intents.includes('shipping_mark')) {
    const sm = user.shipping_mark || 'No asignado aún';
    results.push({
      id: `profile-sm-${Date.now()}`,
      title: 'Mi Shipping Mark',
      content: `Tu **Shipping Mark** es:\n\n\`${sm}\`\n\nEste código identifica tus paquetes en el almacén. Asegúrate de que tus proveedores lo incluyan en cada envío.`,
      category: 'envios',
      isProfileData: true,
      _badge: PROFILE_BADGE
    });
  }

  // --- Dirección de envío ---
  if (intents.includes('address')) {
    const parts = [
      user.address,
      user.city && `Ciudad: ${user.city}`,
      user.state && `Estado: ${user.state}`,
      user.whatsapp && `WhatsApp: ${user.whatsapp}`
    ].filter(Boolean);
    const addrText = parts.length > 0 ? parts.join('\n') : 'No tienes dirección registrada. Actualízala desde tu perfil.';
    results.push({
      id: `profile-addr-${Date.now()}`,
      title: 'Mi Dirección de Envío',
      content: addrText,
      category: 'envios',
      isProfileData: true,
      _badge: PROFILE_BADGE
    });
  }

  // --- Paquetes ---
  if (intents.includes('packages') && data.packages) {
    const pkgs = data.packages;
    if (pkgs.length === 0) {
      results.push({
        id: `profile-pkgs-empty-${Date.now()}`,
        title: 'Mis Paquetes',
        content: 'No tienes paquetes registrados todavía. Cuando hagas una pre-alerta, aparecerán aquí.',
        category: 'envios',
        isProfileData: true,
        _badge: PROFILE_BADGE
      });
    } else {
      const statusLabels = {
        pre_alerta: 'Pre-alerta', recibido: 'Recibido', rechazado: 'Rechazado',
        consolidado: 'Consolidado', en_transito: 'En tránsito',
        disponible: 'Disponible', despachado: 'Despachado', entregado: 'Entregado',
        sin_cliente: 'Sin cliente'
      };
      const lines = pkgs.slice(0, 10).map((p) =>
        `- \`${p.tracking_number}\` — **${statusLabels[p.status] || p.status}**${p.description ? ` — ${p.description.slice(0, 60)}` : ''}`
      );
      const more = pkgs.length > 10 ? `\n\n_Y ${pkgs.length - 10} paquete(s) más..._` : '';
      results.push({
        id: `profile-pkgs-${Date.now()}`,
        title: `Mis Paquetes (${pkgs.length})`,
        content: `Tienes **${pkgs.length}** paquete(s):\n\n${lines.join('\n')}${more}`,
        category: 'envios',
        isProfileData: true,
        _badge: PROFILE_BADGE
      });
    }
  }

  // --- Facturas ---
  if (intents.includes('invoices') && data.invoices) {
    const invs = data.invoices;
    if (invs.length === 0) {
      results.push({
        id: `profile-inv-empty-${Date.now()}`,
        title: 'Mis Facturas',
        content: 'No tienes facturas registradas todavía.',
        category: 'pagos',
        isProfileData: true,
        _badge: PROFILE_BADGE
      });
    } else {
      const statusLabels = {
        pendiente: 'Pendiente', revision: 'Revisión', pagada: 'Pagada',
        vencida: 'Vencida', cancelada: 'Cancelada'
      };
      const lines = invs.slice(0, 10).map((inv) => {
        const saldo = (inv.total || 0) - (inv.paid_amount || 0);
        const saldoStr = saldo > 0.01 ? ` — Saldo: **$${saldo.toFixed(2)}**` : ' — **Pagada**';
        return `- ${inv.invoice_number || 'S/N'} — ${statusLabels[inv.status] || inv.status} — Total: $${(inv.total || 0).toFixed(2)}${saldoStr}`;
      });
      const more = invs.length > 10 ? `\n\n_Y ${invs.length - 10} factura(s) más..._` : '';
      results.push({
        id: `profile-inv-${Date.now()}`,
        title: `Mis Facturas (${invs.length})`,
        content: `Tienes **${invs.length}** factura(s):\n\n${lines.join('\n')}${more}`,
        category: 'pagos',
        isProfileData: true,
        _badge: PROFILE_BADGE
      });
    }
  }

  // --- Tarifas ---
  if (intents.includes('rates') && data.config?.[0]) {
    const cfg = data.config[0];
    const lines = [];
    if (cfg.rate_air_general) lines.push(`- Aéreo general: **$${cfg.rate_air_general}/kg**`);
    if (cfg.rate_air_sensitive) lines.push(`- Aéreo sensible: **$${cfg.rate_air_sensitive}/kg**`);
    if (cfg.rate_sea_general) lines.push(`- Marítimo general: **$${cfg.rate_sea_general}/CBM**`);
    if (cfg.rate_sea_sensitive) lines.push(`- Marítimo sensible: **$${cfg.rate_sea_sensitive}/CBM**`);
    if (cfg.insurance_percentage) lines.push(`- Seguro: **${cfg.insurance_percentage}% del FOB**`);
    const content = lines.length > 0
      ? `Tarifas vigentes:\n\n${lines.join('\n')}`
      : 'No hay tarifas configuradas actualmente. Contacta al equipo de soporte para más información.';
    results.push({
      id: `profile-rates-${Date.now()}`,
      title: 'Tarifas de Envío',
      content,
      category: 'envios',
      isProfileData: true,
      _badge: PROFILE_BADGE
    });
  }

  return results;
}