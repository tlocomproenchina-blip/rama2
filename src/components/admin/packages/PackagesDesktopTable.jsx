import React from 'react';
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Package } from 'lucide-react';
import PackagesTableRow from '@/components/admin/packages/PackagesTableRow';

export default function PackagesDesktopTable({
  packages,
  selectedPackages,
  onSelectAll,
  onSelectPackage,
  onCreateTicket,
  onOpenPreAlertEditor,
  onReceive,
  onViewImage,
  onEditImage,
  onCancelReception,
  onStatusChange,
  onEditPackage,
  onViewSellerPhoto,
}) {
  return (
    <Card className="hidden 2xl:block border-0 shadow-lg overflow-hidden">
      <div className="overflow-x-visible">
        <table className="w-full table-fixed">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left pl-3 pr-2 py-3 font-medium text-slate-600">
                <Checkbox
                  checked={selectedPackages.length === packages.length && packages.length > 0}
                  onCheckedChange={onSelectAll}
                />
              </th>
              <th className="text-left p-3 font-medium text-slate-600 w-[20%]">Tracking</th>
              <th className="text-left p-3 font-medium text-slate-600 w-[14%]">Shipping Mark</th>
              <th className="text-left p-3 font-medium text-slate-600 w-[5%]">Tipo</th>
              <th className="text-left p-3 font-medium text-slate-600 w-[5%]">Carga</th>
              <th className="text-left p-3 font-medium text-slate-600 w-[5%]">Bultos</th>
              <th className="text-left p-3 font-medium text-slate-600 w-[6%]">FOB</th>
              <th className="text-left p-3 font-medium text-slate-600 w-[5%]">Estado</th>
              <th className="text-left p-3 font-medium text-slate-600 w-[8%]">Registro</th>
              <th className="text-left p-3 font-medium text-slate-600 w-[8%]">Recepción</th>
              <th className="text-left pl-2 pr-3 py-3 font-medium text-slate-600 w-[14%]">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {packages.map((pkg) => (
              <PackagesTableRow
                key={pkg.id}
                pkg={pkg}
                isSelected={selectedPackages.includes(pkg.id)}
                onSelectPackage={onSelectPackage}
                onCreateTicket={onCreateTicket}
                onOpenPreAlertEditor={onOpenPreAlertEditor}
                onReceive={onReceive}
                onViewImage={onViewImage}
                onEditImage={onEditImage}
                onCancelReception={onCancelReception}
                onStatusChange={onStatusChange}
                onEditPackage={onEditPackage}
                onViewSellerPhoto={onViewSellerPhoto}
              />
            ))}
          </tbody>
        </table>
      </div>

      {packages.length === 0 && (
        <div className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500">No se encontraron paquetes</p>
        </div>
      )}
    </Card>
  );
}