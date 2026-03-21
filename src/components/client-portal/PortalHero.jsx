import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Headphones, Sparkles, Tag } from 'lucide-react';

export default function PortalHero({ user, onCreateTicket }) {
  return (
    <div className="overflow-hidden rounded-[calc(var(--radius)+0.75rem)] border border-border/70 bg-gradient-to-br from-sky-50 via-white to-blue-100 text-foreground shadow-card">
      <div className="grid gap-6 p-6 md:grid-cols-[1.2fr_0.8fr] md:p-8">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-white text-primary shadow-sm hover:bg-white">
              <Sparkles className="mr-1 h-3.5 w-3.5" /> Portal premium
            </Badge>
            <Badge variant="outline" className="border-blue-100 bg-white/80 text-muted-foreground">
              Vista del cliente
            </Badge>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Mi Portal</h1>
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              Bienvenido, {user?.first_name || user?.email}. Aquí ves tus envíos, pagos y soporte con el mismo estilo claro y premium del panel administrativo.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onCreateTicket}>
              <Headphones className="mr-2 h-4 w-4" /> Crear ticket de soporte
            </Button>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-blue-100 bg-white/82 p-5 shadow-card backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-primary shadow-sm">
              <Tag className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Shipping mark</p>
              <p className="break-all font-mono text-2xl font-bold text-foreground">
                {user?.shipping_mark || 'Pendiente de asignación'}
              </p>
              <p className="text-sm text-muted-foreground">Úsalo como referencia visible en todas tus compras.</p>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100/90 px-3 py-1 text-xs font-medium text-slate-600">
                Copia este código en tus compras <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}