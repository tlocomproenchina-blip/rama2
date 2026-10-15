import React, { useState } from 'react';
import { Package, ChevronDown, ChevronRight, Camera, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Client360Section from './Client360Section';
import Client360PackageDetail from './Client360PackageDetail';

const STATUS = {
  pre_alerta: { label: 'Pre-Alerta', cls: 'bg-amber-100 text-amber-700' },
  recibido: { label: 'Recibido', cls: 'bg-blue-100 text-blue-700' },
  rechazado: { label: 'Rechazado', cls: 'bg-red-100 text-red-700' },
  consolidado: { label: 'Consolidado', cls: 'bg-purple-100 text-purple-700' },
  en_transito: { label: 'En Tránsito', cls: 'bg-cyan-100 text-cyan-700' },
  disponible: { label: 'Disponible', cls: 'bg-green-100 text-green-700' },
  despachado: { label: 'Despachado', cls: 'bg-indigo-100 text-indigo-700' },
  entregado: { label: 'Entregado', cls: 'bg-slate-100 text-slate-700' }
};

export default function Client360Packages({ packages }) {
  const [expandedId, setExpandedId] = useState(null);

  const insured = packages.filter((p) => p.has_insurance).length;

  return (
    <Client360Section icon={Package} title="Paquetes / Pre-alertas" count={packages.length}>
      {packages.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
          <span>{insured} con seguro · {packages.length - insured} sin seguro</span>
        </div>
      )}
      {packages.map((p) => {
        const isOpen = expandedId === p.id;
        const hasPhotos = (p.package_image_urls || []).length > 0 || p.package_image_url || p.product_image_url;
        return (
          <div key={p.id}>
            <button
              type="button"
              onClick={() => setExpandedId(isOpen ? null : p.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
            >
              {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs text-slate-800 truncate">{p.tracking_number}</p>
                <p className="text-xs text-slate-500 truncate">{p.description}</p>
              </div>
              {hasPhotos && <Camera className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />}
              {p.has_insurance && <ShieldCheck className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />}
              <span className="text-[10px] text-slate-400 whitespace-nowrap">
                {p.created_date ? new Date(p.created_date).toLocaleDateString('es-VE') : ''}
              </span>
              <Badge className={`text-[10px] ${STATUS[p.status]?.cls || 'bg-slate-100 text-slate-600'}`}>
                {STATUS[p.status]?.label || p.status}
              </Badge>
            </button>
            {isOpen && <Client360PackageDetail pkg={p} />}
          </div>
        );
      })}
    </Client360Section>
  );
}