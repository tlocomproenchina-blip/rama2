import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import {
  Mail, MapPin, Phone, Tag, CheckCircle, Clock, Package, CalendarDays,
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
  return (
    <Card className={`border-0 shadow-md hover:shadow-lg transition-shadow ${flagAmber ? 'border-l-4 border-l-amber-400' : ''}`}>
      <CardContent className="p-4 lg:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Avatar & Name */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
              {(client.first_name?.[0] || client.email?.[0] || '?').toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-800 break-words">
                {client.first_name && client.last_name
                  ? `${client.first_name} ${client.last_name}`
                  : client.email}
              </h3>
              <div className="flex items-center gap-2 text-sm text-slate-500 mt-1 min-w-0">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="break-all">{client.email}</span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="outline" className="bg-slate-50">
              Rol: {client.role === 'admin' ? (
                <span className="inline-flex items-center gap-1">
                  <Crown className="h-3 w-3 text-amber-500" />
                  {ROLE_PRESETS[client.custom_role]?.role_name || 'Administrador'}
                </span>
              ) : 'Cliente'}
            </Badge>
            {client.city && (
              <Badge variant="outline" className="bg-slate-50">
                <MapPin className="h-3 w-3 mr-1" />
                {client.city}
              </Badge>
            )}
            {client.whatsapp && (
              <Badge variant="outline" className="bg-slate-50">
                <Phone className="h-3 w-3 mr-1" />
                {client.whatsapp}
              </Badge>
            )}
            {hasValidShippingMark(client) ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <Tag className="h-3 w-3 mr-1" />
                {client.shipping_mark}
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                <Clock className="h-3 w-3 mr-1" />
                Sin Shipping Mark
              </Badge>
            )}
            {client.created_date && (
              <Badge variant="outline" className="bg-slate-50">
                <CalendarDays className="h-3 w-3 mr-1" />
                {format(new Date(client.created_date), 'dd MMM yyyy', { locale: es })}
              </Badge>
            )}
            <Badge variant="outline">
              <Package className="h-3 w-3 mr-1" />
              {packagesCount[client.email] || 0} paquetes
            </Badge>
            {client.is_active === false && (
              <Badge className="bg-red-100 text-red-700 border-red-200">Inactivo</Badge>
            )}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex items-stretch gap-2 w-full">
            <div className="flex items-center gap-2 pb-2 sm:pb-0 sm:pr-3 sm:border-r border-b sm:border-b-0 border-slate-200">
              <span className="text-xs text-slate-600">Activo</span>
              <Switch
                checked={client.is_active !== false}
                onCheckedChange={(checked) => onToggleActive(client, checked)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={(e) => { e.stopPropagation(); onCopyInfo(client); }}
              title="Copiar información"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddPackage(client)}
              className="w-full sm:w-auto bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              <Plus className="h-4 w-4 mr-1" />
              Paquete
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
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
              className="w-full sm:w-auto border-green-200 text-green-700 hover:bg-green-50"
              title="Contactar por WhatsApp"
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              WhatsApp
            </Button>
            <div className="w-full sm:w-auto min-w-[180px]">
              <Select
                value={client.role === 'admin' ? (client.custom_role || 'equipo_y_acceso') : 'user'}
                onValueChange={(value) => onChangeRole(client, value)}
                disabled={roleUpdatingId === client.id}
              >
                <SelectTrigger className="h-9 bg-white">
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
              className="w-full sm:w-auto"
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
                className="w-full sm:w-auto text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="h-4 w-4 mr-1" /> Stripe
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(client)}
              className="w-full sm:w-auto text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}