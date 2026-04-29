import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Package } from 'lucide-react';
import MobilePackageCard from '@/components/admin/MobilePackageCard';

export default function PackagesMobileList({
  packages,
  selectedPackages,
  onSelect,
  onCreateTicket,
  onReceive,
  onViewImage,
  onEditImage,
  onCancelReception,
  onStatusChange,
  onEditPackage,
}) {
  return (
    <>
      <div className="grid gap-3 2xl:hidden">
        {packages.map((pkg) => (
          <MobilePackageCard
            key={pkg.id}
            pkg={pkg}
            isSelected={selectedPackages.includes(pkg.id)}
            onSelect={(checked) => onSelect(pkg.id, checked)}
            onCreateTicket={() => onCreateTicket(pkg)}
            onReceive={() => onReceive(pkg)}
            onViewImage={(url) => onViewImage(url)}
            onEditImage={() => onEditImage(pkg)}
            onCancelReception={() => onCancelReception(pkg)}
            onStatusChange={(val) => onStatusChange(pkg, val)}
            onEditPackage={() => onEditPackage?.(pkg)}
          />
        ))}
      </div>

      {packages.length === 0 && (
        <Card className="lg:hidden border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">No se encontraron paquetes</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}