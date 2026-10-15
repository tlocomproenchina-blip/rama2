import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Phone, MapPin, Mail, Home, CalendarDays } from 'lucide-react';

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl bg-muted/50 px-3 py-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium text-foreground">{value || 'Sin dato'}</p>
      </div>
    </div>
  );
}

// Datos de contacto del cliente dentro de su ficha: nombre, cédula, teléfono,
// correo y dirección, tal como están registrados en TLEC CARGO.
export default function SupportClientProfileCard({ client }) {
  if (!client) return null;

  const name = client.full_name || [client.first_name, client.last_name].filter(Boolean).join(' ') || client.email;
  const whatsappDigits = String(client.whatsapp || '').replace(/\D/g, '');

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-primary" /> {name}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {client.cedula ? <Badge variant="secondary">CI {client.cedula}</Badge> : <Badge variant="outline">Sin cédula</Badge>}
          {client.shipping_mark ? <Badge variant="secondary">{client.shipping_mark}</Badge> : null}
          <Badge variant="outline" className={client.is_active === false ? 'border-amber-300 text-amber-700' : 'border-emerald-300 text-emerald-700'}>
            {client.is_active === false ? 'Inactivo' : 'Activo'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Row icon={Mail} label="Correo" value={client.email} />
        {whatsappDigits ? (
          <a
            href={`https://wa.me/${whatsappDigits}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-2 rounded-2xl bg-muted/50 px-3 py-2 transition hover:bg-accent"
          >
            <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">WhatsApp</p>
              <p className="text-sm font-medium text-primary">{client.whatsapp}</p>
            </div>
          </a>
        ) : (
          <Row icon={Phone} label="WhatsApp" value={client.phone} />
        )}
        <Row icon={MapPin} label="Ciudad" value={[client.city, client.state].filter(Boolean).join(', ')} />
        <Row icon={Home} label="Dirección" value={client.address} />
        <Row
          icon={CalendarDays}
          label="Cliente desde"
          value={client.created_date ? new Date(client.created_date).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null}
        />
      </CardContent>
    </Card>
  );
}