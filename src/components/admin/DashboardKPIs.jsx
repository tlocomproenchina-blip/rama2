import React from 'react';
import { Users, Truck, DollarSign, Clock } from 'lucide-react';

export default function DashboardKPIs({ kpis }) {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl">
      <h2 className="text-2xl font-bold mb-6">📊 Key Performance Indicators</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-6 w-6 text-blue-200" />
            <span className="text-xs text-blue-200 font-medium">Clientes</span>
          </div>
          <p className="text-4xl font-bold">{kpis.activeClients}</p>
          <p className="text-xs text-blue-200 mt-1">Activos</p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <Truck className="h-6 w-6 text-indigo-200" />
            <span className="text-xs text-indigo-200 font-medium">En Tránsito</span>
          </div>
          <p className="text-4xl font-bold">{kpis.packagesInTransit}</p>
          <p className="text-xs text-indigo-200 mt-1">Paquetes</p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-6 w-6 text-emerald-200" />
            <span className="text-xs text-emerald-200 font-medium">Ingresos</span>
          </div>
          <p className="text-4xl font-bold">${kpis.validatedRevenue.toFixed(0)}</p>
          <p className="text-xs text-emerald-200 mt-1">Validados</p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <Clock className="h-6 w-6 text-purple-200" />
            <span className="text-xs text-purple-200 font-medium">Tiempo Prom.</span>
          </div>
          <p className="text-4xl font-bold">{kpis.avgValidationTime.toFixed(1)}</p>
          <p className="text-xs text-purple-200 mt-1">Horas validación</p>
        </div>
      </div>
    </div>
  );
}