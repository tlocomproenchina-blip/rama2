// Cuentas internas que siguen siendo clientes (ven sus paquetes) pero no cuentan
// en ninguna estadística, reporte ni cobranza.
export const EXCLUDED_STATS_EMAILS = [
  'lunaalexandragonzalezdicapua@gmail.com',
  'lunaalexandragonzalezdicapua@gmmail.com',
];

export const isExcludedEmail = (email: unknown) =>
  EXCLUDED_STATS_EMAILS.includes(String(email || '').trim().toLowerCase());

export const withoutExcluded = <T>(list: T[] | null | undefined, key = 'client_email'): T[] =>
  (list || []).filter((r: any) => !isExcludedEmail(r?.[key]));

// Condición para consultas count/aggregate del servidor.
export const EXCLUDED_QUERY = { client_email: { $nin: EXCLUDED_STATS_EMAILS } };