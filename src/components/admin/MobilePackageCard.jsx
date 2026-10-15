import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Eye, Image as ImageIcon, MessageSquare, Plane, Ship, Shield, Undo2, Upload, Flag, FlagOff, Pencil, MessageCircle, Camera } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { getDeliveryProofState } from '@/lib/deliveryProofDeadline';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { buildWhatsAppUrl, buildPackageContactMessage } from '@/lib/whatsappContact';
import { toast } from 'sonner';

function formatShortDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
}

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
  onViewSellerPhoto,
}) {
  const gallery = pkg.package_image_urls && pkg.package_image_urls.length > 0
    ? pkg.package_image_urls
    : (pkg.package_image_url ? [pkg.package_image_url] : []);
  const proofState = getDeliveryProofState(pkg);

  return (
    <TooltipProvider delayDuration={100}>
    <Card className="overflow-hidden border border-border/70 bg-card/95 shadow-card">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/70 shadow-sm">
              <Checkbox checked={isSelected} onCheckedChange={onSelect} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="break-all font-mono text-base font-semibold text-foreground">{pkg.tracking_number}</p>
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
              {pkg.shipping_company && (
                <p className="mt-1 text-xs font-medium text-sky-700">🚚 {pkg.shipping_company}</p>
              )}
            </div>
          </div>
          <StatusBadge status={pkg.status} size="sm" />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="font-mono break-all">{pkg.shipping_mark || '-'}</Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center justify-center text-slate-600">
                {pkg.shipping_type === 'aereo' ? <Plane className="h-4 w-4" /> : <Ship className="h-4 w-4" />}
              </span>
            </TooltipTrigger>
            <TooltipContent>{pkg.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`inline-block h-3 w-3 rounded-full ${pkg.risk_category === 'alto_riesgo' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
            </TooltipTrigger>
            <TooltipContent>{pkg.risk_category === 'alto_riesgo' ? 'Alto riesgo' : 'General'}</TooltipContent>
          </Tooltip>
          {!pkg.reported && <FlagOff className="h-3.5 w-3.5 text-slate-300" />}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Registro</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {formatShortDate(pkg.created_date)}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Recepción</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {pkg.received_date ? formatShortDate(pkg.received_date) : '-'}
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

          {pkg.seller_delivery_photo_uri && (
            <Button size="sm" variant="outline" onClick={onViewSellerPhoto} className="w-full justify-start gap-2 text-indigo-600 hover:text-indigo-700 border-indigo-200">
              <Camera className="h-4 w-4" /> Foto del vendedor
            </Button>
          )}

          {proofState.expired && (
            <Badge variant="outline" className="w-full justify-center border-amber-300 bg-amber-50 text-amber-800">
              Fuera de plazo entrega
            </Badge>
          )}
          {proofState.exception && proofState.pastDeadline && (
            <Badge variant="outline" className="w-full justify-center border-emerald-300 bg-emerald-50 text-emerald-700">
              Excepción entrega
            </Badge>
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
    </TooltipProvider>
  );
}

export default React.memo(MobilePackageCard);