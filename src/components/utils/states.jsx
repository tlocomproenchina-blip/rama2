// Canonical names for Venezuelan states keyed by state_code
export const CANONICAL_STATE_NAMES = {
  zulia: 'Zulia',
  tachira: 'Táchira',
  falcon: 'Falcón',
  lara: 'Lara',
  trujillo: 'Trujillo',
  merida: 'Mérida',
  barinas: 'Barinas',
  apure: 'Apure',
  guarico: 'Guárico',
  anzoategui: 'Anzoátegui',
  delta_amacuro: 'Delta Amacuro',
  amazonas: 'Amazonas',
  bolivar: 'Bolívar',
  miranda: 'Miranda',
  caracas: 'Distrito Capital (Caracas)',
  vargas: 'La Guaira (Vargas)',
  aragua: 'Aragua',
  carabobo: 'Carabobo',
  cojedes: 'Cojedes',
  yaracuy: 'Yaracuy',
  portuguesa: 'Portuguesa',
  monagas: 'Monagas',
  sucre: 'Sucre',
  nueva_esparta: 'Nueva Esparta'
};

export function normalizeStates(states) {
  if (!Array.isArray(states)) return [];
  const mapped = states.map((s) => ({
    ...s,
    state_name: CANONICAL_STATE_NAMES[s.state_code] || s.state_name || s.state_code,
  }));
  // sort by name
  return mapped.sort((a, b) => a.state_name.localeCompare(b.state_name, 'es', { sensitivity: 'base' }));
}

export function findStateByCodeOrName(states, value) {
  if (!value) return null;
  const v = String(value).toLowerCase();
  return (
    states.find((s) => String(s.state_code).toLowerCase() === v) ||
    states.find((s) => String(s.state_name).toLowerCase() === v)
  ) || null;
}