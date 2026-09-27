// Alcance por empresa en el frontend: TLEC CARGO es la empresa base y cada
// empresa socia se identifica por su company_code. Los registros compartidos
// (paquetes, bultos, facturas, recibos) guardan company_code.

export const DEFAULT_COMPANY_CODE = 'tlec';
export const DEFAULT_COMPANY_NAME = 'TLEC CARGO';
export const ALL_COMPANIES = 'all';

export function normalizeCompanyCode(value) {
  return String(value ?? '').trim().toLowerCase();
}

// Código de empresa de un registro; vacío significa TLEC CARGO.
export function recordCompanyCode(record) {
  return normalizeCompanyCode(record?.company_code) || DEFAULT_COMPANY_CODE;
}

export function companyNameFor(companies, code) {
  const normalized = normalizeCompanyCode(code) || DEFAULT_COMPANY_CODE;
  if (normalized === DEFAULT_COMPANY_CODE) return DEFAULT_COMPANY_NAME;
  const found = (companies || []).find((c) => normalizeCompanyCode(c.company_code) === normalized);
  return found?.company_name || normalized.toUpperCase();
}

export function companyColorFor(companies, code) {
  const normalized = normalizeCompanyCode(code) || DEFAULT_COMPANY_CODE;
  if (normalized === DEFAULT_COMPANY_CODE) return null;
  const found = (companies || []).find((c) => normalizeCompanyCode(c.company_code) === normalized);
  return found?.brand_color || null;
}

export function isDefaultCompany(record) {
  return recordCompanyCode(record) === DEFAULT_COMPANY_CODE;
}

// Filtro de pantalla: 'all' = todas, 'tlec' = solo TLEC CARGO, otro = esa empresa.
export function matchesCompanyFilter(record, filterCode) {
  if (!filterCode || filterCode === ALL_COMPANIES) return true;
  const code = recordCompanyCode(record);
  if (filterCode === DEFAULT_COMPANY_CODE) return code === DEFAULT_COMPANY_CODE;
  return code === normalizeCompanyCode(filterCode);
}

export function buildCompanyOptions(companies) {
  return [
    { value: ALL_COMPANIES, label: 'Todas las empresas' },
    { value: DEFAULT_COMPANY_CODE, label: DEFAULT_COMPANY_NAME, color: null },
    ...(companies || []).map((c) => ({
      value: normalizeCompanyCode(c.company_code),
      label: c.company_name || c.company_code,
      color: c.brand_color || null,
    })),
  ];
}