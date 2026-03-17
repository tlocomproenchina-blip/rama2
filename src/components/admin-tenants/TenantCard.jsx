import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, CheckCircle2, Edit2 } from 'lucide-react';

export default function TenantCard({ tenant, isCurrent, onSelect, onEdit }) {
  return (
    <Card className={`border-0 shadow-md transition-all ${isCurrent ? 'ring-2 ring-blue-500' : ''}`}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-slate-700" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-800 truncate">{tenant.name}</h3>
              <p className="text-sm text-slate-500 truncate">{tenant.slug}</p>
              <p className="text-xs text-slate-400 truncate">{tenant.owner_email || 'Sin responsable'}</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {tenant.is_default && <Badge variant="outline">Principal</Badge>}
            <Badge className={tenant.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}>
              {tenant.is_active ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant={isCurrent ? 'secondary' : 'default'} className="flex-1" onClick={() => onSelect(tenant)}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {isCurrent ? 'Tenant actual' : 'Usar este tenant'}
          </Button>
          <Button variant="outline" onClick={() => onEdit(tenant)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}