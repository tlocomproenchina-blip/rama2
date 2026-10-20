import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { buildInvoiceDoc } from '@/lib/invoicePdf';

export default function InvoicePDFGenerator({ invoice, user }) {
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    try {
      setGenerating(true);

      const doc = await buildInvoiceDoc(invoice, user);
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