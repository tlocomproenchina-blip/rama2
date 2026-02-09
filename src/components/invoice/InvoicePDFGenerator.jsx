import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

export default function InvoicePDFGenerator({ invoice }) {
  const [generating, setGenerating] = useState(false);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (configs.length > 0) {
        setConfig(configs[0]);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      let yPos = 20;

      // Company Logo & Header
      if (config?.invoice_logo_url) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = config.invoice_logo_url;
          });
          
          // Logo cuadrado 1:1 - 30x30
          doc.addImage(img, 'PNG', 15, yPos, 30, 30);
        } catch (error) {
          console.error('Error loading logo:', error);
        }
      }

      // Company name next to logo
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(config?.invoice_company_name || 'TLEC CARGO LTD', 50, yPos + 10);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(config?.invoice_company_tagline || 'Sistema de Envios Internacionales', 50, yPos + 18);

      yPos += 40;

      // Invoice title
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('FACTURA', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;

      // Invoice details
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Factura No: ${invoice.invoice_number}`, 15, yPos);
      doc.text(`Fecha: ${new Date(invoice.invoice_date).toLocaleDateString()}`, pageWidth - 15, yPos, { align: 'right' });
      yPos += 7;
      doc.text(`Tracking: ${invoice.consolidation_tracking || 'N/A'}`, 15, yPos);
      doc.text(`Vencimiento: ${new Date(invoice.due_date).toLocaleDateString()}`, pageWidth - 15, yPos, { align: 'right' });
      yPos += 15;

      // Client info
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Cliente:', 15, yPos);
      yPos += 7;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const notesLines = (invoice.notes || '').split('\n');
      const clientInfoLines = notesLines.slice(0, 3); // First 3 lines are client info
      clientInfoLines.forEach(line => {
        doc.text(line, 15, yPos);
        yPos += 5;
      });
      yPos += 5;

      // Get consolidation to fetch packages
      let packages = [];
      let hasInsurance = false;
      if (invoice.consolidation_id) {
        try {
          const consolidations = await base44.entities.Consolidation.filter({ id: invoice.consolidation_id });
          if (consolidations.length > 0) {
            const consolidation = consolidations[0];
            if (consolidation.package_ids && consolidation.package_ids.length > 0) {
              const allPackages = await base44.entities.Package.list();
              packages = allPackages.filter(p => consolidation.package_ids.includes(p.id));
              hasInsurance = packages.some(p => p.has_insurance);
            }
          }
        } catch (error) {
          console.error('Error loading packages:', error);
        }
      }

      // Display packages in table format
      if (packages.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Paquetes: ${packages.length}`, 15, yPos);
        yPos += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('Trackings:', 15, yPos);
        yPos += 5;

        // Create 3-column layout for tracking numbers
        const startX = 15;
        const colWidth = (pageWidth - 30) / 3;
        let currentCol = 0;
        let currentRow = 0;

        packages.forEach((pkg, index) => {
          const xPos = startX + (currentCol * colWidth);
          const yPosition = yPos + (currentRow * 5);

          // Check if we need a new page
          if (yPosition > doc.internal.pageSize.height - 40) {
            doc.addPage();
            yPos = 20;
            currentRow = 0;
          }

          const insuranceText = pkg.has_insurance ? '' : 'Sin seguro';
          doc.text(pkg.tracking_number, xPos, yPos + (currentRow * 5));
          if (insuranceText) {
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(insuranceText, xPos + 50, yPos + (currentRow * 5));
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);
          }

          currentCol++;
          if (currentCol >= 3) {
            currentCol = 0;
            currentRow++;
          }
        });

        yPos += Math.ceil(packages.length / 3) * 5 + 5;
      }

      yPos += 5;

      // Items table header
      doc.setFillColor(28, 63, 130);
      doc.rect(15, yPos, pageWidth - 30, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('Descripción', 20, yPos + 7);
      doc.text('Cant.', pageWidth - 80, yPos + 7);
      doc.text('Precio Unit.', pageWidth - 60, yPos + 7);
      doc.text('Total', pageWidth - 30, yPos + 7, { align: 'right' });
      yPos += 15;

      // Items
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      
      (invoice.items || []).forEach(item => {
        // Main item line
        doc.text(item.description, 20, yPos);
        doc.text(item.quantity.toString(), pageWidth - 80, yPos);
        doc.text(`$${item.unit_price.toFixed(2)}`, pageWidth - 60, yPos);
        doc.text(`$${item.total.toFixed(2)}`, pageWidth - 30, yPos, { align: 'right' });
        yPos += 6;

        // Details if available
        if (item.details) {
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          
          if (item.details.tracking) {
            doc.text(`  Tracking: ${item.details.tracking}`, 20, yPos);
            yPos += 4;
          }
          if (item.details.dimensions) {
            doc.text(`  Dimensiones: ${item.details.dimensions}`, 20, yPos);
            yPos += 4;
          }
          if (item.details.weight) {
            doc.text(`  Peso: ${item.details.weight} | Peso facturable: ${item.details.billable_weight}`, 20, yPos);
            yPos += 4;
          }
          if (item.details.package_count) {
            doc.text(`  Paquetes incluidos: ${item.details.package_count}`, 20, yPos);
            yPos += 4;
          }

          if (item.details.fob_value) {
            doc.text(`  Valor FOB: $${item.details.fob_value.toFixed(2)}`, 20, yPos);
            yPos += 4;
          }
          
          doc.setFontSize(10);
          doc.setTextColor(0, 0, 0);
        }
        
        yPos += 5;
      });

      // Totals
      yPos += 10;
      doc.line(15, yPos, pageWidth - 15, yPos);
      yPos += 10;

      const totalsX = pageWidth - 70;
      doc.setFont('helvetica', 'normal');
      doc.text('Subtotal:', totalsX, yPos);
      doc.text(`$${invoice.subtotal.toFixed(2)}`, pageWidth - 20, yPos, { align: 'right' });
      yPos += 7;

      if (invoice.tax > 0) {
        doc.text('Impuestos:', totalsX, yPos);
        doc.text(`$${invoice.tax.toFixed(2)}`, pageWidth - 20, yPos, { align: 'right' });
        yPos += 7;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('TOTAL:', totalsX, yPos);
      doc.text(`$${invoice.total.toFixed(2)}`, pageWidth - 20, yPos, { align: 'right' });

      // Status
      yPos += 15;
      doc.setFontSize(10);
      const statusText = invoice.status === 'pagada' ? 'PAGADA' : 'PENDIENTE';
      const statusColor = invoice.status === 'pagada' ? [34, 197, 94] : [234, 179, 8];
      doc.setTextColor(...statusColor);
      doc.text(`Estado: ${statusText}`, 15, yPos);

      // Footer
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      doc.text('Gracias por confiar en nosotros', pageWidth / 2, doc.internal.pageSize.height - 20, { align: 'center' });

      // Save
      doc.save(`factura-${invoice.invoice_number}.pdf`);
      toast.success('Factura descargada exitosamente');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar PDF');
    }
    setGenerating(false);
  };

  return (
    <Button
      onClick={generatePDF}
      disabled={generating}
      variant="outline"
      size="sm"
    >
      {generating ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      Descargar PDF
    </Button>
  );
}