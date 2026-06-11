import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Package as PackageIcon, Boxes } from 'lucide-react';

export default function BillingInvoiceRow({ row, onChange }) {
  const update = (patch) => onChange({ ...row, ...patch });

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