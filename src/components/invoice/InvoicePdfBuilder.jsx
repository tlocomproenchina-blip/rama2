import jsPDF from 'jspdf';

const fmt = (n) => `USD${Number(n || 0).toFixed(2)}`;
const fmtDate = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
};

async function loadImageData(url) {
  try {
    const blob = await fetch(url).then((res) => res.blob());
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Genera un PDF de factura con estructura tipo Stripe.
 * @param {object} invoice - registro de factura
 * @param {object} appConfig - configuración de la app (datos de empresa)
 * @param {object|null} clientUser - usuario cliente (para nombre, dirección, teléfono)
 */
export async function buildInvoicePdf(invoice, appConfig = {}, clientUser = null) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginL = 20;
  const marginR = pageWidth - 20;
  const colDark = [31, 41, 55];
  const colGray = [107, 114, 128];

  const companyName = appConfig.invoice_company_name || 'TLEC GROUP LLC';
  const companyTagline = appConfig.invoice_company_tagline || '';
  const companyAddress = appConfig.invoice_company_address || appConfig.warehouse_address || '';
  const companyDetailLines = [
    appConfig.invoice_company_address || '',
    appConfig.invoice_company_city_zip || '',
    appConfig.invoice_company_country || '',
    appConfig.invoice_company_phone || '',
    appConfig.invoice_company_email || '',
  ].filter(Boolean);
  const logoUrl = appConfig.invoice_logo_url;

  let y = 22;

  // ===== Header: título "Factura" + logo =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...colDark);
  doc.text('Factura', marginL, y);

  if (logoUrl) {
    const imgData = await loadImageData(logoUrl);
    if (imgData) {
      try { doc.addImage(imgData, 'PNG', marginR - 30, 12, 30, 14); } catch { /* ignore */ }
    }
  }

  y += 14;

  // ===== Datos de la factura =====
  doc.setFontSize(9);
  const labelX = marginL;
  const valueX = marginL + 38;

  const metaRows = [
    ['Número de factura', invoice.invoice_number || ''],
    ['Fecha de emisión', fmtDate(invoice.invoice_date)],
    ['Fecha de vencimiento', fmtDate(invoice.due_date)],
  ];
  metaRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colDark);
    doc.text(label, labelX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), valueX, y);
    y += 6;
  });

  y += 6;

  // ===== Dos columnas: Empresa (izq) / Facturar a (der) =====
  const rightColX = pageWidth / 2 + 5;
  let yLeft = y;
  let yRight = y;

  // Empresa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...colDark);
  doc.text(companyName, marginL, yLeft);
  yLeft += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colGray);
  // Usar campos dedicados de empresa si existen; si no, caer al tagline + dirección de almacén
  const companyBlock = companyDetailLines.length > 0
    ? [companyTagline, ...companyDetailLines]
    : [companyTagline, companyAddress];
  companyBlock.filter(Boolean).forEach((text) => {
    doc.splitTextToSize(String(text), pageWidth / 2 - 30).forEach((line) => {
      doc.text(line, marginL, yLeft);
      yLeft += 4.5;
    });
  });

  // Facturar a
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colDark);
  doc.text('Facturar a', rightColX, yRight);
  yRight += 5;

  const fullName = [clientUser?.first_name, clientUser?.last_name].filter(Boolean).join(' ').trim()
    || clientUser?.full_name || '';
  const address = [clientUser?.address, clientUser?.city, clientUser?.state, clientUser?.country]
    .filter(Boolean).join(', ').trim();
  const phone = clientUser?.whatsapp || clientUser?.phone || '';

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colGray);
  const clientLines = [fullName, address, phone, invoice.client_email].filter(Boolean);
  clientLines.forEach((text) => {
    doc.splitTextToSize(String(text), pageWidth / 2 - 25).forEach((line) => {
      doc.text(line, rightColX, yRight);
      yRight += 4.5;
    });
  });

  y = Math.max(yLeft, yRight) + 12;

  // ===== Monto destacado con vencimiento =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...colDark);
  const dueText = invoice.due_date
    ? `${fmt(invoice.total)} con fecha de vencimiento del ${fmtDate(invoice.due_date)}`
    : `${fmt(invoice.total)}`;
  doc.splitTextToSize(dueText, marginR - marginL).forEach((line) => {
    doc.text(line, marginL, y);
    y += 8;
  });

  y += 6;

  // ===== Tabla de conceptos =====
  const colCantX = pageWidth - 95;
  const colPriceX = pageWidth - 60;
  const colImporteX = marginR;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colGray);
  doc.text('Descripción', marginL, y);
  doc.text('Cant.', colCantX, y, { align: 'right' });
  doc.text('Precio unitario', colPriceX, y, { align: 'right' });
  doc.text('Importe', colImporteX, y, { align: 'right' });
  y += 3;
  doc.setDrawColor(220, 220, 220);
  doc.line(marginL, y, marginR, y);
  y += 6;

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - 25) {
      doc.addPage();
      y = 22;
    }
  };

  (invoice.items || []).forEach((item) => {
    const qty = item.quantity || 1;
    const unit = item.unit_price != null ? item.unit_price : (item.total || 0);
    const descLines = doc.splitTextToSize(item.description || '', colCantX - marginL - 6);
    ensureSpace(descLines.length * 4.5 + 6);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colDark);
    descLines.forEach((line, idx) => {
      doc.text(line, marginL, y + idx * 4.5);
    });
    doc.text(String(qty), colCantX, y, { align: 'right' });
    doc.text(fmt(unit), colPriceX, y, { align: 'right' });
    doc.text(fmt(item.total), colImporteX, y, { align: 'right' });

    y += Math.max(descLines.length * 4.5, 5) + 5;
  });

  // ===== Totales =====
  ensureSpace(30);
  const totalsLabelX = pageWidth / 2 + 15;
  doc.setDrawColor(220, 220, 220);

  const subtotal = invoice.subtotal != null ? invoice.subtotal : invoice.total;
  const totalsRows = [
    ['Subtotal', fmt(subtotal), false],
    ['Total', fmt(invoice.total), false],
    ['Importe por pagar', fmt(invoice.total), true],
  ];
  totalsRows.forEach(([label, value, bold]) => {
    doc.line(totalsLabelX, y - 4, marginR, y - 4);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...(bold ? colDark : colGray));
    doc.text(label, totalsLabelX, y);
    doc.setTextColor(...colDark);
    doc.text(value, colImporteX, y, { align: 'right' });
    y += 7;
  });

  // ===== Pie de página con número de página =====
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...colGray);
    doc.text(`Página ${i} de ${pageCount}`, marginR, pageHeight - 12, { align: 'right' });
  }

  return doc;
}