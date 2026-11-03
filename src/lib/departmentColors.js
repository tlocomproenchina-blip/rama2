// Colores de los departamentos del CRM (clases literales para Tailwind).
export const DEPARTMENT_COLORS = {
  gray: { dot: 'bg-slate-400', label: 'Gris' },
  blue: { dot: 'bg-blue-500', label: 'Azul' },
  green: { dot: 'bg-emerald-500', label: 'Verde' },
  yellow: { dot: 'bg-amber-400', label: 'Amarillo' },
  red: { dot: 'bg-rose-500', label: 'Rojo' },
  purple: { dot: 'bg-violet-500', label: 'Morado' },
  pink: { dot: 'bg-pink-500', label: 'Rosa' },
};

export const departmentDot = (color) => (DEPARTMENT_COLORS[color] || DEPARTMENT_COLORS.blue).dot;