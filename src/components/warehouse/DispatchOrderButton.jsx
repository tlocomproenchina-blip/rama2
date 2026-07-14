import React, { useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DispatchOrderButton({ group, email }) {
  const [generating, setGenerating] = useState(false);

  const generateOrder = async () => {
    setGenerating(true);
    try {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
      const appName = configs?.[0]?.app_name || 'TLEC CARGO';

      const client = group.items.find((i) => i.client)?.client || {};
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const now = new Date();
      const orderNumber = `OD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

      // Encabezado
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, 210, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(appName, 14, 12);
      doc.setFontSize(12);
      doc.text('ORDEN DE DESPACHO', 14, 21);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`N° ${orderNumber}`, 196, 12, { align: 'right' });
      doc.text(now.toLocaleString('es-VE'), 196, 21, { align: 'right' });

      // Datos del cliente
      doc.setTextColor(30, 41, 59);
      let y = 40;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('DATOS DEL CLIENTE', 14, y);
      doc.setDrawColor(203, 213, 225);
      doc.line(14, y + 2, 196, y + 2);
      y += 9;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      const rows = [
        ['Nombre:', client.full_name || group.name || email],
        ['Cédula:', client.cedula || '—'],
        ['Teléfono:', client.whatsapp || '—'],
        ['Dirección:', client.address || '—'],
        ['Ciudad / Estado:', [client.city, client.state].filter(Boolean).join(' / ') || '—'],
        ['Shipping Mark:', group.mark || client.shipping_mark || '—'],
        ['Email:', email]
      ];
      rows.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label, 14, y);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(String(value), 140);
        doc.text(lines, 52, y);
        y += lines.length * 5 + 2;
      });

      // Trackings
      y += 6;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`PAQUETES DESPACHADOS (${group.items.length})`, 14, y);
      doc.line(14, y + 2, 196, y + 2);
      y += 9;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('#', 14, y);
      doc.text('Tracking', 24, y);
      doc.text('Descripción', 110, y);
      y += 6;
      doc.setFont('helvetica', 'normal');

      group.items.forEach((item, idx) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(String(idx + 1), 14, y);
        doc.text(String(item.package?.tracking_number || ''), 24, y);
        const desc = doc.splitTextToSize(String(item.package?.description || ''), 84);
        doc.text(desc, 110, y);
        y += Math.max(desc.length * 5, 6);
      });

      // Firmas
      if (y > 245) {
        doc.addPage();
        y = 30;
      }
      y += 20;
      doc.line(20, y, 85, y);
      doc.line(125, y, 190, y);
      doc.setFontSize(9);
      doc.text('Entregado por (Almacén)', 52.5, y + 5, { align: 'center' });
      doc.text('Recibido por (Cliente / Transporte)', 157.5, y + 5, { align: 'center' });

      doc.save(`orden-despacho-${(group.mark || email).replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`);
      toast.success('Orden de despacho generada');
    } catch (error) {
      console.error('Error generando orden:', error);
      toast.error('Error al generar la orden de despacho');
    }
    setGenerating(false);
  };

  return (
    <Button variant="outline" size="sm" onClick={generateOrder} disabled={generating}>
      {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
      Orden de Despacho
    </Button>
  );
}