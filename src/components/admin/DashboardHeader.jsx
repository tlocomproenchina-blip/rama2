import React from 'react';
import { Button } from '@/components/ui/button';
import { TrendingUp, Loader2 } from 'lucide-react';

export default function DashboardHeader({ user, onRefresh, refreshing }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Panel de Administración</h1>
        <p className="text-slate-500">Bienvenido, {user?.full_name || user?.email}</p>
      </div>
      <Button
        onClick={onRefresh}
        disabled={refreshing}
        variant="outline"
        size="lg"
        className="flex items-center gap-2"
      >
        {refreshing ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> Actualizando...</>
        ) : (
          <><TrendingUp className="h-5 w-5" /> Actualizar Dashboard</>
        )}
      </Button>
    </div>
  );
}