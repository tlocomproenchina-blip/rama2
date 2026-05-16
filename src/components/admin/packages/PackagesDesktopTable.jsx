import React from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from '@/components/StatusBadge';
import {
  Package,
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

export default function PackagesDesktopTable({
  packages,
  selectedPackages,
  onSelectAll,
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
  return (
    <Card className="hidden 2xl:block border-0 shadow-lg overflow-hidden">
      <div className="overflow-x-visible">
        <table className="w-full table-auto">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left pl-3 pr-2 py-3 font-medium text-slate-600">
                <Checkbox
                  checked={selectedPackages.length === packages.length && packages.length > 0}
                  onCheckedChange={onSelectAll}
                />
              </th>
              <th className="text-left p-3 font-medium text-slate-600 w-[17%]">Tracking</th>
              <th className="text-left p-3 font-medium text-slate-600 w-[11%]">Shipping Mark</th>
              <th className="text-left p-3 font-medium text-slate-600 w-[7%]">Tipo</th>
              <th className="text-left p-3 font-medium text-slate-600 w-[7%]">Carga</th>
              <th className="text-left p-3 font-medium text-slate-600 w-[5%]">Bultos</th>
              <th className="text-left p-3 font-medium text-slate-600 w-[6%]">FOB</th>
              <th className="text-left p-3 font-medium text-slate-600 w-[7%]">Estado</th>
              <th className="text-left p-3 font-medium text-slate-600 w-[9%]">Registro</th>
              <th className="text-left p-3 font-medium text-slate-600 w-[9%]">Recepción</th>
              <th className="text-left pl-2 pr-3 py-3 font-medium text-slate-600 w-[18%]">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {packages.map((pkg) => {
              const imageUrls = pkg.package_image_urls && pkg.package_image_urls.length > 0
                ? pkg.package_image_urls
                : (pkg.package_image_url ? [pkg.package_image_url] : []);
              return (
                <tr key={pkg.id} className="hover:bg-slate-50 transition-colors">
                  <td className="pl-3 pr-2 py-3">
                    <Checkbox
                      checked={selectedPackages.includes(pkg.id)}
                      onCheckedChange={(checked) => onSelectPackage(pkg.id, checked)}
                    />
                  </td>
                  <td className="pl-3 pr-2 py-3 align-top">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-medium text-slate-800 whitespace-nowrap truncate max-w-[18ch]">{pkg.tracking_number}</span>
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
                  <td className="p-3 align-top font-mono text-slate-600 whitespace-nowrap truncate max-w-[14ch]">{pkg.shipping_mark || '-'}</td>
                  <td className="pl-3 pr-2 py-3">
                    <div className="flex items-center gap-2 text-slate-600">
                      {pkg.shipping_type === 'aereo'
                        ? <><Plane className="h-4 w-4" /> Aéreo</>
                        : <><Ship className="h-4 w-4" /> Marítimo</>
                      }
                    </div>
                  </td>
                  <td className="pl-3 pr-2 py-3">
                    <Badge variant="outline" className={pkg.risk_category === 'alto_riesgo' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}>
                      {pkg.risk_category === 'alto_riesgo' ? 'Alto riesgo' : 'General'}
                    </Badge>
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
                  <td className="p-4 text-slate-600 text-xs">
                    <div>{new Date(pkg.created_date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <div className="text-[11px] text-slate-400">{new Date(pkg.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="p-4 text-slate-600 text-xs">
                    {pkg.received_date ? (
                      <>
                        <div>{new Date(pkg.received_date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        <div className="text-[11px] text-slate-400">{new Date(pkg.received_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </>
                    ) : (
                      <div>-</div>
                    )}
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
              );
            })}
          </tbody>
        </table>
      </div>

      {packages.length === 0 && (
        <div className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500">No se encontraron paquetes</p>
        </div>
      )}
    </Card>
  );
}