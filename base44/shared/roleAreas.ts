// Áreas operativas que se asignan a los empleados (rol por área).
// Debe coincidir con ROLE_PRESETS de src/lib/rolePermissions.js.
// El código 'administrador' NO es un área de empleado: representa acceso
// completo de administrador, por eso queda fuera de esta lista.
export const AREA_ROLE_CODES = [
  'operaciones',
  'almacen',
  'contabilidad',
  'soporte',
  'marketing',
  'logistica',
  'comunicaciones',
  'seguimiento',
  'equipo_y_acceso',
];

// Un empleado es una cuenta con un área operativa asignada. Las demás cuentas
// con role 'admin' (sin área o con el rol 'administrador') son administradores.
export function isAreaEmployee(user: any) {
  return AREA_ROLE_CODES.includes(String(user?.custom_role || '').toLowerCase());
}