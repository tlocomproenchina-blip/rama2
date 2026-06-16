import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import {
  Mail, MapPin, Phone, Tag, Clock, Package, CalendarDays,
  Crown, Copy, Plus, Eye, Edit2, Trash2, MessageCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ROLE_OPTIONS, ROLE_PRESETS } from '@/lib/rolePermissions';
import { buildWhatsAppUrl } from '@/lib/whatsappContact';
import { toast } from 'sonner';

const hasIncompleteData = (c) => !c.first_name || !c.last_name || !c.whatsapp || !c.state || !c.city || !c.address;
const hasValidShippingMark = (c) => !!(c.shipping_mark && c.shipping_mark.trim().length > 0);

export default function ClientCard({
  client,
  packagesCount,
  roleUpdatingId,
  onCopyInfo,
  onAddPackage,
  onView,
  onEdit,
  onDelete,
  onDeleteStripeCustomer,
  onToggleActive,
  onChangeRole,
}) {
  const flagAmber = !hasValidShippingMark(client) && client.profile_completed && !hasIncompleteData(client);
  const displayName = client.first_name && client.last_name
    ? `${client.first_name} ${client.last_name}`
    : client.email;

  return (
    <Card className={`border-0 shadow-md hover:shadow-lg transition-shadow ${flagAmber ? 'border-l-4 border-l-amber-400' : ''}`}>
      <CardContent className="p-4 lg:p-6 space-y-4">
        {/* Header: avatar + name + email */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
            {(client.first_name?.[0] || client.email?.[0] || '?').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800 truncate" title={displayName}>
              {displayName}
            </h3>
            <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5 min-w-0">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate" title={client.email}>{client.email}</span>
            </div>
          </div>
        </div>

        {/* Details badges */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline" className="bg-slate-50 whitespace-nowrap">
            Rol: {client.role === 'admin' ? (
              <span className="inline-flex items-center gap-1">
                <Crown className="h-3 w-3 text-amber-500" />
                {ROLE_PRESETS[client.custom_role]?.role_name || 'Administrador'}
              </span>
            ) : 'Cliente'}
          </Badge>
          {client.city && (
            <Badge variant="outline" className="bg-slate-50 whitespace-nowrap max-w-[220px]">
              <MapPin className="h-3 w-3 mr-1 shrink-0" />
              <span className="truncate">{client.city}</span>
            </Badge>
          )}
          {client.whatsapp && (
            <Badge variant="outline" className="bg-slate-50 whitespace-nowrap">
              <Phone className="h-3 w-3 mr-1 shrink-0" />
              {client.whatsapp}
            </Badge>
          )}
          {hasValidShippingMark(client) ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 whitespace-nowrap">
              <Tag className="h-3 w-3 mr-1 shrink-0" />
              {client.shipping_mark}
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 whitespace-nowrap">
              <Clock className="h-3 w-3 mr-1 shrink-0" />
              Sin Shipping Mark
            </Badge>
          )}
          {client.created_date && (
            <Badge variant="outline" className="bg-slate-50 whitespace-nowrap">
              <CalendarDays className="h-3 w-3 mr-1 shrink-0" />
              {format(new Date(client.created_date), 'dd MMM yyyy', { locale: es })}
            </Badge>
          )}
          <Badge variant="outline" className="whitespace-nowrap">
            <Package className="h-3 w-3 mr-1 shrink-0" />
            {packagesCount[client.email] || 0} paquetes
          </Badge>
          {client.is_active === false && (
            <Badge className="bg-red-100 text-red-700 border-red-200 whitespace-nowrap">Inactivo</Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 pr-3 mr-auto sm:border-r border-slate-200">
            <span className="text-xs text-slate-600">Activo</span>
            <Switch
              checked={client.is_active !== false}
              onCheckedChange={(checked) => onToggleActive(client, checked)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onCopyInfo(client); }}
            title="Copiar información"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddPackage(client)}
            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          >
            <Plus className="h-4 w-4 mr-1" />
            Paquete
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(client)}
          >
            <Eye className="h-4 w-4 mr-1" />
            Ver
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = buildWhatsAppUrl(client.whatsapp, `Hola ${client.first_name || ''}, te escribimos del equipo de soporte.`);
              if (!url) { toast.error('Cliente sin WhatsApp registrado'); return; }
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
            className="border-green-200 text-green-700 hover:bg-green-50"
            title="Contactar por WhatsApp"
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            WhatsApp
          </Button>
          <div className="min-w-[150px] flex-1 max-w-[220px]">
            <Select
              value={client.role === 'admin' ? (client.custom_role || 'equipo_y_acceso') : 'user'}
              onValueChange={(value) => onChangeRole(client, value)}
              disabled={roleUpdatingId === client.id}
            >
              <SelectTrigger className="h-9 bg-white w-full">
                <SelectValue placeholder="Cambiar rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Cliente</SelectItem>
                <SelectItem value="equipo_y_acceso">👑 Administrador</SelectItem>
                {ROLE_OPTIONS.filter((role) => role !== 'super_admin_oculto' && role !== 'equipo_y_acceso').map((role) => (
                  <SelectItem key={role} value={role}>{ROLE_PRESETS[role]?.role_name || role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(client)}
          >
            <Edit2 className="h-4 w-4 mr-1" />
            Editar
          </Button>
          {client.stripe_customer_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDeleteStripeCustomer(client)}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Stripe
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(client)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}