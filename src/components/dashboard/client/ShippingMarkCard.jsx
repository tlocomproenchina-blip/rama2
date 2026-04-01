import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Building2, Copy } from 'lucide-react';
import OptimizedImage from '@/components/OptimizedImage';

export default function ShippingMarkCard({ user, config, onCopyShippingMark, onCopyAddress }) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-card">
      <CardContent className="p-3 md:p-4 lg:p-6">
        <div className="flex flex-col gap-4 md:gap-5 lg:flex-row lg:gap-6">
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center gap-2 text-slate-500 text-xs md:text-sm">
              <Package className="h-3.5 w-3.5 lg:h-4 lg:w-4 flex-shrink-0" />
              Tu Shipping Mark
            </div>
            <div className="flex items-center gap-2 md:gap-2.5 lg:gap-3 min-w-0">
              <span className="text-lg md:text-2xl lg:text-3xl font-bold text-slate-800 font-mono break-all">
                {user.shipping_mark}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onCopyShippingMark}>
                <Copy className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 space-y-2 border-t md:border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 md:pt-4 lg:pt-0 lg:pl-6 min-w-0">
            <div className="flex items-center gap-2 text-slate-500 text-xs md:text-sm">
              <Building2 className="h-3.5 w-3.5 lg:h-4 lg:w-4 flex-shrink-0" />
              Dirección del Warehouse
            </div>
            <div className="flex items-start gap-2 md:gap-2.5 lg:gap-3 min-w-0">
              <p className="text-slate-700 text-xs md:text-sm lg:text-base break-words flex-1 whitespace-pre-line">
                {config?.warehouse_address || 'Dirección no configurada'}
              </p>
              {config?.warehouse_address && (
                <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onCopyAddress}>
                  <Copy className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {config?.shipping_mark_example_image_url && (
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs md:text-sm mb-3">
              <Package className="h-3.5 w-3.5 lg:h-4 lg:w-4 flex-shrink-0" />
              Imagen de ejemplo del Shipping Mark
            </div>
            <div className="bg-slate-50 rounded-lg p-3 md:p-4">
              <p className="text-xs md:text-sm text-slate-600 mb-3 whitespace-pre-line">
                {config.shipping_mark_example_description || 'Esta imagen se mostrará a los usuarios como ejemplo de cómo debe quedar su shipping mark'}
              </p>
              <OptimizedImage
                src={config.shipping_mark_example_image_url}
                alt="Ejemplo de Shipping Mark"
                width={800}
                height={600}
                className="w-full max-w-md mx-auto rounded-lg border border-slate-200 shadow-sm"
                priority={false}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}