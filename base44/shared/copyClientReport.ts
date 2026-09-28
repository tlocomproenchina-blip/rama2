// Reporte TXT de los clientes de cada app integrada (copia).
// Cada copia guarda su propio punto de inicio en ClientReportCursor con la clave
// app:<slug>, así sus clientes se reportan por separado del reporte global de
// TLEC CARGO. No duplicar esta lógica en las funciones que la usan.

import { isTestEmail } from './integratedApps.ts';

const PAGE = 500;
const MAX_PAGES = 20; // salvaguarda: 10.000 registros por entidad

export function copyCursorKey(slug) {
  const clean = String(slug || '').trim().toLowerCase() || 'app';
  return `app:${clean}`;
}

// Las copias usan su propio prefijo de shipping mark, así que tomamos el número
// final del mark venga como venga el prefijo. Sin número reconocible no entra al
// reporte (no se puede ordenar ni comparar contra el punto de inicio).
export function parseCopyMarkNumber(mark) {
  const match = String(mark || '').trim().match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : null;
}

async function fetchOwned(base44, entity, appId) {
  const rows = [];
  let skip = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const batch = await base44.asServiceRole.entities[entity].filter(
      { origin_app_id: appId },
      '-created_date',
      PAGE,
      skip
    );
    const list = Array.isArray(batch) ? batch : [];
    rows.push(...list);
    if (list.length < PAGE) break;
    skip += PAGE;
  }
  return rows;
}

function shape(record, account) {
  return {
    account,
    email: String(record.email || record.client_email || '').trim(),
    shipping_mark: String(record.shipping_mark || '').trim(),
    first_name: record.first_name || '',
    last_name: record.last_name || '',
    cedula: record.cedula || '',
    state: record.state || '',
    city: record.city || '',
    address: record.address || '',
    whatsapp: record.whatsapp || ''
  };
}

// Clientes de la copia con número de mark reconocible, ordenados de menor a mayor.
// Si un mismo correo existe como registro sin cuenta y como cliente con cuenta,
// manda el cliente con cuenta (un solo bloque por cliente en el TXT).
export async function loadCopyClients(base44, app) {
  const [users, profiles] = await Promise.all([
    fetchOwned(base44, 'User', app.id),
    fetchOwned(base44, 'IntegratedClient', app.id)
  ]);

  const byEmail = new Map();
  for (const row of profiles) {
    const client = shape(row, false);
    if (!client.email || isTestEmail(client.email)) continue;
    const num = parseCopyMarkNumber(client.shipping_mark);
    if (num == null) continue;
    byEmail.set(client.email.toLowerCase(), { client, num });
  }
  for (const row of users) {
    const client = shape(row, true);
    if (!client.email || isTestEmail(client.email)) continue;
    const num = parseCopyMarkNumber(client.shipping_mark);
    if (num == null) continue;
    byEmail.set(client.email.toLowerCase(), { client, num });
  }

  return Array.from(byEmail.values()).sort((a, b) => a.num - b.num);
}

export async function loadCopyCursor(base44, app) {
  const rows = await base44.asServiceRole.entities.ClientReportCursor.filter(
    { config_key: copyCursorKey(app.slug) },
    '-updated_date',
    1
  );
  return rows?.[0] || null;
}

export function cursorSummary(cursor) {
  if (!cursor) return null;
  return {
    cursor_number: Number(cursor.last_shipping_mark_number) || 0,
    last_mark: cursor.last_shipping_mark_string || '',
    last_report_date: cursor.last_report_date || null,
    last_report_count: Number(cursor.last_report_count) || 0
  };
}

export async function saveCopyCursor(base44, app, next) {
  const key = copyCursorKey(app.slug);
  const existing = await loadCopyCursor(base44, app);
  const data = {
    last_shipping_mark_number: Number(next?.cursor_number) || 0,
    last_shipping_mark_string: String(next?.last_mark || ''),
    last_report_date: next?.last_report_date || null,
    last_report_count: Number(next?.last_report_count) || 0
  };
  if (existing) {
    await base44.asServiceRole.entities.ClientReportCursor.update(existing.id, data);
    return { ...existing, ...data };
  }
  return await base44.asServiceRole.entities.ClientReportCursor.create({ config_key: key, ...data });
}

// Pendientes de reportar: clientes de la copia por encima de su punto de inicio.
export async function copyPending(base44, app) {
  const [clients, cursor] = await Promise.all([
    loadCopyClients(base44, app),
    loadCopyCursor(base44, app)
  ]);
  const cursorNumber = Number(cursor?.last_shipping_mark_number) || 0;
  const pending = clients.filter((row) => row.num > cursorNumber);
  return { pending, total: clients.length, cursorNumber, exceeded: pending.length > 200 };
}

// Mismo formato de bloque que el reporte global de Gestión de Clientes.
export function buildCopyTxtBlock(client) {
  const fullName = `${client.first_name || ''} ${client.last_name || ''}`.trim();
  return [
    `Shipping Mark: ${client.shipping_mark || ''}`,
    `Nombre: ${fullName}`,
    `Cedula: ${client.cedula || ''}`,
    `Estado: ${client.state || ''}`,
    `Ciudad: ${client.city || ''}`,
    `Direccion: ${client.address || ''}`,
    `WhatsApp: ${client.whatsapp || ''}`,
    `Email: ${client.email || ''}`
  ].join('\n');
}