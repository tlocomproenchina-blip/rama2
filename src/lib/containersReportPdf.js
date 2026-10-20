// Genera el PDF imprimible de "Contenedores por cliente".
// La información va en secuencia continua, como una guía de despacho: por cada
// cliente se abre un bloque con su nombre y su shipping mark, y debajo se lista
// cada contenedor con su número, la cantidad de bultos y su descripción.
// No incluye email ni totales de contenedores.

const MARGIN = 14;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 182
const BOTTOM = 272;

const COL_NUM = MARGIN;
const COL_CONTAINER = MARGIN + 10;
const COL_BULTOS = 118;
const COL_DESC = 126;
const DESC_WIDTH = MARGIN + CONTENT_WIDTH - COL_DESC; // 70

function drawTableHeader(doc, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('#', COL_NUM, y);
  doc.text('N° DE CONTENEDOR', COL_CONTAINER, y);
  doc.text('BULTOS', COL_BULTOS, y, { align: 'right' });
  doc.text('DESCRIPCIÓN', COL_DESC, y);
  doc.setDrawColor(203, 213, 225);
  doc.line(MARGIN, y + 2, MARGIN + CONTENT_WIDTH, y + 2);
  doc.setTextColor(30, 41, 59);
  return y + 8;
}

function drawClientBand(doc, y, group) {
  doc.setFillColor(239, 246, 255);
  doc.rect(MARGIN, y - 4.5, CONTENT_WIDTH, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(String(group.name || 'Cliente sin nombre'), MARGIN + 2, y + 1.5);
  if (group.shipping_mark) {
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Shipping mark: ${group.shipping_mark}`, MARGIN + CONTENT_WIDTH - 2, y + 1.5, { align: 'right' });
  }
  doc.setTextColor(30, 41, 59);
  return y + 11;
}

export async function generateContainersReportPdf(groups = [], appName = 'TLEC CARGO', mode = 'save') {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const date = new Date();

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, PAGE_WIDTH, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(appName, MARGIN, 12);
  doc.setFontSize(11);
  doc.text('REPORTE DE CONTENEDORES', MARGIN, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(date.toLocaleDateString('es-VE'), PAGE_WIDTH - MARGIN, 12, { align: 'right' });
  doc.text(date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }), PAGE_WIDTH - MARGIN, 20, {
    align: 'right',
  });

  doc.setTextColor(30, 41, 59);
  let y = drawTableHeader(doc, 36);
  let index = 0;

  groups.forEach((group) => {
    if (y > BOTTOM - 24) {
      doc.addPage();
      y = drawTableHeader(doc, 20);
    }
    y = drawClientBand(doc, y, group);

    group.containers.forEach((row) => {
      const description = String(row.description || '');
      const descLines = doc.splitTextToSize(description || '—', DESC_WIDTH);
      const rowHeight = Math.max(descLines.length * 4.6, 6);

      if (y > BOTTOM - rowHeight) {
        doc.addPage();
        y = drawTableHeader(doc, 20);
      }

      index += 1;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(String(index), COL_NUM, y);
      doc.setFont('helvetica', 'bold');
      doc.text(String(row.container || '—'), COL_CONTAINER, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(Number(row.bultos || 0)), COL_BULTOS, y, { align: 'right' });
      doc.text(descLines, COL_DESC, y);

      y += rowHeight + 1;
    });

    y += 5;
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Página ${page} de ${pages}`, PAGE_WIDTH - MARGIN, 288, { align: 'right' });
    doc.text(appName, MARGIN, 288);
  }

  const fileName = `contenedores-${date.toISOString().slice(0, 10)}.pdf`;

  if (mode === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
    return;
  }

  doc.save(fileName);
}