import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Users, CheckCircle, Clock, Package } from 'lucide-react';

export default function ClientsStatsCards({ counts, fallbackTotal = 0 }) {
  const c = counts || { total: 0, withMark: 0, pending: 0, totalPackages: 0 };
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-0 shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Clientes</p>
              <p className="text-3xl font-bold text-slate-800">{c.total || fallbackTotal}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Con Shipping Mark</p>
              <p className="text-3xl font-bold text-slate-800">{c.withMark}</p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Pendientes</p>
              <p className="text-3xl font-bold text-slate-800">{c.pending}</p>
            </div>
            <div className="p-3 bg-amber-100 rounded-xl">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Paquetes</p>
              <p className="text-3xl font-bold text-slate-800">{c.totalPackages}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <Package className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}