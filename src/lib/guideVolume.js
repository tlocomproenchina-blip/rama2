// Volumen de la guía de despacho: CBM y su conversión a pies cúbicos.
// Conversión usada por la empresa: 1 CBM = 35 pies cúbicos.
import { palletClientKey } from './guidePallets';

export const CUBIC_FEET_PER_CBM = 35;

export const sumCbm = (lines = []) =>
  (Array.isArray(lines) ? lines : []).reduce((sum, line) => sum + (Number(line?.cbm) || 0), 0);

const isNum = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

// CBM de un cliente de la guía: el editado a mano (cbm_override), el de sus bultos
// o, si no tienen, el facturado guardado en los totales del cliente.
export const clientCbm = (client) =>
  isNum(client?.cbm_override)
    ? Number(client.cbm_override)
    : sumCbm(client?.bultos) || Number(client?.totals?.cbm) || 0;

// Aplica a los clientes de una guía los volúmenes editados a mano (guide.volume_override).
export const withVolumeOverrides = (guide) => {
  const override = guide?.volume_override || {};
  const byClient = new Map((override.clients || []).map((entry) => [entry.client_key, entry.cbm]));
  const clients = (Array.isArray(guide?.clients) ? guide.clients : []).map((client) => {
    const edited = byClient.get(palletClientKey(client));
    return isNum(edited) ? { ...client, cbm_override: Number(edited) } : client;
  });
  return { clients, totalOverride: isNum(override.total) ? Number(override.total) : null };
};

// CBM total de la guía: el editado a mano o la suma de sus clientes.
export const guideTotalCbm = (clients, totalOverride = null) =>
  isNum(totalOverride) ? Number(totalOverride) : (clients || []).reduce((sum, c) => sum + clientCbm(c), 0);

export const volumeLabel = (cbm) => {
  const value = Number(cbm) || 0;
  return `${value.toFixed(3)} CBM = ${(value * CUBIC_FEET_PER_CBM).toFixed(2)} pies cúbicos`;
};