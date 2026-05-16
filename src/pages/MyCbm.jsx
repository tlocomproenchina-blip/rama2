import React from 'react';
import ClientCbmWidget from '@/components/client-portal/ClientCbmWidget';
import { TrendingUp } from 'lucide-react';

export default function MyCbm({ user }) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-blue-100 flex items-center justify-center">
          <TrendingUp className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mis CBM Registrados</h1>
          <p className="text-sm text-muted-foreground">
            Consulta el detalle de tus CBM acumulados por factura y por mes.
          </p>
        </div>
      </div>

      {user?.email ? (
        <ClientCbmWidget userEmail={user.email} />
      ) : (
        <div className="rounded-xl border border-border/70 bg-card p-6 text-sm text-muted-foreground">
          Cargando datos del cliente...
        </div>
      )}
    </div>
  );
}