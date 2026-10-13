import { adminGroups, adminMenuItems } from '@/components/sidebar/sidebarConfig';
import { ROLE_PRESETS } from '@/lib/rolePermissions';

// Un empleado es una cuenta con acceso al panel que tiene un área asignada.
// Los administradores (sin área, o con el rol 'administrador') conservan
// acceso a todos los módulos del sistema.
export function isAreaEmployee(user) {
  const area = user?.custom_role;
  if (user?.role !== 'admin' || !area) return false;
  return area !== 'administrador';
}

// Módulos del panel: estas páginas solo se abren si el área del empleado las
// tiene asignadas. Todo lo que no esté aquí (portal del cliente, páginas
// públicas, detalles internos) no se restringe.
const AREA_MANAGED_PAGES = new Set([
  ...adminMenuItems.map((item) => item.page),
  ...adminGroups.flatMap((group) => group.items),
  ...Object.values(ROLE_PRESETS).flatMap((preset) => preset.visible_pages || []),
]);

const RESTRICTED_PREFIXES = ['Admin', 'Warehouse'];
const EXTRA_RESTRICTED = ['BultoOrderScan'];

export function isRestrictedPage(page) {
  if (!page) return false;
  if (RESTRICTED_PREFIXES.some((prefix) => page.startsWith(prefix))) return true;
  return AREA_MANAGED_PAGES.has(page) || EXTRA_RESTRICTED.includes(page);
}

// Páginas permitidas para el usuario: null significa sin restricción.
// Se usa la configuración guardada del área y, si todavía no existe o quedó
// vacía, los módulos predeterminados del área.
export function allowedPagesFor(user, roleConfig) {
  if (!isAreaEmployee(user)) return null;
  if (roleConfig?.visible_pages?.length) return roleConfig.visible_pages;
  return ROLE_PRESETS[user.custom_role]?.visible_pages || [];
}

export function canAccessPage(user, roleConfig, page) {
  if (!isRestrictedPage(page)) return true;
  const allowed = allowedPagesFor(user, roleConfig);
  if (!allowed) return true;
  return allowed.includes(page);
}

const DASHBOARD_PAGES = [
  'AdminDashboard',
  'WarehouseDashboard',
  'AccountingDashboard',
  'AdminSeguimiento',
  'AdminOperaciones',
];

// Página de entrada del empleado: su tablero si lo tiene, si no el primer
// módulo de su área.
export function pickLandingPage(allowedPages) {
  if (!allowedPages?.length) return null;
  return DASHBOARD_PAGES.find((page) => allowedPages.includes(page)) || allowedPages[0];
}