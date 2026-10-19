// Guía de despacho consolidada: un solo documento continuo con un bloque por
// cliente, que lista el código de cada bulto con su casilla de verificación de
// entrega, los totales por cliente y el total general al cierre.
import { isUnregisteredLine, summarizeGuide } from './dispatchGuides';

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
  notes = '',
}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const list = Array.isArray(clients) ? clients : [];
  const totals = summarizeGuide(list, list.map((c) => c.client_key || c.client_email));
  // Líneas de carga sin bulto registrado: salen impresas por su N° de contenedor.
  const unregistered = list
    .flatMap((entry) => (Array.isArray(entry.bultos) ? entry.bultos : []))
    .filter(isUnregisteredLine).length;
  const unitLabel = unregistered ? `${totals.bultos} línea(s)` : `${totals.bultos} bulto(s)`;
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
    doc.text('Código de bulto / caja', 26, y);
    doc.text('Paq.', 112, y);
    doc.text('CBM', 126, y);
    doc.text('Fecha', 144, y);
    doc.text('Verificado', 174, y);
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
      doc.text(
        `${totals.clients} cliente(s) · ${unitLabel}` + (unregistered ? ` · ${unregistered} sin bulto` : ''),
        right,
        22,
        { align: 'right' }
      );
      doc.text('Cajas, bultos y carga emitida por N° de contenedor · verificación de entrega bloque por bloque', left, 29);
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
    const clientName = String(entry.client_name || info.full_name || entry.client_email || 'Cliente').replace(/^Sin registrar(?= —|$)/i, 'Cliente');

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
      // Cada unidad se identifica con la posición X/N impresa en su etiqueta; la carga
      // sin bulto registrado, con su N° de contenedor.
      const cajaTag = bulto.caja_number
        ? `[${bulto.caja_number}/${bulto.caja_total || '?'}] `
        : '';
      if (isUnregisteredLine(bulto)) {
        doc.setFont('helvetica', 'bold');
        doc.text(`${cajaTag}SIN BULTO · Orden ${bulto.order_number || '—'}`, 26, y);
      } else {
        doc.setFont('courier', 'bold');
        doc.text(`${cajaTag}${bulto.label_code || '—'}`, 26, y);
      }
      doc.setFont('helvetica', 'normal');
      doc.text(String(bulto.package_count ?? 0), 112, y);
      doc.text(bulto.cbm ? Number(bulto.cbm).toFixed(3) : '—', 126, y);
      doc.text(fmtDate(bulto.date), 144, y);
      doc.setDrawColor(100, 116, 139);
      doc.rect(174, y - 3.2, 3.6, 3.6);
      y += 6.5;
    });

    // El chofer solo necesita contar bultos: el resumen del cliente muestra ese número
    // y nada más, en grande, sin paquetes ni órdenes que confundan el conteo.
    if (y > 262) startPage(false);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    const clientBultos = bultos.filter((b) => b.label_code).length;
    const clientUnregistered = bultos.filter(isUnregisteredLine).length;
    doc.text(`Total cliente: ${clientBultos} bulto(s)`, right, y, { align: 'right' });
    y += 5.5;
    if (clientUnregistered) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`+ ${clientUnregistered} carga(s) sin bulto registrado`, right, y, { align: 'right' });
      doc.setTextColor(30, 41, 59);
      y += 4.5;
    }
    y += 1;
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
  doc.setFontSize(13);
  doc.text(`${totals.clients} cliente(s) · ${unitLabel}`, right, y + 1, { align: 'right' });
  if (unregistered) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(226, 232, 240);
    doc.text(`+ ${unregistered} carga(s) sin bulto registrado`, right, y + 7, { align: 'right' });
  }
  doc.setTextColor(30, 41, 59);
  y += 22;

  // Notas de la guía (las que se escriben al anotar la entrega): salen impresas.
  const noteLines = notes ? doc.splitTextToSize(String(notes).trim(), right - left - 4) : [];
  if (noteLines.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('NOTAS', left, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    y += 5;
    noteLines.forEach((line) => {
      doc.text(line, left, y);
      y += 4.5;
    });
    y += 6;
  }

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