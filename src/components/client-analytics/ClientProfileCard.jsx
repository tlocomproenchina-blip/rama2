import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Mail, Phone, MapPin, Hash, Calendar, IdCard, Building, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { buildWhatsAppUrl } from '@/lib/whatsappContact';

const Item = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
      <Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-800 break-words">{value || '—'}</p>
    </div>
  </div>
);

export default function ClientProfileCard({ client }) {
  if (!client) return null;
  const fullName = `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.full_name || client.email;
  const created = client.created_date ? format(new Date(client.created_date), 'dd/MM/yyyy') : null;
  const address = [client.address, client.city, client.state, client.country].filter(Boolean).join(', ');

  const handleContactWhatsApp = () => {
    const phone = client.whatsapp || client.phone || '';
    if (!phone) {
      toast.error('Este cliente no tiene WhatsApp registrado');
      return;
    }
    const firstName = client.first_name || (client.full_name ? client.full_name.split(' ')[0] : 'estimado cliente');
    const message = `Hola ${firstName}, le contactamos de TLEC CARGO.`;
    const url = buildWhatsAppUrl(phone, message);
    if (!url) {
      toast.error('Número de WhatsApp inválido');
      return;
    }
    window.open(url, '_blank');
  };

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{fullName}</h2>
              <p className="text-xs text-slate-500">{client.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {client.shipping_mark && (
              <Badge variant="outline" className="font-mono">{client.shipping_mark}</Badge>
            )}
            {client.role && <Badge variant="secondary">{client.custom_role || client.role}</Badge>}
            <Badge className={client.is_active === false ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}>
              {client.is_active === false ? 'Inactivo' : 'Activo'}
            </Badge>
            <Button
              size="sm"
              onClick={handleContactWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Contactar por WhatsApp
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          <Item icon={Mail} label="Email" value={client.email} />
          <Item icon={Phone} label="WhatsApp" value={client.whatsapp} />
          <Item icon={IdCard} label="Cédula / ID" value={client.cedula || client.id_number} />
          <Item icon={Hash} label="Shipping Mark" value={client.shipping_mark} />
          <Item icon={Calendar} label="Registro" value={created} />
          <Item icon={Building} label="Empresa" value={client.company_name} />
          <Item icon={MapPin} label="Dirección" value={address} />
          <Item icon={Hash} label="Código de referido" value={client.referral_code} />
        </div>
      </CardContent>
    </Card>
  );
}