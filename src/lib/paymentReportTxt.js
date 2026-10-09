import { toast } from 'sonner';

// Descarga un archivo de texto en el navegador.
export function downloadTxt(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'pagos_aprobados.txt';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Descarga el informe TXT que devuelven las funciones de aprobación de pagos
// (una aprobación individual o un lote aprobado en bloque).
export function downloadPaymentReport(data) {
  const content = data?.batch_txt || data?.report_txt;
  if (!content) return false;
  downloadTxt(data?.batch_filename || data?.report_filename, content);
  toast.success('Informe TXT de pagos aprobados descargado');
  return true;
}