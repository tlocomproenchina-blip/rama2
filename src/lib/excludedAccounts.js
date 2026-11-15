// Cuentas internas que siguen siendo clientes (ven sus paquetes) pero no cuentan
// en ninguna estadística, reporte ni cobranza.
export const EXCLUDED_STATS_EMAILS = [
  'lunaalexandragonzalezdicapua@gmail.com',
  'lunaalexandragonzalezdicapua@gmmail.com',
];

export const isExcludedEmail = (email) =>
  EXCLUDED_STATS_EMAILS.includes(String(email || '').trim().toLowerCase());

export const withoutExcluded = (list, key = 'client_email') =>
  (list || []).filter((r) => !isExcludedEmail(r?.[key]));

// Condición para consultas count/aggregate.
export const EXCLUDED_QUERY = { client_email: { $nin: EXCLUDED_STATS_EMAILS } };