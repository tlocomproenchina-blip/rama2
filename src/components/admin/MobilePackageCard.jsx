import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Eye, Image as ImageIcon, MessageSquare, Plane, Ship, Shield, Undo2, Upload, Flag, FlagOff, Pencil, MessageCircle } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { buildWhatsAppUrl, buildPackageContactMessage } from '@/lib/whatsappContact';
import { toast } from 'sonner';

function MobilePackageCard({
  pkg,
  isSelected,
  onSelect,
  onCreateTicket,
  onReceive,
  onViewImage,
  onEditImage,
  onCancelReception,
  onStatusChange,
  onEditPackage,
}) {
  const gallery = pkg.package_image_urls && pkg.package_image_urls.length > 0
    ? pkg.package_image_urls
    : (pkg.package_image_url ? [pkg.package_image_url] : []);

  return (
    <Card className="overflow-hidden border border-border/70 bg-card/95 shadow-card">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/70 shadow-sm">
              <Checkbox checked={isSelected} onCheckedChange={onSelect} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-mono text-base font-semibold text-foreground">{pkg.tracking_number}</p>
                {pkg.has_insurance && (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    <Shield className="mr-1 h-3 w-3" /> Seguro
                  </Badge>
                )}
                {pkg.reported ? (
                  <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                    <Flag className="mr-1 h-3 w-3" /> Reportado
                  </Badge>
                ) : null}
              </div>
              {pkg.description && (
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{pkg.description}</p>
              )}
            </div>
          </div>
          <StatusBadge status={pkg.status} size="sm" />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="font-mono">{pkg.shipping_mark || '-'}</Badge>
          <Badge variant="outline" className="gap-1">
            {pkg.shipping_type === 'aereo' ? <Plane className="h-3 w-3" /> : <Ship className="h-3 w-3" />}
            {pkg.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo'}
          </Badge>
          {!pkg.reported && <FlagOff className="h-3.5 w-3.5 text-slate-300" />}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Registro</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {new Date(pkg.created_date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Recepción</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {pkg.received_date ? new Date(pkg.received_date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {onEditPackage && (
            <Button size="sm" variant="outline" onClick={onEditPackage} className="w-full justify-start gap-2 border-blue-200 text-blue-600 hover:bg-blue-50">
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onCreateTicket} className="w-full justify-start gap-2">
            <MessageSquare className="h-4 w-4" /> Ticket
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const url = buildWhatsAppUrl(pkg.client_whatsapp, buildPackageContactMessage(pkg, pkg.client_name));
              if (!url) { toast.error('Cliente sin WhatsApp registrado'); return; }
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
            className="w-full justify-start gap-2 border-green-200 text-green-700 hover:bg-green-50"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>

          {pkg.status === 'pre_alerta' && (
            <Button size="sm" onClick={onReceive} className="w-full justify-start bg-blue-600 hover:bg-blue-700">
              <CheckCircle className="mr-2 h-4 w-4" /> Recibir
            </Button>
          )}

          {pkg.product_image_url && (
            <Button size="sm" variant="outline" onClick={() => onViewImage(pkg.product_image_url)} className="w-full justify-start gap-2 text-violet-600 hover:text-violet-700 border-violet-200">
              <Eye className="h-4 w-4" /> Foto Producto
            </Button>
          )}

          {gallery.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {gallery.map((url, idx) => (
                <Button key={idx} size="sm" variant="outline" onClick={() => onViewImage(url)} className="w-full justify-start gap-2">
                  <Eye className="h-4 w-4" /> Foto {idx + 1}
                </Button>
              ))}
            </div>
          )}

          {pkg.status === 'recibido' && gallery.length > 0 && (
            <Button size="sm" variant="outline" onClick={onEditImage} className="w-full justify-start gap-2 text-blue-600 hover:text-blue-700">
              <ImageIcon className="h-4 w-4" /> Fotos
            </Button>
          )}

          {pkg.status === 'recibido' && gallery.length === 0 && (
            <Button size="sm" variant="outline" onClick={onEditImage} className="w-full justify-start gap-2 text-blue-600 hover:text-blue-700">
              <Upload className="h-4 w-4" /> Foto
            </Button>
          )}

          {pkg.status === 'recibido' && (
            <Button size="sm" variant="outline" onClick={onCancelReception} className="w-full justify-start gap-2 border-rose-200 text-rose-600 hover:text-rose-700">
              <Undo2 className="h-4 w-4" /> Cancelar
            </Button>
          )}

          {pkg.status !== 'pre_alerta' && pkg.status !== 'consolidado' && (
            <Select value={pkg.status} onValueChange={onStatusChange}>
              <SelectTrigger className="w-full justify-between">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recibido">Recibido</SelectItem>
                <SelectItem value="en_transito">En Tránsito</SelectItem>
                <SelectItem value="disponible">Disponible</SelectItem>
                <SelectItem value="entregado">Entregado</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default React.memo(MobilePackageCard);