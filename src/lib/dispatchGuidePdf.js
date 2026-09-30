// Guía de despacho consolidada: un solo documento continuo con un bloque por
// cliente, que lista el código de cada bulto con su casilla de verificación de
// entrega, los totales por cliente y el total general al cierre.
import { summarizeGuide } from './dispatchGuides';

const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-VE');
};

export async function generateDispatchGuidePdf({
  clients,
  appName = 'TLEC CARGO',
  mode = 'save',
  offline = false,
  guideNumber = '',
  emittedAt = '',
}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const list = Array.isArray(clients) ? clients : [];
  const totals = summarizeGuide(list, list.map((c) => c.client_key || c.client_email));
  const now = emittedAt ? new Date(emittedAt) : new Date();
  const left = 14;
  const right = 196;
  let y = 44;

  const tableHeader = () => {
    doc.setFillColor(241, 245, 249);
    doc.rect(left, y - 4, right - left, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('#', 16, y);
    doc.text('Código de bulto', 26, y);
    doc.text('Paq.', 120, y);
    doc.text('Fecha', 134, y);
    doc.text('Verificado', 168, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 7;
  };

  const startPage = (first) => {
    if (!first) doc.addPage();
    if (first) {
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, 210, 32, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(appName, left, 13);
      doc.setFontSize(13);
      doc.text('GUÍA DE DESPACHO', left, 22);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`Guía N° ${guideNumber || 'sin número'}`, right, 11, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Emitida: ${now.toLocaleString('es-VE')}`, right, 17, { align: 'right' });
      doc.text(`${totals.clients} cliente(s) · ${totals.bultos} bulto(s) · ${totals.packages} paquete(s)`, right, 22, { align: 'right' });
      if (totals.unregistered > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(`${totals.unregistered} código(s) sin bulto registrado: verificar`, right, 27, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
      }
      doc.text('Bultos escaneados para despacho · verificación de entrega bulto por bulto', left, 29);
      if (offline) {
        doc.setTextColor(185, 28, 28);
        doc.setFont('helvetica', 'bold');
        doc.text('Documento armado sin conexión: algunos códigos o conteos pueden no estar confirmados.', left, 39);
      }
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
      doc.text('GUÍA DE DESPACHO (continuación)', right, 10, { align: 'right' });
      y = 26;
    }
    doc.setTextColor(30, 41, 59);
  };

  startPage(true);

  list.forEach((entry) => {
    const bultos = Array.isArray(entry.bultos) ? entry.bultos : [];
    const info = entry.client || {};
    const clientName = entry.client_name || info.full_name || entry.client_email || 'Cliente';

    if (y > 235) startPage(false);

    // Banda del cliente
    doc.setFillColor(219, 234, 254);
    doc.rect(left, y - 5, right - left, 9, 'F');
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const nameLine = doc.splitTextToSize(String(clientName).trim() || 'Cliente', 116)[0] || 'Cliente';
    doc.text(nameLine, 16, y + 1);
    doc.setFontSize(9);
    doc.text(`Mark: ${entry.shipping_mark || info.shipping_mark || '—'}`, right, y + 1, { align: 'right' });
    doc.setTextColor(30, 41, 59);
    y += 12;

    // Datos completos del cliente
    doc.setFontSize(9);
    const infoRows = [
      ['Cédula:', info.cedula || '—'],
      ['Teléfono:', info.whatsapp || '—'],
      ['Email:', entry.client_email || info.email || '—'],
      ['Ciudad / Estado:', [info.city, info.state].filter(Boolean).join(' / ') || '—'],
    ];
    infoRows.forEach(([label, value], i) => {
      const x = i % 2 === 0 ? left : 110;
      const rowY = y + Math.floor(i / 2) * 5;
      doc.setFont('helvetica', 'bold');
      doc.text(label, x, rowY);
      doc.setFont('helvetica', 'normal');
      doc.text(doc.splitTextToSize(String(value ?? '—'), 52)[0] || '—', x + 22, rowY);
    });
    y += 11;

    doc.setFont('helvetica', 'bold');
    doc.text('Dirección:', left, y);
    doc.setFont('helvetica', 'normal');
    const addressLines = doc.splitTextToSize(String(info.address || '—'), 146);
    doc.text(addressLines, left + 22, y);
    y += addressLines.length * 4.5 + 4;

    tableHeader();

    let index = 0;
    bultos.forEach((bulto) => {
      if (y > 274) {
        startPage(false);
        tableHeader();
      }
      index += 1;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(String(index), 16, y);
      doc.setFont('courier', 'bold');
      doc.text(String(bulto.label_code || 'sin registrar'), 26, y);
      if (bulto.label_code && !bulto.registered) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text('(sin registrar · verificar)', 98, y + 0.4);
        doc.setFontSize(10);
        doc.setFont('courier', 'bold');
      }
      doc.setFont('helvetica', 'normal');
      doc.text(String(bulto.package_count ?? 0), 120, y);
      doc.text(fmtDate(bulto.date), 134, y);
      doc.setDrawColor(100, 116, 139);
      doc.rect(168, y - 3.2, 3.6, 3.6);
      y += 6.5;
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const clientBultos = bultos.filter((b) => b.label_code).length;
    const clientPackages = bultos.reduce((sum, b) => sum + (Number(b.package_count) || 0), 0);
    doc.text(
      `Total cliente: ${clientBultos} bulto(s) · ${clientPackages} paquete(s)` +
        (entry.orders_count ? ` · ${entry.orders_count} despacho(s)` : ''),
      right,
      y,
      { align: 'right' }
    );
    y += 5;
    doc.setDrawColor(203, 213, 225);
    doc.line(left, y, right, y);
    y += 10;
  });

  if (y > 250) startPage(false);

  doc.setFillColor(37, 99, 235);
  doc.rect(left, y - 5, right - left, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL GENERAL', 16, y + 1);
  doc.setFontSize(9);
  doc.text(`${totals.clients} cliente(s) · ${totals.bultos} bulto(s) · ${totals.packages} paquete(s)`, right, y + 1, { align: 'right' });
  doc.setTextColor(30, 41, 59);
  y += 22;

  if (y > 265) startPage(false);

  doc.setDrawColor(100, 116, 139);
  doc.line(20, y, 85, y);
  doc.line(125, y, 190, y);
  doc.setFontSize(9);
  doc.text('Entregado por (Almacén)', 52.5, y + 5, { align: 'center' });
  doc.text('Recibido por (Cliente / Transporte)', 157.5, y + 5, { align: 'center' });

  if (mode === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
    return;
  }
  const fileTag = String(guideNumber || '').trim() || now.toISOString().slice(0, 10);
  doc.save(`guia-despacho-${fileTag}.pdf`);
}