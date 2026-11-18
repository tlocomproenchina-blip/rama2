import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export const DEFAULT_DOOR_RATE = 122.5;
const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;
let ratesPromise = null;

// Tarifas internas del proveedor (solo administración).
export function useProviderRates() {
  const [rates, setRates] = useState(null);
  useEffect(() => {
    ratesPromise ||= base44.entities.AppConfig.filter({ config_key: 'main' }).then((r) => ({
      door: Number(r?.[0]?.provider_door_to_door_cost) || DEFAULT_DOOR_RATE,
      sea: Number(r?.[0]?.provider_rate_sea_general) || 0,
    }));
    ratesPromise.then(setRates).catch(() => { ratesPromise = null; });
  }, []);
  return rates;
}

// Separa el costo proveedor puerta a puerta (CBM × tarifa) del costo marítimo.
export default function ProviderCostSplit({ invoice, maritimeCost }) {
  const rates = useProviderRates();
  const cbm = Number(invoice.total_cbm) || 0;
  if (!rates || !cbm) return null;
  const sea = maritimeCost ?? cbm * rates.sea;
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
      <span>Costo proveedor puerta a puerta: <b>{fmt(cbm * rates.door)}</b> <span className="text-muted-foreground">({cbm.toFixed(3)} CBM × {fmt(rates.door)})</span></span>
      <span>Costo envío marítimo: <b>{fmt(sea)}</b></span>
    </div>
  );
}