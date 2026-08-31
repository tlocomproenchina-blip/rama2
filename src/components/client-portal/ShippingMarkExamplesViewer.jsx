import React, { useState } from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Package, ChevronDown } from 'lucide-react';
import OptimizedImage from '@/components/OptimizedImage';

export default function ShippingMarkExamplesViewer({ examples }) {
  const list = Array.isArray(examples) ? examples.filter((e) => e && (e.image_url || e.description)) : [];
  const [openIndex, setOpenIndex] = useState(null);

  if (list.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-slate-500 text-xs md:text-sm">
        <Package className="h-3.5 w-3.5 lg:h-4 lg:w-4 flex-shrink-0" />
        Ejemplos por plataforma
      </div>
      {list.map((item, index) => (
        <Collapsible
          key={index}
          open={openIndex === index}
          onOpenChange={(open) => setOpenIndex(open ? index : null)}
          className="border border-slate-200 rounded-lg bg-white/70 overflow-hidden"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center justify-between w-full p-3 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Package className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span className="font-medium text-slate-800 text-sm truncate">
                  {item.title || `Ejemplo ${index + 1}`}
                </span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-slate-500 shrink-0 transition-transform ${openIndex === index ? 'rotate-180' : ''}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-3 pt-0 space-y-2">
              {item.description && (
                <p className="text-xs text-slate-600 whitespace-pre-line">{item.description}</p>
              )}
              {item.image_url && (
                <OptimizedImage
                  src={item.image_url}
                  alt={item.title || 'Ejemplo de Shipping Mark'}
                  width={800}
                  height={600}
                  className="w-full rounded-lg border border-slate-200 shadow-sm"
                  priority={false}
                />
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}