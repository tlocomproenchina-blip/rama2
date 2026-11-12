import { ROLE_PRESETS, isAreaEmployee } from './roleAreas.ts';

export const FISCAL_ADMIN_PAGE = 'AdminFiscalInvoices';

// Administrador con permiso para el módulo: los administradores sin área tienen
// acceso completo; un empleado de área necesita el módulo asignado a su área.
export async function canManageFiscal(base44: any, user: any) {
  if (!user || user.role !== 'admin') return false;
  if (!isAreaEmployee(user)) return true;
  const code = String(user.custom_role || '').toLowerCase();
  const rows = await base44.asServiceRole.entities.RoleConfig.filter({ role_code: user.custom_role, is_active: true }, '-updated_date', 1).catch(() => []);
  const pages = rows?.[0]?.visible_pages ?? ROLE_PRESETS[code]?.visible_pages ?? [];
  return pages.includes(FISCAL_ADMIN_PAGE);
}