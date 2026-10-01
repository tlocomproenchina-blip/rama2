// Orden de almacén de una factura pagada: un bloque por shipping mark y N° de
// orden/envío, con la etiqueta de cada bulto y el total de bultos al cierre.
// Se entrega al almacén para sacar y verificar la carga liberada.

const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-VE');
};

const fmtDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-VE');
};

export async function generateWarehouseOrderPdf({
  invoice = {},
  order = {},
  appName = 'TLEC CARGO',
  mode = 'save',
}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 14;
  const right = 196;
  const groups = Array.isArray(order.groups) ? order.groups : [];
  const totals = order.totals || {};
  const totalBultos = Number(totals.bultos) || 0;
  const totalPaquetes = Number(totals.packages) || 0;
  let y = 46;

  const startPage = (first) => {
    if (!first) doc.addPage();
    if (first) {
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, 210, 34, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(appName, left, 13);
      doc.setFontSize(13);
      doc.text('ORDEN DE ALMACÉN', left, 22);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Carga liberada por factura pagada · sacar y verificar bulto por bulto', left, 29);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`Factura N° ${invoice.invoice_number || '—'}`, right, 12, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Generada: ${fmtDateTime(order.generated_date)}`, right, 18, { align: 'right' });
      doc.text(
        `${groups.length} orden(es) · ${totalBultos} bulto(s) · ${totalPaquetes} paquete(s)`,
        right,
        24,
        { align: 'right' }
      );
      if (order.generated_by) doc.text(`Por: ${order.generated_by}`, right, 30, { align: 'right' });
      y = 46;
    } else {
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, 210, 16, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(appName, left, 10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`ORDEN DE ALMACÉN · Factura ${invoice.invoice_number || ''} (continuación)`, right, 10, { align: 'right' });
      y = 26;
    }
    doc.setTextColor(30, 41, 59);
  };

  startPage(true);

  // Encabezado: factura y cliente
  doc.setFontSize(9);
  const headerRows = [
    ['Cliente:', order.client_name || invoice.client_email || '—'],
    ['Shipping mark:', order.shipping_mark || '—'],
    ['Factura:', invoice.invoice_number || '—'],
    ['Pagada el:', fmtDate(invoice.payment_date)],
  ];
  headerRows.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? left : 110;
    const rowY = y + Math.floor(i / 2) * 6;
    doc.setFont('helvetica', 'bold');
    doc.text(label, x, rowY);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(String(value ?? '—'), 48)[0] || '—', x + 27, rowY);
  });
  y += 18;

  const columnsHeader = () => {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('✓', 16, y);
    doc.text('Etiqueta del bulto', 24, y);
    doc.text('Paq.', 168, y, { align: 'right' });
    doc.text('Estado', right, y, { align: 'right' });
    doc.setTextColor(30, 41, 59);
    y += 2;
    doc.setDrawColor(220, 220, 220);
    doc.line(left, y, right, y);
    y += 5.5;
  };

  groups.forEach((group) => {
    const bultos = Array.isArray(group.bultos) ? group.bultos : [];
    if (y > 235) startPage(false);

    // Banda del N° de orden / envío
    doc.setFillColor(219, 234, 254);
    doc.rect(left, y - 5, right - left, 9, 'F');
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const orderLabel = `Orden/Envío: ${group.order_number || 'Sin N° de orden'}`;
    doc.text(doc.splitTextToSize(orderLabel, 108)[0] || orderLabel, 16, y + 1);
    doc.setFontSize(9);
    doc.text(
      `Mark: ${group.shipping_mark || order.shipping_mark || '—'}`,
      right,
      y + 1,
      { align: 'right' }
    );
    doc.setTextColor(30, 41, 59);
    y += 11;

    columnsHeader();

    bultos.forEach((bulto, index) => {
      if (y > 274) {
        startPage(false);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`Orden/Envío: ${group.order_number || 'Sin N° de orden'} (continuación)`, 16, y);
        y += 8;
        columnsHeader();
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setDrawColor(100, 116, 139);
      doc.rect(16, y - 3.2, 3.6, 3.6);
      doc.setFont('courier', 'bold');
      const cajaTag = bulto.is_caja && bulto.caja_number
        ? `[${bulto.caja_number}/${bulto.caja_total || '?'}] `
        : '';
      doc.text(doc.splitTextToSize(`${cajaTag}${bulto.label_code || '—'}`, 130)[0], 24, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(bulto.package_count ?? 0), 168, y, { align: 'right' });
      doc.text(String(bulto.status || '—'), right, y, { align: 'right' });
      y += 6.5;
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(
      `Total orden ${group.order_number || 'Sin N° de orden'}: ${Number(group.bultos_count) || bultos.length} bulto(s) · ${Number(group.packages_count) || 0} paquete(s)`,
      right,
      y,
      { align: 'right' }
    );
    y += 4;
    doc.setDrawColor(203, 213, 225);
    doc.line(left, y, right, y);
    y += 9;
  });

  // Total general
  if (y > 250) startPage(false);
  doc.setFillColor(37, 99, 235);
  doc.rect(left, y - 5, right - left, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL DE BULTOS', 16, y + 1);
  doc.setFontSize(9);
  doc.text(
    `${groups.length} orden(es) · ${totalBultos} bulto(s) · ${totalPaquetes} paquete(s)`,
    right,
    y + 1,
    { align: 'right' }
  );
  doc.setTextColor(30, 41, 59);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Orden generada al marcar la factura como pagada en Gestión de Facturas. El almacén entrega los bultos marcados y firma al pie.',
    left,
    y
  );
  y += 14;

  if (y > 262) startPage(false);
  doc.setDrawColor(100, 116, 139);
  doc.line(20, y, 85, y);
  doc.line(125, y, 190, y);
  doc.setFontSize(9);
  doc.text('Entregado por (Almacén)', 52.5, y + 5, { align: 'center' });
  doc.text('Recibido por (Transporte)', 157.5, y + 5, { align: 'center' });

  if (mode === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
    return;
  }
  const fileTag = String(invoice.invoice_number || '').trim() || new Date().toISOString().slice(0, 10);
  doc.save(`orden-almacen-${fileTag}.pdf`);
}