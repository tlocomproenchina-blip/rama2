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
    try {
      // Preferir factura de Stripe (PDF directo) cuando exista
      if (invoice?.stripe_invoice_pdf_url) {
        window.open(invoice.stripe_invoice_pdf_url, '_blank');
        return;
      }
      if (invoice?.stripe_hosted_invoice_url) {
        window.open(invoice.stripe_hosted_invoice_url, '_blank');
        return;
      }
      setGenerating(true);
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

      // Get consolidation and client data to fetch packages
      let packages = [];
      let consolidation = null;
      let clientData = null;
      if (invoice.consolidation_id) {
        try {
          const consolidations = await base44.entities.Consolidation.filter({ id: invoice.consolidation_id });
          if (consolidations.length > 0) {
            consolidation = consolidations[0];
            if (consolidation.package_ids && consolidation.package_ids.length > 0) {
              const allPackages = await base44.entities.Package.list();
              packages = allPackages.filter(p => consolidation.package_ids.includes(p.id));
            }

            // Fetch client user data
            const users = await base44.entities.User.list();
            clientData = users.find(u => u.email === consolidation.client_email);
          }
        } catch (error) {
          console.error('Error loading packages:', error);
        }
      }

      // Client info
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Cliente:', 15, yPos);
      yPos += 7;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      // Display client information
      if (clientData) {
        const fullName = `${clientData.full_name || ''}`.trim();
        doc.text(fullName, 15, yPos);
        yPos += 5;

        if (consolidation?.shipping_mark) {
          doc.text(`Envío: ${consolidation.shipping_mark}`, 15, yPos);
          yPos += 5;
        }

        if (clientData.whatsapp) {
          doc.text(`WhatsApp: ${clientData.whatsapp}`, 15, yPos);
          yPos += 5;
        }
      } else {
        // Fallback if client data not available
        doc.text(invoice.client_email || 'N/A', 15, yPos);
        yPos += 5;
      }
      yPos += 2;

      // Display packages in table format (3 columns: Tracking | Descripción | FOB) - Only if space available
      if (packages.length > 0 && yPos < doc.internal.pageSize.height - 60) {
       // Calculate total FOB for insured packages
       const totalFOB = packages.filter(p => p.has_insurance).reduce((sum, p) => sum + (p.fob_value || 0), 0);

       // Table layout: Tracking (60) | Description (80) | FOB/Status (45)
       const col1X = 20; // Tracking
       const col2X = 80; // Description (duplicate tracking)
       const col3X = 160; // FOB or "Sin seguro"

       packages.forEach((pkg, index) => {
         // Check if we need a new page
         if (yPos > doc.internal.pageSize.height - 25) {
           doc.addPage();
           yPos = 20;
         }

         doc.setFontSize(9);
         doc.setFont('helvetica', 'normal');
         doc.setTextColor(0, 0, 0);

         // Column 1: Tracking Number
         doc.text(pkg.tracking_number, col1X, yPos);

         // Column 2: Tracking Number (duplicate)
         doc.text(pkg.tracking_number, col2X, yPos);

         // Column 3: FOB or "Sin seguro"
         if (pkg.has_insurance && pkg.fob_value) {
           doc.setTextColor(0, 0, 0);
           doc.text(`FOB: $${pkg.fob_value.toFixed(2)}`, col3X, yPos);
         } else {
           doc.setFontSize(8);
           doc.setTextColor(100, 100, 100);
           doc.text('Sin seguro', col3X, yPos);
           doc.setFontSize(9);
           doc.setTextColor(0, 0, 0);
         }

         yPos += 5;
       });

       // Total FOB declaration line if there's insurance
       if (totalFOB > 0) {
         yPos += 2;
         doc.setFont('helvetica', 'bold');
         doc.setFontSize(9);
         doc.text(`FOB: $${totalFOB.toFixed(2)}`, col3X, yPos);
         doc.setFont('helvetica', 'normal');
         yPos += 5;
       }

       yPos += 5;
      } else if (packages.length > 0 && yPos > doc.internal.pageSize.height - 60) {
       // If not enough space, move to next page
       doc.addPage();
       yPos = 20;

       // Display trackings on new page
       doc.setFontSize(9);
       doc.setFont('helvetica', 'bold');
       doc.text('Detalles de Paquetes:', 15, yPos);
       yPos += 7;

       const totalFOB = packages.filter(p => p.has_insurance).reduce((sum, p) => sum + (p.fob_value || 0), 0);
       const col1X = 20;
       const col2X = 80;
       const col3X = 160;

       packages.forEach((pkg) => {
         if (yPos > doc.internal.pageSize.height - 25) {
           doc.addPage();
           yPos = 20;
         }

         doc.setFontSize(9);
         doc.setFont('helvetica', 'normal');
         doc.setTextColor(0, 0, 0);
         doc.text(pkg.tracking_number, col1X, yPos);
         doc.text(pkg.tracking_number, col2X, yPos);

         if (pkg.has_insurance && pkg.fob_value) {
           doc.text(`FOB: $${pkg.fob_value.toFixed(2)}`, col3X, yPos);
         } else {
           doc.setFontSize(8);
           doc.setTextColor(100, 100, 100);
           doc.text('Sin seguro', col3X, yPos);
           doc.setFontSize(9);
           doc.setTextColor(0, 0, 0);
         }
         yPos += 5;
       });

       if (totalFOB > 0) {
         yPos += 2;
         doc.setFont('helvetica', 'bold');
         doc.text(`FOB: $${totalFOB.toFixed(2)}`, col3X, yPos);
         doc.setFont('helvetica', 'normal');
         yPos += 5;
       }
       yPos += 5;
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

      
      // Payment History
      if (Array.isArray(invoice.payment_history) && invoice.payment_history.length > 0) {
        const pageH = doc.internal.pageSize.height;
        const ensureSpace = (needed) => { if (yPos > pageH - needed) { doc.addPage(); yPos = 20; } };
        yPos += 10; ensureSpace(40);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(0,0,0);
        doc.text('Payment History', 15, yPos);
        yPos += 8;

        // Header row
        doc.setFontSize(9);
        doc.text('Payment Method', 15, yPos);
        doc.text('Date', 80, yPos);
        doc.text('Amount Paid', 120, yPos);
        doc.text('Transaction ID', 160, yPos);
        yPos += 6;

        doc.setFont('helvetica', 'normal');
        let totalPaid = 0;
        (invoice.payment_history).forEach((ph) => {
          ensureSpace(25);
          const brand = (ph.method_brand || 'Card');
          const last4 = ph.last4 || '';
          const method = `${brand.charAt(0).toUpperCase() + brand.slice(1)} •••• ${last4}`;
          const dateStr = new Date(ph.date || new Date()).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
          const amt = Number(ph.amount_paid || 0);
          totalPaid += amt;
          const currency = (ph.currency || 'USD').toUpperCase();
          const amtStr = `${currency} ${amt.toFixed(2)}`;
          const txId = ph.payment_intent_id || ph.charge_id || '';

          doc.text(method, 15, yPos);
          doc.text(dateStr, 80, yPos);
          doc.text(amtStr, 120, yPos);
          doc.text(txId, 160, yPos);
          yPos += 5;
        });

        yPos += 6; ensureSpace(20);
        doc.setFont('helvetica', 'bold');
        const remaining = Math.max(0, (invoice.total || 0) - totalPaid);
        doc.text(`Total Paid: USD ${totalPaid.toFixed(2)}`, 15, yPos);
        yPos += 6;
        doc.text(`Remaining Balance: USD ${remaining.toFixed(2)}`, 15, yPos);
        doc.setFont('helvetica', 'normal');
      }

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