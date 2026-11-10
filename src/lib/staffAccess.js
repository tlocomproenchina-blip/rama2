// Personal de IMPORTADORA TLEC CARGO: administradores y empleados de cualquier área.
// Todos tienen acceso al panel (role 'admin'); el área va en custom_role.
// Los clientes (role 'user') no son personal.
export const isStaff = (user) => user?.role === 'admin';