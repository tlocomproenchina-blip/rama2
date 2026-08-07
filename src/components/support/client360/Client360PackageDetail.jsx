import React from 'react';
import { Badge } from '@/components/ui/badge';
import useImageViewer from '@/hooks/useImageViewer';

const Row = ({ label, value }) => (
  value !== null && value !== undefined && value !== '' ? (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-slate-500 whitespace-nowrap">{label}</span>
      <span className="text-slate-800 font-medium text-right break-all">{value}</span>
    </div>
  ) : null
);

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-VE') : null;

export default function Client360PackageDetail({ pkg }) {
  const imageViewer = useImageViewer();
  const images = [
    ...(pkg.package_image_urls || []),
    ...(pkg.package_image_url && !(pkg.package_image_urls || []).includes(pkg.package_image_url) ? [pkg.package_image_url] : [])
  ];

  return (
    <div className="bg-slate-50 border-t border-slate-100 px-3 py-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        <Row label="Tipo de envío" value={pkg.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo'} />
        <Row label="Tipo de carga" value={pkg.risk_category === 'alto_riesgo' ? 'Alto riesgo' : 'General'} />
        <Row label="Bultos" value={pkg.package_count} />
        <Row label="Seguro" value={pkg.has_insurance ? '✅ Sí' : '❌ No'} />
        <Row label="Valor FOB" value={pkg.fob_value != null ? `$${Number(pkg.fob_value).toFixed(2)}` : null} />
        <Row label="Compañía de transporte" value={pkg.shipping_company} />
        <Row label="Peso real" value={pkg.actual_weight_kg != null ? `${pkg.actual_weight_kg} kg` : null} />
        <Row label="Medidas (L×A×H)" value={pkg.actual_length_cm ? `${pkg.actual_length_cm}×${pkg.actual_width_cm}×${pkg.actual_height_cm} cm` : null} />
        <Row label="CBM real" value={pkg.actual_cbm != null ? Number(pkg.actual_cbm).toFixed(4) : null} />
        <Row label="Almacén" value={pkg.warehouse_name} />
        <Row label="Ubicación" value={pkg.warehouse_location_code || pkg.warehouse_location_name} />
        <Row label="Fecha entrega del vendedor" value={fmtDate(pkg.seller_delivery_date)} />
        <Row label="Recibido" value={fmtDate(pkg.received_date)} />
        <Row label="Recibido por" value={pkg.received_by} />
        <Row label="Despachado" value={fmtDate(pkg.dispatched_date)} />
        <Row label="Despachado por" value={pkg.dispatched_by} />
        <Row label="Dirección de entrega" value={pkg.shipping_address} />
        <Row label="Notas de recepción" value={pkg.reception_notes} />
      </div>

      {(images.length > 0 || pkg.product_image_url) && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1.5">Fotos</p>
          <div className="flex flex-wrap gap-2">
            {pkg.product_image_url && (
              <button type="button" onClick={() => imageViewer.open(pkg.product_image_url)} className="block cursor-pointer">
                <img src={pkg.product_image_url} alt="Producto (pre-alerta)" className="h-20 w-20 rounded-lg object-cover border border-slate-200" />
                <p className="text-[10px] text-slate-400 text-center mt-0.5">Producto</p>
              </button>
            )}
            {images.map((url, i) => (
              <button key={i} type="button" onClick={() => imageViewer.open(url)} className="block cursor-pointer">
                <img src={url} alt={`Paquete ${i + 1}`} className="h-20 w-20 rounded-lg object-cover border border-slate-200" />
                <p className="text-[10px] text-slate-400 text-center mt-0.5">Recepción</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {pkg.invoice_url && (
        <a href={pkg.invoice_url} target="_blank" rel="noopener noreferrer">
          <Badge variant="outline" className="cursor-pointer bg-blue-50 text-blue-700 border-blue-200">📄 Ver factura / documento adjunto</Badge>
        </a>
      )}
      {imageViewer.modal}
    </div>
  );
}