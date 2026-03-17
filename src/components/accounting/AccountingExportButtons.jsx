import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function AccountingExportButtons({ report }) {
  const handleCsv = () => {
    const rows = [
      ['seccion', 'concepto', 'valor'],
      ['metricas', 'ingresos_mes', report.metrics.monthRevenue],
      ['metricas', 'cuentas_por_cobrar', report.metrics.receivablesAmount],
      ['metricas', 'facturas_vencidas', report.metrics.overdueCount],
      ['metricas', 'monto_vencido', report.metrics.overdueAmount],
      ['metricas', 'pagos_proveedores_mes', report.metrics.providerPaymentsMonth],
      ...report.monthlyRevenue.map((item) => ['ingresos_mensuales', item.label, item.amount]),
      ...report.receivables.map((item) => ['cuentas_por_cobrar', item.label, item.amount]),
      ...report.recentProviderPayments.map((item) => ['pagos_proveedores', `${item.provider_name} ${item.method}`, item.total_amount])
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    downloadFile('reporte-contabilidad.csv', csv, 'text/csv;charset=utf-8;');
  };

  const handlePdf = () => {
    const doc = new jsPDF();
    let y = 18;
    doc.setFontSize(18);
    doc.text('Reporte de Contabilidad', 14, y);
    y += 10;
    doc.setFontSize(11);
    doc.text(`Generado: ${new Date().toLocaleString()}`, 14, y);
    y += 12;

    const lines = [
      `Ingresos del mes: $${report.metrics.monthRevenue.toFixed(2)}`,
      `Cuentas por cobrar: $${report.metrics.receivablesAmount.toFixed(2)}`,
      `Facturas vencidas: ${report.metrics.overdueCount} ($${report.metrics.overdueAmount.toFixed(2)})`,
      `Pagos de proveedores del mes: $${report.metrics.providerPaymentsMonth.toFixed(2)}`,
      ' ',
      'Ingresos mensuales:',
      ...report.monthlyRevenue.map((item) => `- ${item.label}: $${Number(item.amount || 0).toFixed(2)}`),
      ' ',
      'Pagos recientes a proveedores:',
      ...report.recentProviderPayments.map((item) => `- ${item.provider_name}: $${Number(item.total_amount || 0).toFixed(2)} (${item.method})`)
    ];

    lines.forEach((line) => {
      if (y > 280) {
        doc.addPage();
        y = 18;
      }
      doc.text(line, 14, y);
      y += 7;
    });

    doc.save('reporte-contabilidad.pdf');
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={handleCsv}><FileSpreadsheet className="h-4 w-4 mr-2" /> CSV</Button>
      <Button variant="outline" onClick={handlePdf}><FileText className="h-4 w-4 mr-2" /> PDF</Button>
      <Button onClick={handleCsv} className="bg-slate-800 hover:bg-slate-900"><Download className="h-4 w-4 mr-2" /> Exportar</Button>
    </div>
  );
}