import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, SlidersHorizontal, Sparkles } from 'lucide-react';

const ranges = [
  { key: 'today', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: 'all', label: 'Todo el tiempo' },
];

export default function AdminDashboardHero({ mainTab, range, setRange, onRefresh, onCustomize, onTabChange }) {
  return (
    <div className="overflow-hidden rounded-[calc(var(--radius)+0.5rem)] border border-border/70 bg-gradient-to-br from-sky-50 via-white to-blue-100 text-foreground shadow-card">
      <div className="space-y-5 p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary" className="bg-white text-primary shadow-sm hover:bg-white">
              <Sparkles className="mr-1 h-3.5 w-3.5" /> Centro de control premium
            </Badge>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 md:text-4xl">Panel de Control</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
                {mainTab === 'api' ? 'Estado del sistema y cola de API.' : 'Vista ejecutiva de operaciones, pagos, clientes y actividad reciente.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant={mainTab === 'resumen' ? 'secondary' : 'outline'} onClick={() => onTabChange('resumen')} className="border-blue-100 bg-white text-foreground hover:bg-blue-50">
              Resumen
            </Button>
            <Button variant={mainTab === 'api' ? 'secondary' : 'outline'} onClick={() => onTabChange('api')} className="border-blue-100 bg-white text-foreground hover:bg-blue-50">
              API
            </Button>
            <Button variant="outline" onClick={onRefresh} className="border-blue-100 bg-white text-foreground hover:bg-blue-50">
              <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
            </Button>
            <Button onClick={onCustomize} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <SlidersHorizontal className="mr-2 h-4 w-4" /> Personalizar
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {ranges.map((item) => (
            <Button
              key={item.key}
              variant="outline"
              size="sm"
              onClick={() => setRange(item.key)}
              className={range === item.key ? 'border-blue-200 bg-primary text-primary-foreground hover:bg-primary/90' : 'border-blue-100 bg-white text-foreground hover:bg-blue-50'}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}