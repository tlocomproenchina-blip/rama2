import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Headphones, Sparkles, Tag } from 'lucide-react';

export default function PortalHero({ user, onCreateTicket }) {
  return (
    <div className="overflow-hidden rounded-[calc(var(--radius)+0.5rem)] border border-border/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-premium">
      <div className="grid gap-6 p-6 md:grid-cols-[1.3fr_0.7fr] md:p-8">
        <div className="space-y-4">
          <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/10">
            <Sparkles className="mr-1 h-3.5 w-3.5" /> Portal premium
          </Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white md:text-4xl">Mi Portal</h1>
            <p className="max-w-2xl text-sm text-slate-300 md:text-base">
              Bienvenido, {user?.first_name || user?.email}. Aquí ves tus envíos, pagos y soporte en una experiencia más clara y ejecutiva.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onCreateTicket} className="bg-white text-slate-900 hover:bg-slate-100">
              <Headphones className="mr-2 h-4 w-4" /> Crear ticket de soporte
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-white/10 p-3">
              <Tag className="h-5 w-5 text-white" />
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Shipping mark</p>
              <p className="break-all font-mono text-2xl font-bold text-white">
                {user?.shipping_mark || 'Pendiente de asignación'}
              </p>
              <p className="text-sm text-slate-300">Úsalo como referencia visible en todas tus compras.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}