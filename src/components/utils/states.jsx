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
    // Ensure both code and name are present to avoid runtime crashes
    state_code: s.state_code || (s.state_name ? String(s.state_name).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : ''),
    state_name: CANONICAL_STATE_NAMES[s.state_code] || s.state_name || s.state_code || '',
  }));
  // sort by name (robust if name missing)
  return mapped.sort((a, b) => {
    const nameA = String(a.state_name || a.state_code || '').toLowerCase();
    const nameB = String(b.state_name || b.state_code || '').toLowerCase();
    return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
  });
}

export function findStateByCodeOrName(states, value) {
  if (!value) return null;
  const v = String(value).toLowerCase();
  return (
    states.find((s) => String(s.state_code).toLowerCase() === v) ||
    states.find((s) => String(s.state_name).toLowerCase() === v)
  ) || null;
}