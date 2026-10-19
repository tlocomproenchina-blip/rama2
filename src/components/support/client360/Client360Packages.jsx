import React, { useState } from 'react';
import { Package, ChevronDown, ChevronRight, Camera, ShieldCheck, Copy, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { base44 } from '@/components/api/ApiQueueManager';
import { uploadImageNoCredits } from '@/lib/imgbbUpload';
import { sendInAppNotification, sendNotification } from '@/components/NotificationUtils';
import { useAuth } from '@/lib/AuthContext';
import ReceivePackageInlineModal from '@/components/client-analytics/ReceivePackageInlineModal';
import Client360Section from './Client360Section';
import Client360PackageDetail from './Client360PackageDetail';

const STATUS = {
  pre_alerta: { label: 'Pre-Alerta', cls: 'bg-amber-100 text-amber-700' },
  recibido: { label: 'Recibido', cls: 'bg-blue-100 text-blue-700' },
  rechazado: { label: 'Rechazado', cls: 'bg-red-100 text-red-700' },
  consolidado: { label: 'Consolidado', cls: 'bg-purple-100 text-purple-700' },
  en_transito: { label: 'En Tránsito', cls: 'bg-cyan-100 text-cyan-700' },
  disponible: { label: 'Disponible', cls: 'bg-green-100 text-green-700' },
  despachado: { label: 'Despachado', cls: 'bg-indigo-100 text-indigo-700' },
  entregado: { label: 'Entregado', cls: 'bg-slate-100 text-slate-700' }
};

export default function Client360Packages({ packages, onChanged }) {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState(null);
  const [receiveTarget, setReceiveTarget] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [processing, setProcessing] = useState(false);

  const insured = packages.filter((p) => p.has_insurance).length;

  const copyTracking = async (value) => {
    try {
      await navigator.clipboard.writeText(String(value || ''));
      toast.success('Tracking copiado');
    } catch {
      toast.error('No se pudo copiar el tracking');
    }
  };

  const openReceive = (pkg) => {
    setImageFiles([]);
    setReceiveTarget(pkg);
  };

  const closeReceive = () => {
    setReceiveTarget(null);
    setImageFiles([]);
  };

  const handleReceive = async (nextStatus = 'recibido') => {
    if (!receiveTarget) return;
    setProcessing(true);

    try {
      let imageUrls = Array.isArray(receiveTarget.package_image_urls)
        ? [...receiveTarget.package_image_urls]
        : (receiveTarget.package_image_url ? [receiveTarget.package_image_url] : []);

      if (imageFiles.length > 0) {
        const uploaded = [];
        for (const f of imageFiles.slice(0, 3)) {
          uploaded.push(await uploadImageNoCredits(f));
        }
        imageUrls = uploaded;
      }

      await base44.entities.Package.update(receiveTarget.id, {
        status: nextStatus,
        package_image_urls: (imageUrls || []).slice(0, 3),
        package_image_url: imageUrls?.[0] || null,
        received_date: new Date().toISOString(),
        received_by: user?.email || receiveTarget.received_by || 'admin',
      });

      if (nextStatus === 'rechazado') {
        sendNotification({
          to: receiveTarget.client_email,
          subject: '⛔ Tu paquete fue rechazado',
          body: `Tu paquete con tracking ${receiveTarget.tracking_number} fue recibido en nuestro almacén, pero fue rechazado y no podrá exportarse. Hemos guardado evidencia fotográfica de la recepción. Si deseas enviarlo a otra dirección, por favor comunícate con soporte para ayudarte con el proceso.`,
          type: 'package',
          icon: 'alert',
          referenceId: receiveTarget.id
        });
      } else {
        sendInAppNotification({
          user_email: receiveTarget.client_email,
          title: '📦 Tu paquete ha sido recibido',
          message: `Tu paquete con tracking ${receiveTarget.tracking_number} ha sido recibido en nuestro almacén.`,
          type: 'package',
          icon: 'check',
          reference_id: receiveTarget.id,
          entity_type: 'Package',
          priority: 'high'
        });
      }

      toast.success(nextStatus === 'rechazado' ? 'Paquete marcado como rechazado' : 'Paquete marcado como recibido');
      closeReceive();
      onChanged?.();
    } catch (error) {
      console.error('Error receiving package:', error);
      toast.error(error?.message || 'Error al procesar la recepción');
    }
    setProcessing(false);
  };

  return (
    <Client360Section icon={Package} title="Paquetes / Pre-alertas" count={packages.length}>
      {packages.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
          <span>{insured} con seguro · {packages.length - insured} sin seguro</span>
        </div>
      )}
      {packages.map((p) => {
        const isOpen = expandedId === p.id;
        const hasPhotos = (p.package_image_urls || []).length > 0 || p.package_image_url || p.product_image_url;
        const toggle = () => setExpandedId(isOpen ? null : p.id);
        return (
          <div key={p.id}>
            <div className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
              <button type="button" onClick={toggle} aria-label={isOpen ? 'Ocultar detalle' : 'Ver detalle'} className="flex-shrink-0 text-slate-400">
                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="min-w-0 truncate select-text font-mono text-xs text-slate-800">{p.tracking_number || '—'}</span>
                  <button
                    type="button"
                    onClick={() => copyTracking(p.tracking_number)}
                    title="Copiar tracking"
                    aria-label="Copiar tracking"
                    className="flex-shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <button type="button" onClick={toggle} className="block max-w-full text-left">
                  <span className="block truncate text-xs text-slate-500">{p.description}</span>
                </button>
              </div>
              {hasPhotos && <Camera className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />}
              {p.has_insurance && <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-green-600" />}
              <span className="whitespace-nowrap text-[10px] text-slate-400">
                {p.created_date ? new Date(p.created_date).toLocaleDateString('es-VE') : ''}
              </span>
              <Badge className={`text-[10px] ${STATUS[p.status]?.cls || 'bg-slate-100 text-slate-600'}`}>
                {STATUS[p.status]?.label || p.status}
              </Badge>
              {p.status === 'pre_alerta' && (
                <button
                  type="button"
                  onClick={() => openReceive(p)}
                  className="flex flex-shrink-0 items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-blue-700"
                >
                  <CheckCircle2 className="h-3 w-3" /> Recibir
                </button>
              )}
            </div>
            {isOpen && <Client360PackageDetail pkg={p} />}
          </div>
        );
      })}

      <ReceivePackageInlineModal
        pkg={receiveTarget}
        imageFiles={imageFiles}
        setImageFiles={setImageFiles}
        processing={processing}
        onClose={closeReceive}
        onConfirm={handleReceive}
      />
    </Client360Section>
  );
}