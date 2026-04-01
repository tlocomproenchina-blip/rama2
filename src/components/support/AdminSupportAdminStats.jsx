import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AdminSupportAdminStats({ adminStats }) {
  return (
    <div className="grid gap-4">
      {adminStats.map((stat) => (
        <Card key={stat.admin.email} className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                  {(stat.admin.full_name?.[0] || stat.admin.email[0]).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{stat.admin.full_name || stat.admin.email}</h3>
                  <p className="text-sm text-slate-500">{stat.admin.email}</p>
                </div>
              </div>
              <Badge className="bg-slate-100 text-slate-700">{stat.total} tickets totales</Badge>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-600 mb-1">Abiertos</p>
                <p className="text-2xl font-bold text-blue-700">{stat.abierto}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <p className="text-xs text-yellow-600 mb-1">En Proceso</p>
                <p className="text-2xl font-bold text-yellow-700">{stat.en_proceso}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                <p className="text-xs text-green-600 mb-1">Resueltos</p>
                <p className="text-2xl font-bold text-green-700">{stat.resuelto}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-xs text-slate-600 mb-1">Cerrados</p>
                <p className="text-2xl font-bold text-slate-700">{stat.cerrado}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}