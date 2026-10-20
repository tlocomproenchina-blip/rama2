import React from 'react';
import { CreditCard, Mail, MapPin, MessageCircle, Hash, Package, FileText } from 'lucide-react';

// Ficha de solo lectura con todos los datos del cliente que trae la guía.
const Campo = ({ icon: Icon, label, value, className = '' }) => (
  <div className={className}>
    <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3 w-3" /> {label}
    </p>
    <p className="mt-0.5 break-words text-xs font-medium text-foreground">{value || '—'}</p>
  </div>
);

export default function PublicClientDataGrid({ client }) {
  const ubicacion = [client?.city, client?.state].filter(Boolean).join(', ');
  const orders = client?.orders || [];

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/70 bg-muted/20 px-4 py-3 sm:grid-cols-3 lg:grid-cols-4">
      <Campo icon={Mail} label="Correo" value={client?.email} />
      <Campo icon={CreditCard} label="Cédula" value={client?.cedula} />
      <Campo icon={MessageCircle} label="WhatsApp" value={client?.whatsapp} />
      <Campo icon={MapPin} label="Ciudad / Estado" value={ubicacion} />
      <Campo
        icon={MapPin}
        label="Dirección"
        value={client?.address}
        className="col-span-2 sm:col-span-3 lg:col-span-2"
      />
      <Campo icon={Hash} label="N° de orden / envío" value={orders.join(', ')} />
      <Campo icon={FileText} label="Guías" value={(client?.guides || []).join(', ')} />
      <Campo
        icon={Package}
        label="Contenedores"
        value={String(Number(client?.totals?.containers) || 0)}
      />
      <Campo
        icon={Package}
        label="Bultos en guías"
        value={String(Number(client?.totals?.bultos) || 0)}
      />
    </div>
  );
}