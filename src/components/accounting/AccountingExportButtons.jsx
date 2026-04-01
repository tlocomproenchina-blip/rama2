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

  const handleCostStructurePdf = () => {
    const doc = new jsPDF();
    let y = 18;
    const pageHeight = 280;
    const addLine = (text, indent = 14, gap = 7) => {
      const wrapped = doc.splitTextToSize(text, 180 - indent);
      wrapped.forEach((line) => {
        if (y > pageHeight) {
          doc.addPage();
          y = 18;
        }
        doc.text(line, indent, y);
        y += gap;
      });
    };

    doc.setFontSize(18);
    doc.text('Estructura de Costos', 14, y);
    y += 10;
    doc.setFontSize(11);
    addLine(`Generado: ${new Date().toLocaleString()}`);
    y += 2;

    doc.setFontSize(13);
    addLine('1. Resumen general');
    doc.setFontSize(11);
    addLine(`Ingresos del mes: $${Number(report.metrics.monthRevenue || 0).toFixed(2)}`, 18);
    addLine(`Cuentas por cobrar: $${Number(report.metrics.receivablesAmount || 0).toFixed(2)}`, 18);
    addLine(`Monto vencido: $${Number(report.metrics.overdueAmount || 0).toFixed(2)}`, 18);
    addLine(`Pagos a proveedores del mes: $${Number(report.metrics.providerPaymentsMonth || 0).toFixed(2)}`, 18);
    addLine(`Margen operativo estimado: $${(Number(report.metrics.monthRevenue || 0) - Number(report.metrics.providerPaymentsMonth || 0)).toFixed(2)}`, 18);
    y += 3;

    doc.setFontSize(13);
    addLine('2. Cuentas por cobrar');
    doc.setFontSize(11);
    report.receivables.forEach((item) => {
      addLine(`${item.label}: ${Number(item.count || 0)} registros · $${Number(item.amount || 0).toFixed(2)}`, 18);
    });
    y += 3;

    doc.setFontSize(13);
    addLine('3. Ingresos mensuales');
    doc.setFontSize(11);
    report.monthlyRevenue.forEach((item) => {
      addLine(`${item.label}: $${Number(item.amount || 0).toFixed(2)}`, 18);
    });
    y += 3;

    doc.setFontSize(13);
    addLine('4. Pagos recientes a proveedores');
    doc.setFontSize(11);
    if ((report.recentProviderPayments || []).length === 0) {
      addLine('No hay pagos recientes registrados.', 18);
    } else {
      report.recentProviderPayments.forEach((item) => {
        addLine(`${item.provider_name}: $${Number(item.total_amount || 0).toFixed(2)} · ${item.method}`, 18);
      });
    }

    doc.save('estructura-costos.pdf');
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={handleCsv} className="bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-900"><FileSpreadsheet className="h-4 w-4 mr-2" /> CSV</Button>
      <Button variant="outline" onClick={handlePdf} className="bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-900"><FileText className="h-4 w-4 mr-2" /> PDF</Button>
      <Button variant="outline" onClick={handleCostStructurePdf} className="bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-900"><Download className="h-4 w-4 mr-2" /> Estructura de costos</Button>
    </div>
  );
}