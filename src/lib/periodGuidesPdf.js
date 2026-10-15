// PDF de las guías de un período pagado: un solo archivo con una guía individual por
// página (número de guía, datos del cliente, cajas y bultos con su casilla de
// verificación y las firmas de entrega). Se usa para imprimir de una vez todas las
// guías generadas desde los períodos de facturas pagadas.

const fmtDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-VE');
};

const fmtStamp = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const cleanName = (value) =>
  String(value || '').replace(/^Sin registrar(?= —|$)/i, 'Cliente') || 'Cliente';

export async function generatePeriodGuidesPdf({
  guides,
  appName = 'TLEC CARGO',
  mode = 'save',
  periodFrom = '',
  periodTo = '',
}) {
  const list = (Array.isArray(guides) ? guides : []).filter(Boolean);
  if (!list.length) return;

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 14;
  const right = 196;
  const periodLabel = periodFrom && periodTo ? `${fmtDate(periodFrom)} al ${fmtDate(periodTo)}` : '';
  let y = 38;

  const guideHeader = (guide) => {
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(appName, left, 12);
    doc.setFontSize(12);
    doc.text('GUÍA DE DESPACHO', left, 21);
    doc.setFontSize(10);
    doc.text(`Guía N° ${guide.guide_number || 'sin número'}`, right, 12, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Emitida: ${fmtStamp(guide.emitted_date)}`, right, 18, { align: 'right' });
    if (periodLabel) doc.text(`Período pagado: ${periodLabel}`, right, 24, { align: 'right' });
    doc.setTextColor(30, 41, 59);
    y = 38;
  };

  const continuationHeader = (guide) => {
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(appName, left, 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Guía ${guide.guide_number || ''} (continuación)`, right, 9, { align: 'right' });
    doc.setTextColor(30, 41, 59);
    y = 24;
  };

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

  list.forEach((guide, guideIndex) => {
    if (guideIndex > 0) doc.addPage();
    guideHeader(guide);

    const clients = Array.isArray(guide.clients) ? guide.clients : [];

    clients.forEach((entry) => {
      const bultos = Array.isArray(entry.bultos) ? entry.bultos : [];
      const info = entry.client || {};

      if (y > 235) {
        doc.addPage();
        continuationHeader(guide);
      }

      // Banda del cliente
      doc.setFillColor(219, 234, 254);
      doc.rect(left, y - 5, right - left, 9, 'F');
      doc.setTextColor(30, 58, 138);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      const nameLine =
        doc.splitTextToSize(cleanName(entry.client_name || info.full_name || entry.client_email), 116)[0] ||
        'Cliente';
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

      // N° de contenedor que cubre la guía (viene de la orden de despacho del período)
      const orders = [...new Set(bultos.map((b) => String(b.order_number || '').trim()).filter(Boolean))];
      if (orders.length) {
        doc.setFont('helvetica', 'bold');
        doc.text('N° de contenedor:', left, y);
        doc.setFont('helvetica', 'normal');
        const orderLines = doc.splitTextToSize(orders.join(', '), 140);
        doc.text(orderLines, left + 34, y);
        y += orderLines.length * 4.5 + 3;
      }

      tableHeader();

      let index = 0;
      bultos.forEach((bulto) => {
        if (y > 274) {
          doc.addPage();
          continuationHeader(guide);
          tableHeader();
        }
        index += 1;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(String(index), 16, y);
        doc.setFont('courier', 'bold');
        // Cada unidad se identifica con la posición X/N impresa en su etiqueta.
        const cajaTag = bulto.caja_number ? `[${bulto.caja_number}/${bulto.caja_total || '?'}] ` : '';
        doc.text(`${cajaTag}${bulto.label_code || '—'}`, 26, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(bulto.package_count ?? 0), 112, y);
        doc.text(bulto.cbm ? Number(bulto.cbm).toFixed(3) : '—', 126, y);
        doc.text(fmtDate(bulto.date), 144, y);
        doc.setDrawColor(100, 116, 139);
        doc.rect(174, y - 3.2, 3.6, 3.6);
        y += 6.5;
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      const clientPackages = bultos.reduce((sum, b) => sum + (Number(b.package_count) || 0), 0);
      const clientCajas = bultos.filter((b) => b.is_caja).length;
      const clientCbm = bultos.reduce((sum, b) => sum + (Number(b.cbm) || 0), 0);
      doc.text(
        `Total cliente: ${bultos.length} bulto(s)` +
          (clientCajas ? ` (${clientCajas} caja(s))` : '') +
          ` · ${clientPackages} paquete(s)` +
          (clientCbm > 0 ? ` · ${clientCbm.toFixed(3)} CBM` : '') +
          (entry.orders_count ? ` · ${entry.orders_count} orden(es)` : ''),
        right,
        y,
        { align: 'right' }
      );
      y += 5;
      doc.setDrawColor(203, 213, 225);
      doc.line(left, y, right, y);
      y += 10;
    });

    // Firmas de entrega de esta guía
    if (y > 258) {
      doc.addPage();
      continuationHeader(guide);
    }
    doc.setDrawColor(100, 116, 139);
    doc.line(20, y, 85, y);
    doc.line(125, y, 190, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Entregado por (Almacén)', 52.5, y + 5, { align: 'center' });
    doc.text('Recibido por (Cliente / Transporte)', 157.5, y + 5, { align: 'center' });
  });

  if (mode === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
    return;
  }

  const tag = periodFrom && periodTo ? `${periodFrom}_${periodTo}` : new Date().toISOString().slice(0, 10);
  doc.save(`guias-despacho-${tag}.pdf`);
}