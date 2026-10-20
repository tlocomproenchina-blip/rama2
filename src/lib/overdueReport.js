// Informe imprimible de facturas vencidas: shipping mark, contenedor, tracking,
// cliente y total por cada factura, con el consolidado del período mostrado.
import { base44 } from '@/components/api/ApiQueueManager';

const unique = (list) => Array.from(new Set(list.map((value) => String(value || '').trim()).filter(Boolean)));

const splitList = (value) => String(value || '')
  .split(/[,;|]/)
  .map((part) => part.trim())
  .filter(Boolean);

// Arma las filas del informe a partir de las facturas vencidas que se están mostrando.
// Los contenedores y trackings salen de los recibos de la factura (manual_recibos);
// cuando la factura no tiene recibos se usa su consolidación como referencia.
export function overdueReportRows(invoices = []) {
  return invoices.map((invoice) => {
    const recibos = Array.isArray(invoice.manual_recibos) ? invoice.manual_recibos : [];
    const containers = unique(recibos.map((recibo) => recibo?.invoice_number));
    const trackings = unique(recibos.flatMap((recibo) => (Array.isArray(recibo?.tracking_numbers) ? recibo.tracking_numbers : [])));
    const consolidationRefs = splitList(invoice.consolidation_tracking);
    const name = `${invoice.client_first_name || ''} ${invoice.client_last_name || ''}`.trim();

    return {
      id: invoice.id,
      invoice_number: invoice.invoice_number || '—',
      invoice_date: invoice.invoice_date || null,
      client_name: name || invoice.client_email || '—',
      client_email: invoice.client_email || '',
      shipping_mark: String(invoice.shipping_mark || '').trim(),
      containers: containers.length ? containers : [],
      trackings: trackings.length ? trackings : consolidationRefs,
      total: Number(invoice.total || 0),
    };
  });
}

// Completa shipping mark y nombre del cliente para las facturas que llegaron sin
// esos datos (la lista se carga por páginas y el cliente se resuelve aparte).
export async function enrichOverdueRows(rows = []) {
  const missing = rows.filter((row) => (!row.shipping_mark || row.client_name === row.client_email) && row.client_email);
  if (!missing.length) return rows;

  const emails = unique(missing.map((row) => row.client_email));
  const res = await base44.functions
    .invoke('getClientsByEmails', { emails }, { opType: 'read', priority: 'HIGH' })
    .catch(() => null);
  const clients = res?.data?.clients || {};

  return rows.map((row) => {
    const client = clients[row.client_email];
    if (!client) return row;
    const name = `${client.first_name || ''} ${client.last_name || ''}`.trim();
    return {
      ...row,
      shipping_mark: row.shipping_mark || String(client.shipping_mark || '').trim(),
      client_name: row.client_name === row.client_email && name ? name : row.client_name,
    };
  });
}

export const overdueTotals = (rows = []) => ({
  count: rows.length,
  total: rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0),
});

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-VE');
};

// Genera el PDF del informe (horizontal, una fila por factura).
export async function generateOverdueReportPdf(rows = [], mode = 'save', appName = 'TLEC CARGO') {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = 297;
  const left = 12;
  const right = pageWidth - 12;
  const totals = overdueTotals(rows);
  const now = new Date();

  const columns = [
    { key: 'index', label: '#', x: left, width: 8 },
    { key: 'invoice', label: 'Factura / Fecha', x: left + 8, width: 38 },
    { key: 'client', label: 'Cliente', x: left + 46, width: 62 },
    { key: 'mark', label: 'Shipping mark', x: left + 108, width: 40 },
    { key: 'container', label: 'Contenedor', x: left + 148, width: 26 },
    { key: 'tracking', label: 'Tracking', x: left + 174, width: 74 },
    { key: 'total', label: 'Total', x: right, width: 30 },
  ];

  const drawHeader = () => {
    doc.setFillColor(185, 28, 28);
    doc.rect(0, 0, pageWidth, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(appName, left, 11);
    doc.setFontSize(12);
    doc.text('INFORME DE FACTURAS VENCIDAS', left, 19);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${totals.count} factura(s) · ${money(totals.total)}`, right, 11, { align: 'right' });
    doc.text(now.toLocaleString('es-VE'), right, 19, { align: 'right' });
    doc.setTextColor(30, 41, 59);
  };

  const drawTableHeader = (y) => {
    doc.setFillColor(241, 245, 249);
    doc.rect(left, y - 5, right - left, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    columns.forEach((col) => {
      doc.text(col.label, col.key === 'total' ? col.x : col.x, y, {
        align: col.key === 'total' ? 'right' : 'left',
      });
    });
    doc.setFont('helvetica', 'normal');
    return y + 8;
  };

  drawHeader();
  let y = drawTableHeader(38);

  rows.forEach((row, index) => {
    const invoiceLines = doc.splitTextToSize(`${row.invoice_number}\n${formatDate(row.invoice_date)}`, columns[1].width);
    const clientLines = doc.splitTextToSize(row.client_name, columns[2].width);
    const markLines = doc.splitTextToSize(row.shipping_mark || '—', columns[3].width);
    const containerLines = doc.splitTextToSize(row.containers.length ? row.containers.join(', ') : '—', columns[4].width);
    const trackingLines = doc.splitTextToSize(row.trackings.length ? row.trackings.join(', ') : '—', columns[5].width);
    const height = Math.max(
      invoiceLines.length, clientLines.length, markLines.length, containerLines.length, trackingLines.length
    ) * 4.2;

    if (y + height > 190) {
      doc.addPage();
      drawHeader();
      y = drawTableHeader(38);
    }

    doc.setFontSize(8.5);
    doc.text(String(index + 1), columns[0].x, y);
    doc.text(invoiceLines, columns[1].x, y);
    doc.text(clientLines, columns[2].x, y);
    doc.setFont('helvetica', 'bold');
    doc.text(markLines, columns[3].x, y);
    doc.setFont('helvetica', 'normal');
    doc.text(containerLines, columns[4].x, y);
    doc.text(trackingLines, columns[5].x, y);
    doc.text(money(row.total), columns[6].x, y, { align: 'right' });

    y += height + 2;
    doc.setDrawColor(226, 232, 240);
    doc.line(left, y - 1.5, right, y - 1.5);
    y += 3;
  });

  if (!rows.length) {
    doc.setFontSize(10);
    doc.text('No hay facturas vencidas con los filtros aplicados.', left, y + 6);
  }

  if (y > 170) {
    doc.addPage();
    drawHeader();
    y = 34;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Total vencido (${totals.count} factura(s))`, right - 40, y + 8, { align: 'right' });
  doc.text(money(totals.total), right, y + 8, { align: 'right' });

  if (mode === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
    return;
  }
  doc.save(`informe-vencidas-${now.toISOString().slice(0, 10)}.pdf`);
}