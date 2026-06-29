import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from '@/components/StatusBadge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Plane,
  Ship,
  Shield,
  Flag,
  FlagOff,
  Eye,
  Image as ImageIcon,
  Upload,
  Undo2,
  CheckCircle,
  MessageSquare,
  Pencil,
  MessageCircle,
} from 'lucide-react';
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

function PackagesTableRow({
  pkg,
  isSelected,
  onSelectPackage,
  onCreateTicket,
  onOpenPreAlertEditor,
  onReceive,
  onViewImage,
  onEditImage,
  onCancelReception,
  onStatusChange,
  onEditPackage,
}) {
  const imageUrls = pkg.package_image_urls && pkg.package_image_urls.length > 0
    ? pkg.package_image_urls
    : (pkg.package_image_url ? [pkg.package_image_url] : []);

  return (
    <TooltipProvider delayDuration={100}>
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="pl-3 pr-2 py-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelectPackage(pkg.id, checked)}
        />
      </td>
      <td className="pl-3 pr-2 py-3 align-top">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono font-medium text-slate-800 break-all">{pkg.tracking_number}</span>
            {pkg.has_insurance && (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                <Shield className="h-3 w-3" />
              </Badge>
            )}
            {pkg.reported ? (
              <Flag className="h-4 w-4 text-green-600" title="Reportado" />
            ) : (
              <FlagOff className="h-4 w-4 text-slate-300" title="No reportado" />
            )}
          </div>
          <div className="text-xs text-slate-500">
            {pkg.description || 'Sin descripción'}
          </div>
        </div>
      </td>
      <td className="p-3 align-top font-mono text-slate-600 break-all">{pkg.shipping_mark || '-'}</td>
      <td className="pl-3 pr-2 py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center justify-center text-slate-600">
              {pkg.shipping_type === 'aereo'
                ? <Plane className="h-5 w-5" />
                : <Ship className="h-5 w-5" />}
            </span>
          </TooltipTrigger>
          <TooltipContent>{pkg.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo'}</TooltipContent>
        </Tooltip>
      </td>
      <td className="pl-3 pr-2 py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-block h-3 w-3 rounded-full ${pkg.risk_category === 'alto_riesgo' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
          </TooltipTrigger>
          <TooltipContent>{pkg.risk_category === 'alto_riesgo' ? 'Alto riesgo' : 'General'}</TooltipContent>
        </Tooltip>
      </td>
      <td className="pl-3 pr-2 py-3 text-slate-700 font-medium">
        {pkg.package_count || '-'}
      </td>
      <td className="pl-3 pr-2 py-3 text-slate-700 text-xs whitespace-nowrap">
        {Number(pkg.fob_value) > 0
          ? <span className="font-semibold text-emerald-700">${Number(pkg.fob_value).toFixed(2)}</span>
          : <span className="text-slate-300">-</span>}
      </td>
      <td className="pl-3 pr-2 py-3">
        <StatusBadge status={pkg.status} size="sm" />
      </td>
      <td className="p-4 text-slate-600 text-xs whitespace-nowrap">
        <div>{formatShortDate(pkg.created_date)}</div>
      </td>
      <td className="p-4 text-slate-600 text-xs whitespace-nowrap">
        <div>{pkg.received_date ? formatShortDate(pkg.received_date) : '-'}</div>
      </td>
      <td className="pl-2 pr-3 py-3 align-top">
        <div className="flex min-w-0 w-full flex-col items-stretch gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEditPackage?.(pkg)}
            className="w-full min-w-0 justify-start gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCreateTicket(pkg)}
            className="w-full min-w-0 justify-start gap-1"
          >
            <MessageSquare className="h-4 w-4" />
            Ticket
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const url = buildWhatsAppUrl(pkg.client_whatsapp, buildPackageContactMessage(pkg, pkg.client_name));
              if (!url) { toast.error('Cliente sin WhatsApp registrado'); return; }
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
            className="w-full min-w-0 justify-start gap-1 border-green-200 text-green-700 hover:bg-green-50"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
          {pkg.status === 'pre_alerta' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenPreAlertEditor(pkg)}
                className="w-full min-w-0 justify-start"
              >
                <Shield className="h-4 w-4 mr-1" />
                Seguro / Factura
              </Button>
              <Button
                size="sm"
                onClick={() => onReceive(pkg)}
                className="w-full min-w-0 justify-start bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Recibir
              </Button>
            </>
          )}
          {pkg.product_image_url && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewImage(pkg.product_image_url)}
              className="w-full justify-start text-violet-600 hover:text-violet-700 border-violet-200"
            >
              <Eye className="h-4 w-4" /> Producto
            </Button>
          )}
          {imageUrls.length > 0 && (
            <>
              <div className="flex flex-wrap gap-1">
                {imageUrls.map((url, idx) => (
                  <Button
                    key={idx}
                    size="sm"
                    variant="outline"
                    onClick={() => onViewImage(url)}
                    className="w-full min-w-0 justify-start"
                  >
                    <Eye className="h-4 w-4" /> {idx + 1}
                  </Button>
                ))}
              </div>
              {pkg.status === 'recibido' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEditImage(pkg)}
                  className="w-full justify-start text-blue-600 hover:text-blue-700"
                >
                  <ImageIcon className="h-4 w-4" /> Fotos
                </Button>
              )}
            </>
          )}
          {imageUrls.length === 0 && pkg.status === 'recibido' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEditImage(pkg)}
              className="w-full justify-start text-blue-600 hover:text-blue-700"
            >
              <Upload className="h-4 w-4 mr-1" />
              Foto
            </Button>
          )}
          {pkg.status === 'recibido' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCancelReception(pkg)}
              className="w-full min-w-0 justify-start gap-1 h-8 px-2 text-xs text-rose-600 hover:text-rose-700 border-rose-200"
            >
              <Undo2 className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
          )}
          {pkg.status !== 'pre_alerta' && pkg.status !== 'consolidado' && (
            <Select
              value={pkg.status}
              onValueChange={(val) => onStatusChange(pkg, val)}
            >
              <SelectTrigger className="w-full h-8 px-2 justify-between gap-1 text-xs [&>span]:leading-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recibido">Recibido</SelectItem>
                <SelectItem value="rechazado">Rechazado</SelectItem>
                <SelectItem value="en_transito">En Tránsito</SelectItem>
                <SelectItem value="disponible">Disponible</SelectItem>
                <SelectItem value="entregado">Entregado</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </td>
    </tr>
    </TooltipProvider>
  );
}

export default React.memo(PackagesTableRow);