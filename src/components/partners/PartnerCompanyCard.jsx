import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Copy, Eye, EyeOff, KeyRound, Pencil, Power, ShieldCheck, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_STYLE = {
  activa: 'bg-emerald-100 text-emerald-700',
  suspendida: 'bg-amber-100 text-amber-700',
  desactivada: 'bg-rose-100 text-rose-700',
};

const STATUS_LABEL = {
  activa: 'Activa',
  suspendida: 'Suspendida',
  desactivada: 'Desactivada',
};

export default function PartnerCompanyCard({ company, onEdit, onRotate, onToggleStatus, onProbe, onViewUsage }) {
  const [reveal, setReveal] = useState(false);
  const status = company.status || 'activa';
  const active = status === 'activa';

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(company.service_key || '');
      toast.success('Llave copiada');
    } catch {
      toast.error('No se pudo copiar la llave');
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {company.app_logo_url ? (
            <img src={company.app_logo_url} alt="" className="h-10 w-10 rounded-xl object-cover ring-1 ring-border/60" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-500">
              <Building2 className="h-5 w-5 text-white" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-800">{company.app_name || company.name}</p>
            <p className="truncate text-xs text-slate-500">
              {company.name} · código <span className="font-mono font-semibold">{company.company_code}</span>
            </p>
          </div>
          <Badge className={STATUS_STYLE[status] || STATUS_STYLE.activa}>{STATUS_LABEL[status] || status}</Badge>
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-2.5">
            <p className="uppercase tracking-wide text-slate-400">Última conexión de su llave</p>
            <p className="mt-0.5 text-slate-700">
              {company.service_key_last_used_date
                ? new Date(company.service_key_last_used_date).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })
                : 'Sin usar todavía'}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2.5">
            <p className="uppercase tracking-wide text-slate-400">App / dominio</p>
            <p className="mt-0.5 break-all text-slate-700">{company.app_public_url || company.custom_domain || 'Por definir'}</p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Llave de servicio</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all text-xs text-slate-700">
              {reveal ? (company.service_key || '—') : `${company.service_key_prefix || ''}${'•'.repeat(18)}`}
            </code>
            <Button variant="ghost" size="sm" onClick={() => setReveal((v) => !v)} className="gap-1">
              {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {reveal ? 'Ocultar' : 'Ver'}
            </Button>
            <Button variant="ghost" size="sm" onClick={copyKey} className="gap-1">
              <Copy className="h-3.5 w-3.5" /> Copiar
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onProbe} className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Probar canal
          </Button>
          <Button variant="outline" size="sm" onClick={onViewUsage} className="gap-1">
            <BarChart3 className="h-3.5 w-3.5" /> Ver uso
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit} className="gap-1">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
          <Button variant="outline" size="sm" onClick={onRotate} className="gap-1 border-amber-300 text-amber-700">
            <KeyRound className="h-3.5 w-3.5" /> Rotar llave
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleStatus(active ? 'desactivada' : 'activa')}
            className={`gap-1 ${active ? 'border-rose-300 text-rose-700' : 'border-emerald-300 text-emerald-700'}`}
          >
            <Power className="h-3.5 w-3.5" /> {active ? 'Desactivar acceso' : 'Activar acceso'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}