import { adminGroups, adminMenuItems } from '@/components/sidebar/sidebarConfig';
import { AREA_ROLE_OPTIONS, ROLE_PRESETS } from '@/lib/rolePermissions';

// Áreas operativas que se asignan a los empleados: la misma lista que usa el
// backend (base44/shared/roleAreas.ts). Cualquier otro valor (administrador, el
// administrador oculto, roles antiguos o vacío) tiene acceso completo al panel.
const AREA_CODES = new Set(AREA_ROLE_OPTIONS.map((code) => String(code).toLowerCase()));

export function areaCodeOf(user) {
  if (user?.role !== 'admin') return null;
  const code = String(user?.custom_role || '').trim().toLowerCase();
  return AREA_CODES.has(code) ? code : null;
}

// Un empleado es una cuenta con acceso al panel y un área operativa asignada.
// Los administradores (sin área, con 'administrador' o cualquier otro valor)
// conservan acceso a todos los módulos del sistema.
export function isAreaEmployee(user) {
  return !!areaCodeOf(user);
}

// Permisos predeterminados del área, sin importar mayúsculas.
export function getAreaPreset(roleCode) {
  return ROLE_PRESETS[String(roleCode || '').trim().toLowerCase()] || null;
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
// Manda la configuración guardada del área tal como está (una selección vacía es
// intencional); los módulos predeterminados solo entran cuando el área todavía no
// tiene configuración guardada.
export function allowedPagesFor(user, roleConfig) {
  const area = areaCodeOf(user);
  if (!area) return null;
  if (roleConfig) return roleConfig.visible_pages || [];
  return getAreaPreset(area)?.visible_pages || [];
}

// Módulos que el menú del panel muestra a este usuario. En un empleado de área
// manda su configuración de área: sus módulos asignados se ven aunque la lista
// general del panel los tenga ocultos, porque esa lista recorta el panel completo
// y no puede dejar sin menú a un área. Para el resto, manda la lista general.
export function menuPagesFor(user, config, roleConfig) {
  const allPages = adminMenuItems.map((item) => item.page);
  if (!isAreaEmployee(user)) {
    const hidden = new Set(config?.sidebar_hidden_pages || []);
    return allPages.filter((page) => !hidden.has(page));
  }
  const allowed = new Set(allowedPagesFor(user, roleConfig) || []);
  return allPages.filter((page) => allowed.has(page));
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