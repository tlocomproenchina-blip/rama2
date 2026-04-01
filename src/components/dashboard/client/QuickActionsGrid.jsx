import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Layers } from 'lucide-react';

export default function QuickActionsGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 lg:gap-4">
      <Link to={createPageUrl('PreAlert')}>
        <Card className="border border-border/70 bg-card/95 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-premium cursor-pointer group">
          <CardContent className="p-4 lg:p-6 flex items-center gap-3 lg:gap-4">
            <div className="p-3 lg:p-4 bg-blue-100 rounded-lg lg:rounded-xl group-hover:bg-blue-200 transition-colors flex-shrink-0">
              <Plus className="h-5 w-5 lg:h-6 lg:w-6 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-base lg:text-lg text-slate-800 truncate">Nueva Pre-alerta</h3>
              <p className="text-slate-500 text-xs lg:text-sm">Registra un nuevo paquete</p>
            </div>
          </CardContent>
        </Card>
      </Link>

      <Link to={createPageUrl('MyConsolidations')}>
        <Card className="border border-border/70 bg-card/95 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-premium cursor-pointer group">
          <CardContent className="p-4 lg:p-6 flex items-center gap-3 lg:gap-4">
            <div className="p-3 lg:p-4 bg-purple-100 rounded-lg lg:rounded-xl group-hover:bg-purple-200 transition-colors flex-shrink-0">
              <Layers className="h-5 w-5 lg:h-6 lg:w-6 text-purple-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-base lg:text-lg text-slate-800 truncate">Mis Consolidaciones</h3>
              <p className="text-slate-500 text-xs lg:text-sm">Ver todas tus consolidaciones</p>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}