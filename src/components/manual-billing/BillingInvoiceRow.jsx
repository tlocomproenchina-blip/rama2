import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Package as PackageIcon, Boxes, Ship, CalendarClock, BadgeCheck, AlertTriangle } from 'lucide-react';
import CargoTypeSelector from '@/components/manual-billing/CargoTypeSelector';

const fmtDate = (d) => {
  if (!d) return null;
  const dt = new Date(String(d).includes('T') ? d : `${d}T12:00:00`);
  if (isNaN(dt)) return null;
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yy = String(dt.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
};

export default function BillingInvoiceRow({ row, onChange, cargoType = 'general' }) {
  const update = (patch) => onChange({ ...row, ...patch });
  // Tipo de carga del recibo: el elegido en su tarjeta o, si no se ha elegido, el de la factura
  const effectiveCargoType = row.cargo_type || cargoType;
  const isHighRisk = effectiveCargoType === 'alto_riesgo';

  return (
    <Card className={`border ${row.selected ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200'} transition-colors`}>
      <CardContent className="p-4 space-y-3 overflow-hidden">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={row.selected}
            onCheckedChange={(c) => update({ selected: !!c })}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-blue-700">{Number(row.cbm_original || row.cbm || 0)} CBM</span>
              {row.invoice_number && row.invoice_number !== '—' && (
                <span className="text-xs text-indigo-600 font-medium">📄 {row.invoice_number}</span>
              )}
              {row.disponible_entrega && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">✓ Disponible para entrega</span>
              )}
              {row.rate_label === 'anterior' && (
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Tarifa anterior</span>
              )}
              {row.rate_label === 'actual' && row.fecha && (
                <span className="text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">Tarifa actual</span>
              )}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${isHighRisk ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-600 bg-slate-50 border-slate-200'}`}>
                {isHighRisk && <AlertTriangle className="h-3 w-3" />}
                {isHighRisk ? 'Carga alto riesgo' : 'Carga común'}
              </span>
            </div>
            <p className="text-xs text-slate-500 break-all line-clamp-2">
              {row.consolidation_tracking || 'Sin tracking'}
            </p>
            <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1"><PackageIcon className="h-3 w-3" /> {row.package_count} paquete(s)</span>
              {row.total_fob > 0 && (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <ShieldCheck className="h-3 w-3" /> FOB ${Number(row.total_fob || 0).toFixed(2)}
                </span>
              )}
              {Number(row.paid_insurance_amount || 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <BadgeCheck className="h-3 w-3" /> Seguro pagado ${Number(row.paid_insurance_amount).toFixed(2)}
                </span>
              )}
              {fmtDate(row.fecha_salida) && (
                <span className="inline-flex items-center gap-1 text-sky-700">
                  <Ship className="h-3 w-3" /> Salió: {fmtDate(row.fecha_salida)}
                </span>
              )}
              {fmtDate(row.fecha_estimada_llegada) && (
                <span className="inline-flex items-center gap-1 text-indigo-700">
                  <CalendarClock className="h-3 w-3" /> Llegada est.: {fmtDate(row.fecha_estimada_llegada)}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tipo de carga de este recibo</span>
              <CargoTypeSelector
                compact
                value={effectiveCargoType}
                onChange={(type) => update({ cargo_type: type })}
              />
            </div>
          </div>
        </div>

        {row.selected && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-7">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Boxes className="h-3 w-3" /> CBM</Label>
              <Input
                type="number" step="0.0001" min="0"
                value={row.cbm}
                onChange={(e) => update({ cbm: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Envío (recalc.)</Label>
              <Input
                type="number" step="0.01" min="0"
                value={row.shipping_amount}
                onChange={(e) => update({ shipping_amount: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Seguro (5% FOB)</Label>
              <Input
                type="number" step="0.01" min="0"
                value={row.insurance_amount}
                onChange={(e) => update({ insurance_amount: e.target.value })}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}