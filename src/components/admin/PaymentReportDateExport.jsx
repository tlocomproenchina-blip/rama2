import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, ChevronDown, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { downloadTxt } from '@/lib/paymentReportTxt';

// Exporta el informe TXT de un día elegido en el calendario: permite recuperar
// los informes de pagos aprobados de fechas anteriores, no solo el de hoy.
export default function PaymentReportDateExport() {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!day) {
      toast.info('Elige una fecha para exportar el informe.');
      return;
    }
    const dayKey = format(day, 'yyyy-MM-dd');
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getDailyApprovedPaymentsReport', { day: dayKey });
      const data = res?.data || {};
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (data.empty) {
        toast.info(data.message || `No hay pagos aprobados el ${format(day, 'dd/MM/yyyy')}.`);
        return;
      }
      downloadTxt(data.filename, data.content);
      toast.success(`Informe del ${format(day, 'dd/MM/yyyy')} descargado: ${data.count} pagos aprobados`);
      setOpen(false);
    } catch (e) {
      toast.error('Error al generar el informe de esa fecha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          title="Exporta el informe TXT de cualquier fecha"
        >
          <CalendarDays className="h-4 w-4 mr-2" />
          Informe por fecha
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3 space-y-3">
        <p className="text-sm font-medium text-slate-600">Elige el día del informe</p>
        <Calendar
          mode="single"
          locale={es}
          selected={day}
          onSelect={setDay}
          disabled={{ after: new Date() }}
          initialFocus
        />
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            {day ? `Fecha elegida: ${format(day, 'dd/MM/yyyy')}` : 'Ninguna fecha elegida'}
          </p>
          <Button onClick={handleDownload} disabled={loading || !day} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Descargar TXT
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}