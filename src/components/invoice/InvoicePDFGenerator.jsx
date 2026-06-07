import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function InvoicePDFGenerator({ invoice, user }) {
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
      setGenerating(true);

      // Buscar datos del cliente de forma robusta
      let clientUser = user || null;
      if (!clientUser && invoice.client_email) {
        try {
          const rows = await base44.entities.User.filter({ email: invoice.client_email });
          clientUser = rows?.[0] || null;
        } catch { clientUser = null; }
      }
      if ((!clientUser || (!clientUser.first_name && !clientUser.full_name)) && invoice.client_email) {
        try {
          const allUsers = await base44.entities.User.list('-created_date', 1000);
          const target = (invoice.client_email || '').toLowerCase().trim();
          clientUser = (allUsers || []).find(u => (u.email || '').toLowerCase().trim() === target) || clientUser;
        } catch { /* ignore */ }
      }

      const { buildInvoicePdf } = await import('@/components/invoice/InvoicePdfBuilder');
      const doc = await buildInvoicePdf(invoice, config || {}, clientUser);
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