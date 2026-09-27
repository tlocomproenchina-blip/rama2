// Helpers de lectura paginada compartidos por las funciones de reportes/facturación.
// Módulo plano: solo exporta utilidades (sin Deno.serve).

export const PAGE = 200;
export const MAX_PAGES = 50;
export const BATCH = 50;

export const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const normTracking = (raw: any) => String(raw || '').split(/[:：]/).pop().trim().toUpperCase();

export function errorMessage(error: any) {
  return (error && typeof error === 'object' && 'message' in error) ? String((error as any).message) : 'Internal Server Error';
}

export async function fetchAllFilter(entity: any, query: any, sort: any) {
  const all: any[] = [];
  let skip = 0;
  for (let i = 0; i < MAX_PAGES; i++) {
    const batch = await entity.filter(query, sort, PAGE, skip);
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < PAGE) break;
    skip += PAGE;
  }
  return all;
}

export async function fetchByClientEmails(entity: any, clientEmails: string[], sort: any = '-created_date', extraQuery: any = {}) {
  const out: any[] = [];
  for (let i = 0; i < clientEmails.length; i += BATCH) {
    const chunk = clientEmails.slice(i, i + BATCH);
    const items = await fetchAllFilter(entity, { ...extraQuery, client_email: { $in: chunk } }, sort);
    out.push(...items);
  }
  return out;
}