import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PackageX, Boxes, ShieldCheck } from 'lucide-react';

export default function PackagesWithoutReceiptSection({ packages, onChange }) {
  if (!packages || packages.length === 0) return null;

  const updatePkg = (id, patch) => {
    onChange(packages.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const selectAll = (val) => {
    onChange(packages.map((p) => ({ ...p, selected: !!val })));
  };

  const selectedCount = packages.filter((p) => p.selected).length;

  return (
    <Card className="border-amber-200 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <PackageX className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-slate-800">Paquetes sin recibo</h3>
            <span className="text-xs text-slate-500">({packages.length})</span>
          </div>
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={() => selectAll(false)}
              className="text-xs text-blue-600 hover:underline"
            >
              Limpiar selección ({selectedCount})
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Estos paquetes no tienen recibo registrado. Selecciona los que deseas facturar e ingresa su CBM.
          Se creará un recibo automático al generar la factura.
        </p>
        <div className="space-y-2">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`rounded-lg border p-3 transition-colors ${pkg.selected ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={pkg.selected}
                  onCheckedChange={(c) => updatePkg(pkg.id, { selected: !!c })}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm text-slate-700 break-all">{pkg.tracking_number}</p>
                  {pkg.fob_value > 0 && (
                    <p className="text-xs text-emerald-700 flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="h-3 w-3" /> FOB ${Number(pkg.fob_value).toFixed(2)}
                    </p>
                  )}
                  {pkg.selected && (
                    <div className="mt-2 max-w-[200px]">
                      <Label className="text-xs flex items-center gap-1"><Boxes className="h-3 w-3" /> CBM</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={pkg.cbm || ''}
                        onChange={(e) => updatePkg(pkg.id, { cbm: e.target.value })}
                        placeholder="0.0000"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}