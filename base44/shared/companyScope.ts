// Alcance por empresa (multi-empresa): TLEC CARGO es la base operativa y cada
// empresa socia tiene su código único. Este módulo resuelve a qué empresa
// pertenece un tracking, un cliente o una llave de servicio, y es la única
// fuente de verdad que usan la bodega China y la vía de servicio de las apps
// secundarias.
//
// company_code = 'tlec' (o vacío) → TLEC CARGO.

export const DEFAULT_COMPANY_CODE = 'tlec';
export const DEFAULT_COMPANY_NAME = 'TLEC CARGO';

export function normalizeCompanyCode(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function companyLabel(company: any): string {
  if (!company) return DEFAULT_COMPANY_NAME;
  return company.company_name || company.company_code || DEFAULT_COMPANY_NAME;
}

export async function listActiveCompanies(base44: any): Promise<any[]> {
  try {
    const rows = await base44.asServiceRole.entities.PartnerCompany.filter(
      { is_active: true },
      'company_name',
      500
    );
    return rows || [];
  } catch (_) {
    return [];
  }
}

// Devuelve { company_code, company_name, company } o null si el código no existe.
export async function resolveCompany(base44: any, code: unknown): Promise<any | null> {
  const normalized = normalizeCompanyCode(code);
  if (!normalized || normalized === DEFAULT_COMPANY_CODE) {
    return { company_code: DEFAULT_COMPANY_CODE, company_name: DEFAULT_COMPANY_NAME, company: null };
  }
  const rows = await base44.asServiceRole.entities.PartnerCompany.filter(
    { company_code: normalized },
    '-created_date',
    1
  );
  const company = rows?.[0] || null;
  if (!company) return null;
  return { company_code: normalizeCompanyCode(company.company_code), company_name: companyLabel(company), company };
}

// Valida la llave de servicio que envía una app secundaria.
export async function authenticatePartner(base44: any, key: string): Promise<any | null> {
  const clean = String(key || '').trim();
  if (!clean) return null;
  const rows = await base44.asServiceRole.entities.PartnerCompany.filter(
    { service_key: clean },
    '-created_date',
    1
  );
  const company = rows?.[0] || null;
  if (!company || company.is_active === false) return null;
  return company;
}

export function generateServiceKey(companyCode: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const random = Array.from({ length: 24 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  const prefix = normalizeCompanyCode(companyCode).slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'SOCIA';
  return `PSK-${prefix}-${random}`;
}

// Candidatos de tracking: el escáner suele leer el sub-tracking (master + sufijo
// de caja) así que se prueban recortes del final, igual que en la bodega.
export function trackingCandidates(tracking: string): string[] {
  const clean = String(tracking || '').trim();
  if (!clean) return [];
  const removalOrder = [0, 3, 2, 4, 1, 5, 6];
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const remove of removalOrder) {
    const candidate = remove === 0 ? clean : (clean.length - remove < 5 ? '' : clean.slice(0, clean.length - remove));
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    candidates.push(candidate);
  }
  return candidates;
}

// Busca un paquete por tracking (con variantes) y por código de etiqueta.
export async function findPackageByTracking(base44: any, tracking: string): Promise<any | null> {
  for (const candidate of trackingCandidates(tracking)) {
    const matches = await base44.asServiceRole.entities.Package.filter(
      { tracking_number: candidate },
      '-created_date',
      1
    );
    if (matches?.[0]) return matches[0];
  }
  const byLabel = await base44.asServiceRole.entities.Package.filter(
    { label_code: String(tracking || '').trim() },
    '-created_date',
    1
  );
  return byLabel?.[0] || null;
}

// Empresa de un cliente: primero el padrón de clientes de las empresas socias,
// después el código de empresa del usuario.
export async function resolveCompanyCodeForClient(base44: any, email: string): Promise<string> {
  const clean = String(email || '').trim();
  if (!clean) return '';
  try {
    const partners = await base44.asServiceRole.entities.PartnerClient.filter(
      { email: clean, is_active: true },
      '-created_date',
      1
    );
    const code = normalizeCompanyCode(partners?.[0]?.company_code);
    if (code) return code;
  } catch (_) {}
  try {
    const users = await base44.asServiceRole.entities.User.filter({ email: clean }, '-created_date', 1);
    return normalizeCompanyCode(users?.[0]?.company_code);
  } catch (_) {
    return '';
  }
}

// Empresa de un tracking: la del paquete pre-alertado; si el paquete no la
// tiene, se deduce del cliente dueño.
export async function resolveCompanyCodeForTracking(base44: any, tracking: string): Promise<string> {
  const pkg = await findPackageByTracking(base44, tracking);
  if (!pkg) return '';
  const fromPackage = normalizeCompanyCode(pkg.company_code);
  if (fromPackage) return fromPackage;
  return resolveCompanyCodeForClient(base44, pkg.client_email);
}

// Bulto que contiene un paquete dentro de una empresa (lista acotada por empresa).
export async function findBultoForPackage(base44: any, packageId: string, companyCode: string): Promise<any | null> {
  if (!packageId) return null;
  try {
    const bultos = await base44.asServiceRole.entities.Bulto.filter(
      { company_code: companyCode || DEFAULT_COMPANY_CODE },
      '-created_date',
      300
    );
    return (bultos || []).find((b) => Array.isArray(b?.package_ids) && b.package_ids.includes(packageId)) || null;
  } catch (_) {
    return null;
  }
}