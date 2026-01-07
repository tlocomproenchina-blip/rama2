import React from 'react';
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  Package, 
  Layers, 
  Truck, 
  MapPin, 
  CheckCircle2,
  Clock,
  CreditCard
} from 'lucide-react';

const statusConfig = {
  // Package statuses
  pre_alerta: { 
    label: 'Pre-alerta', 
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: AlertCircle
  },
  recibido: { 
    label: 'Recibido', 
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Package
  },
  consolidado: { 
    label: 'Consolidado', 
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: Layers
  },
  en_transito: { 
    label: 'En Tránsito', 
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    icon: Truck
  },
  disponible: { 
    label: 'Disponible', 
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: MapPin
  },
  entregado: { 
    label: 'Entregado', 
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: CheckCircle2
  },
  // Consolidation statuses
  pendiente_pago: {
    label: 'Pendiente de Pago',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: CreditCard
  },
  pago_pendiente_validacion: {
    label: 'Validando Pago',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: Clock
  }
};

export default function StatusBadge({ status, size = 'default' }) {
  const config = statusConfig[status] || { 
    label: status, 
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: Package
  };
  
  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  return (
    <Badge 
      variant="outline" 
      className={`${config.color} ${sizeClasses} font-medium inline-flex items-center gap-1.5 border`}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {config.label}
    </Badge>
  );
}