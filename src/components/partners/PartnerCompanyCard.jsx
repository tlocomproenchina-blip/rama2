import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Building2, Copy, Eye, EyeOff, Pencil, Trash2, KeyRound, Phone, Mail, MapPin, Terminal } from 'lucide-react';
import { toast } from 'sonner';

// Tarjeta de una empresa socia: datos, distintivo, llave de servicio e instrucciones.
export default function PartnerCompanyCard({ company, onEdit, onToggleActive, onDelete }) {
  const [showKey, setShowKey] = useState(false);
  const color = company.brand_color || '#0ea5e9';

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(company.service_key || '');
      toast.success('Llave copiada');
    } catch (_) {
      toast.error('No se pudo copiar la llave');
    }
  };

  const maskedKey = company.service_key
    ? `${company.service_key.slice(0, 8)}${'•'.repeat(Math.max(0, (company.service_key.length || 0) - 12))}${company.service_key.slice(-4)}`
    : 'Sin llave';

  return (
    <Card className="shadow-sm" style={{ borderColor: `${color}44` }}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.company_name} className="h-11 w-11 rounded-xl object-cover border shrink-0" />
            ) : (
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}1a`, color }}
              >
                <Building2 className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-slate-800 truncate">{company.company_name}</p>
                <Badge variant="outline" className="font-mono text-[10px]" style={{ borderColor: `${color}55`, color }}>
                  {company.company_code}
                </Badge>
                {company.is_active === false && (
                  <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50">Inactiva</Badge>
                )}
              </div>
              {company.tagline && <p className="text-xs text-slate-500 truncate">{company.tagline}</p>}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                {company.contact_name && <span>{company.contact_name}</span>}
                {company.contact_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{company.contact_email}</span>}
                {company.contact_whatsapp && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{company.contact_whatsapp}</span>}
                {(company.city || company.state) && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[company.city, company.state].filter(Boolean).join(', ')}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch checked={company.is_active !== false} onCheckedChange={(v) => onToggleActive?.(company, v)} />
            <Button variant="outline" size="icon" onClick={() => onEdit?.(company)} title="Editar"><Pencil className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => onDelete?.(company)} title="Eliminar" className="border-rose-200 text-rose-600 hover:bg-rose-50">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {(company.shipping_mark_prefix || company.label_prefix || company.order_prefix) && (
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
            {company.shipping_mark_prefix && <Badge variant="secondary">Mark: {company.shipping_mark_prefix}</Badge>}
            {company.label_prefix && <Badge variant="secondary">Etiqueta: {company.label_prefix}</Badge>}
            {company.order_prefix && <Badge variant="secondary">Bulto/Orden: {company.order_prefix}</Badge>}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <KeyRound className="h-3.5 w-3.5" /> Llave de servicio
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <code className="flex-1 min-w-0 text-[11px] font-mono text-slate-700 break-all">{showKey ? company.service_key : maskedKey}</code>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setShowKey((v) => !v)} className="gap-1.5">
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showKey ? 'Ocultar' : 'Ver'}
              </Button>
              <Button variant="outline" size="sm" onClick={copyKey} className="gap-1.5"><Copy className="h-3.5 w-3.5" /> Copiar</Button>
            </div>
          </div>
          {company.last_service_use_date && (
            <p className="text-[11px] text-slate-500">
              Último uso: {new Date(company.last_service_use_date).toLocaleString('es-VE')}
            </p>
          )}
          <details className="text-[11px] text-slate-600">
            <summary className="cursor-pointer flex items-center gap-1.5 text-slate-600 font-medium">
              <Terminal className="h-3.5 w-3.5" /> Cómo conecta su app secundaria
            </summary>
            <div className="mt-2 space-y-1.5 font-mono text-[10px] bg-white border rounded-lg p-2 overflow-x-auto">
              <p>POST https://tleccargo.base44.app/functions/partnerApi</p>
              <p>x-partner-key: {showKey ? company.service_key : '••••••••'}</p>
              <p>{'{"action":"tracking.get","tracking_number":"..."}'}</p>
              <p className="text-slate-500 font-sans">
                Acciones: company.info · client.upsert · client.list · prealert.upsert · prealert.list · tracking.get ·
                tracking.list · assignment.list · bulto.list · invoice.list
              </p>
            </div>
          </details>
        </div>

        {company.notes && <p className="text-xs text-slate-500 whitespace-pre-wrap">{company.notes}</p>}
      </CardContent>
    </Card>
  );
}