// Genera el PDF de una orden de despacho a partir de un registro DispatchOrder
export async function generateDispatchOrderPdf(order, appName = 'TLEC CARGO') {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const client = order.client_snapshot || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const date = order.dispatched_date ? new Date(order.dispatched_date) : new Date();

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(appName, 14, 12);
  doc.setFontSize(12);
  doc.text(order.status === 'cancelada' ? 'ORDEN DE DESPACHO (CANCELADA)' : 'ORDEN DE DESPACHO', 14, 21);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N° ${order.order_number || '—'}`, 196, 12, { align: 'right' });
  doc.text(date.toLocaleString('es-VE'), 196, 21, { align: 'right' });

  doc.setTextColor(30, 41, 59);
  let y = 40;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL CLIENTE', 14, y);
  doc.setDrawColor(203, 213, 225);
  doc.line(14, y + 2, 196, y + 2);
  y += 9;
  doc.setFontSize(10);

  const rows = [
    ['Nombre:', client.full_name || order.client_name || order.client_email],
    ['Cédula:', client.cedula || '—'],
    ['Teléfono:', client.whatsapp || '—'],
    ['Dirección:', client.address || '—'],
    ['Ciudad / Estado:', [client.city, client.state].filter(Boolean).join(' / ') || '—'],
    ['Shipping Mark:', order.shipping_mark || client.shipping_mark || '—'],
    ['Email:', order.client_email],
  ];
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 14, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(String(value ?? '—'), 140);
    doc.text(lines, 52, y);
    y += lines.length * 5 + 2;
  });

  y += 6;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`PAQUETES DESPACHADOS (${items.length})`, 14, y);
  doc.line(14, y + 2, 196, y + 2);
  y += 9;
  doc.setFontSize(10);
  doc.text('#', 14, y);
  doc.text('Tracking', 24, y);
  doc.text('Descripción', 110, y);
  y += 6;
  doc.setFont('helvetica', 'normal');

  items.forEach((item, idx) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(String(idx + 1), 14, y);
    doc.text(String(item.tracking_number || ''), 24, y);
    const desc = doc.splitTextToSize(String(item.description || ''), 84);
    doc.text(desc, 110, y);
    y += Math.max(desc.length * 5, 6);
  });

  if (order.notes) {
    if (y > 250) { doc.addPage(); y = 20; }
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Notas:', 14, y);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(String(order.notes), 150);
    doc.text(noteLines, 34, y);
    y += noteLines.length * 5;
  }

  if (y > 245) {
    doc.addPage();
    y = 30;
  }
  y += 20;
  doc.line(20, y, 85, y);
  doc.line(125, y, 190, y);
  doc.setFontSize(9);
  doc.text('Entregado por (Almacén)', 52.5, y + 5, { align: 'center' });
  doc.text('Recibido por (Cliente / Transporte)', 157.5, y + 5, { align: 'center' });

  const safe = String(order.order_number || order.shipping_mark || order.client_email || 'orden').replace(/[^a-zA-Z0-9-]/g, '_');
  doc.save(`orden-despacho-${safe}.pdf`);
}