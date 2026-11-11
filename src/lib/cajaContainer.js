// Una caja consolidada siempre es de un solo contenedor y un solo cliente: el N° de
// contenedor se escribe una vez en la primera revisión y se reutiliza en las demás.
const key = (label) => `tlec-caja-container:${String(label || '').toUpperCase()}`;

export const getCajaContainer = (caja) => {
  if (!caja?.is_caja) return '';
  const fromUnit = Array.isArray(caja.cbm_order_numbers) ? caja.cbm_order_numbers.find(Boolean) : '';
  if (fromUnit) return String(fromUnit).toUpperCase();
  try { return localStorage.getItem(key(caja.label_code)) || ''; } catch (_) { return ''; }
};

export const setCajaContainer = (caja, container) => {
  const value = String(container || '').trim().toUpperCase();
  if (!caja?.is_caja || !value) return;
  try { localStorage.setItem(key(caja.label_code), value); } catch (_) {}
};