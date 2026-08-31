import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PackageX, ShieldCheck, FileText } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PackagesWithoutReceiptSection({ packages, onChange, selectedRows }) {
  if (!packages || packages.length === 0) return null;

  const updatePkg = (id, patch) => {
    onChange(packages.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const selectAll = (val) => {
    onChange(packages.map((p) => ({ ...p, selected: !!val })));
  };

  const selectedCount = packages.filter((p) => p.selected).length;
  const allSelected = packages.length > 0 && selectedCount === packages.length;

  // Recibos seleccionados en la lista principal — opciones del dropdown
  const availableReceipts = (selectedRows || []).filter((r) => r.invoice_number && r.invoice_number !== '—');

  return (
    <Card className="border-amber-200 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(c) => selectAll(!!c)}
            />
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
          Estos paquetes no tienen recibo registrado. Selecciona los que deseas facturar y asígnalos a un recibo ya seleccionado en la lista principal.
          Al generar la factura, el paquete se integrará al recibo elegido.
        </p>
        {selectedCount > 0 && availableReceipts.length === 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-2 text-xs text-amber-700">
            Primero selecciona al menos un recibo en la lista principal para poder asignar estos paquetes.
          </div>
        )}
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
                    <div className="mt-2 max-w-[260px]">
                      <Label className="text-xs flex items-center gap-1 mb-1"><FileText className="h-3 w-3" /> Asignar a recibo</Label>
                      <Select
                        value={pkg.assigned_receipt_id || ''}
                        onValueChange={(val) => updatePkg(pkg.id, { assigned_receipt_id: val })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={availableReceipts.length === 0 ? "Sin recibos seleccionados" : "Elegir recibo..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableReceipts.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.invoice_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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