import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { downloadTxt } from '@/lib/paymentReportTxt';

// Descarga el informe TXT acumulado de los pagos aprobados hoy (hora de Caracas):
// shipping mark y N° de contenedor de cada factura pagada.
export default function PaymentReportDownloadButton() {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getDailyApprovedPaymentsReport', {});
      const data = res?.data || {};
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (data.empty) {
        toast.info(data.message || 'No hay pagos aprobados hoy.');
        return;
      }
      downloadTxt(data.filename, data.content);
      toast.success(`Informe del día descargado: ${data.count} pagos aprobados`);
    } catch (e) {
      toast.error('Error al generar el informe del día');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleDownload}
      disabled={loading}
      className="w-full sm:w-auto"
      title="Descarga el TXT con los pagos aprobados hoy"
    >
      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
      Informe del día (TXT)
    </Button>
  );
}