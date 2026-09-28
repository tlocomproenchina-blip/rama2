import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users } from 'lucide-react';
import ClientCard from './ClientCard';

export default function ClientsList({
  clients,
  packagesCount,
  roleUpdatingId,
  hasMore,
  loadingMore,
  onLoadMore,
  onCopyInfo,
  onAddPackage,
  onView,
  onEdit,
  onDelete,
  onDeleteStripeCustomer,
  onToggleActive,
  onChangeRole,
}) {
  if (clients.length === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-12 text-center">
          <Users className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin clientes</h3>
          <p className="text-slate-500">No se encontraron clientes</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 w-full min-w-0">
        {clients.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            packagesCount={packagesCount}
            roleUpdatingId={roleUpdatingId}
            onCopyInfo={onCopyInfo}
            onAddPackage={onAddPackage}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            onDeleteStripeCustomer={onDeleteStripeCustomer}
            onToggleActive={onToggleActive}
            onChangeRole={onChangeRole}
          />
        ))}
      </div>
      {hasMore && (
        <Button variant="outline" className="w-full mt-4" onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? 'Cargando...' : 'Cargar más'}
        </Button>
      )}
    </>
  );
}