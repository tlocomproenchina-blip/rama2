import { base44 } from '@/api/base44Client';

export const DEFAULT_DOOR_RATE_PER_CBM = 150;

// Tarifa puerta a puerta por CBM compartida por todas las calculadoras.
export async function loadDoorToDoorConfig() {
  const rows = await base44.entities.DoorToDoorConfig.filter({ config_key: 'main' }, '-updated_date', 1);
  return rows[0] || null;
}

export async function loadDoorToDoorRate() {
  const cfg = await loadDoorToDoorConfig();
  const rate = Number(cfg?.rate_per_cbm);
  return Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_DOOR_RATE_PER_CBM;
}