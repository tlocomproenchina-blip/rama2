import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { base44 } from '@/components/api/ApiQueueManager';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';

const formatDate = (value) => value ? new Date(value).toLocaleString('es-VE') : '—';

function addWrappedText(doc, text, x, y, maxWidth, lineHeight = 6) {
  const lines = doc.splitTextToSize(text || '—', maxWidth);
  doc.text(lines, x, y);
  return y + (lines.length * lineHeight);
}

export default function LogisticsExportButton({ rutas = [], cargas = [], latestHealthReport }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);

    const packages = await base44.entities.Package.list('-updated_date', 200);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageHeight = 297;
    const margin = 14;
    const contentWidth = 182;
    let y = 18;

    const ensureSpace = (required = 14) => {
      if (y + required > pageHeight - 16) {
        doc.addPage();
        y = 18;
      }
    };

    doc.setFontSize(18);
    doc.text('Reporte Logístico', margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Generado: ${formatDate(new Date().toISOString())}`, margin, y);
    y += 10;
    doc.setTextColor(20);

    if (latestHealthReport) {
      ensureSpace(28);
      doc.setFontSize(13);
      doc.text('Resumen del diagnóstico', margin, y);
      y += 7;
      doc.setFontSize(10);
      y = addWrappedText(doc, latestHealthReport.summary_text || 'Sin resumen disponible', margin, y, contentWidth);
      y += 3;
      doc.text(`Severidad: ${latestHealthReport.severity || '—'}`, margin, y);
      y += 8;
    }

    ensureSpace(24);
    doc.setFontSize(13);
    doc.text('Rutas', margin, y);
    y += 7;
    doc.setFontSize(10);
    rutas.slice(0, 20).forEach((ruta, index) => {
      ensureSpace(18);
      doc.setFont(undefined, 'bold');
      doc.text(`${index + 1}. ${ruta.codigo_ruta || 'Ruta sin código'}`, margin, y);
      doc.setFont(undefined, 'normal');
      y += 5;
      doc.text(`Trayecto: ${ruta.origen || '—'} → ${ruta.destino || '—'}`, margin, y);
      y += 5;
      doc.text(`Estado: ${String(ruta.estado || '—').replaceAll('_', ' ')}`, margin, y);
      y += 5;
      doc.text(`Chofer: ${ruta.chofer_nombre || 'Sin asignar'} · Vehículo: ${ruta.vehiculo_placa || 'Sin asignar'}`, margin, y);
      y += 7;
    });

    ensureSpace(24);
    doc.setFontSize(13);
    doc.text('Cargas de ruta', margin, y);
    y += 7;
    doc.setFontSize(10);
    cargas.slice(0, 25).forEach((carga, index) => {
      ensureSpace(18);
      doc.setFont(undefined, 'bold');
      doc.text(`${index + 1}. ${carga.tracking_number || carga.descripcion || 'Carga'}`, margin, y);
      doc.setFont(undefined, 'normal');
      y += 5;
      doc.text(`Cliente: ${carga.cliente_email || '—'}`, margin, y);
      y += 5;
      doc.text(`Estado entrega: ${String(carga.estado_entrega || '—').replaceAll('_', ' ')}`, margin, y);
      y += 5;
      doc.text(`Peso: ${Number(carga.peso_kg || 0).toFixed(2)} kg · Volumen: ${Number(carga.volumen_m3 || 0).toFixed(2)} m³`, margin, y);
      y += 7;
    });

    ensureSpace(24);
    doc.setFontSize(13);
    doc.text('Estados de paquetes', margin, y);
    y += 7;
    doc.setFontSize(10);
    packages.slice(0, 30).forEach((pkg, index) => {
      ensureSpace(12);
      doc.text(`${index + 1}. ${pkg.tracking_number || 'Sin tracking'} · ${String(pkg.status || '—').replaceAll('_', ' ')}`, margin, y);
      y += 5;
      doc.setTextColor(90);
      doc.text(`${pkg.client_email || '—'} · ${pkg.shipping_type || '—'}`, margin, y);
      doc.setTextColor(20);
      y += 6;
    });

    doc.save(`reporte-logistico-${new Date().toISOString().slice(0, 10)}.pdf`);
    setLoading(false);
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Exportar PDF
    </Button>
  );
}