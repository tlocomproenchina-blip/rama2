import { DEFAULT_CONNECTION_KEY } from './wholesalerCore.ts';

// Filtro que limita una consulta a los registros de un solo mayorista. Los
// registros sin marca son de antes de admitir varios mayoristas y pertenecen a
// la conexión principal.
export function scopeFilter(key: string) {
  const clean = String(key || '').trim() || DEFAULT_CONNECTION_KEY;
  if (clean !== DEFAULT_CONNECTION_KEY) return { wholesaler_key: clean };
  return {
    $or: [
      { wholesaler_key: DEFAULT_CONNECTION_KEY },
      { wholesaler_key: '' },
      { wholesaler_key: null },
      { wholesaler_key: { $exists: false } },
    ],
  };
}