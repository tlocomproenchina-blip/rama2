import jsPDF from 'jspdf';
import { money } from '@/lib/fiscalCalc';
import { fmtDate } from '@/lib/fiscalStatus';

// PDF A4 de la solicitud. Siempre se identifica como documento preliminar: la
// factura fiscal definitiva se emite por el mecanismo autorizado y se guarda aparte.
export function buildFiscalPdf({ request, appConfig, settings }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 15;
  const c = appConfig || {};
  const s = settings || {};
  const issuerName = c.invoice_company_name || c.app_name || 'TLEC CARGO';

  doc.setTextColor(238, 238, 238);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(72);
  doc.text('PRELIMINAR', W / 2, 160, { align: 'center', angle: 35 });

  // Emisor
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(16);
  doc.text(issuerName, M, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  const issuerLines = [
    s.issuer_rif ? `RIF: ${s.issuer_rif}` : 'RIF del emisor: pendiente de configurar',
    c.invoice_company_address,
    c.invoice_company_city_zip,
    c.invoice_company_country,
    c.invoice_company_phone && `Tel: ${c.invoice_company_phone}`,
    c.invoice_company_email,
    s.issuer_extra_info,
  ].filter(Boolean);
  issuerLines.forEach((t, i) => doc.text(String(t), M, 26 + i * 4.5));

  // Identificación del documento
  doc.setFillColor(249, 116, 21);
  doc.roundedRect(W - M - 72, 12, 72, 26, 2, 2, 'F');
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('SOLICITUD DE FACTURA FISCAL', W - M - 36, 19, { align: 'center' });
  doc.setFontSize(8.5);
  doc.text('VISTA PRELIMINAR', W - M - 36, 24, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(`N.o ${request.request_number || '-'}`, W - M - 36, 29.5, { align: 'center' });
  doc.text(`Fecha: ${fmtDate(request.submitted_date || request.created_date)}`, W - M - 36, 34, { align: 'center' });

  let y = Math.max(26 + issuerLines.length * 4.5, 42) + 4;
  doc.setTextColor(185, 28, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Documento preliminar de solicitud. No es una factura fiscal legalmente emitida.', M, y);
  y += 9;

  // Receptor
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(10);
  doc.text('DATOS DEL RECEPTOR', M, y);
  doc.setDrawColor(229, 231, 235);
  doc.line(M, y + 1.5, W - M, y + 1.5);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Nombre o razón social: ${request.legal_name || '-'}`, M, y);
  y += 5;
  doc.text(`RIF: ${request.rif || '-'}`, M, y);
  y += 5;
  const addr = doc.splitTextToSize(`Dirección fiscal: ${request.fiscal_address || '-'}`, W - 2 * M);
  doc.text(addr, M, y);
  y += addr.length * 4.6 + 5;

  // Detalle
  const header = () => {
    doc.setFillColor(17, 24, 39);
    doc.rect(M, y, W - 2 * M, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('CANT.', M + 2, y + 4.8);
    doc.text('DESCRIPCIÓN', M + 22, y + 4.8);
    doc.text('PRECIO UNIT.', W - M - 34, y + 4.8, { align: 'right' });
    doc.text('TOTAL', W - M - 2, y + 4.8, { align: 'right' });
    y += 9;
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
  };
  header();
  (request.lines || []).forEach((l) => {
    const desc = doc.splitTextToSize(String(l.description || ''), 98);
    const h = Math.max(6, desc.length * 4.5 + 2);
    if (y + h > 262) {
      doc.addPage();
      y = 18;
      header();
    }
    doc.text(String(l.quantity), M + 2, y + 3.5);
    doc.text(desc, M + 22, y + 3.5);
    doc.text(money(l.unit_price), W - M - 34, y + 3.5, { align: 'right' });
    doc.text(money(l.total), W - M - 2, y + 3.5, { align: 'right' });
    doc.setDrawColor(235, 235, 235);
    doc.line(M, y + h - 0.5, W - M, y + h - 0.5);
    y += h;
  });

  // Resumen inferior derecho
  if (y > 235) {
    doc.addPage();
    y = 18;
  }
  y += 6;
  const x0 = W - M - 78;
  doc.setFontSize(9.5);
  doc.text('Subtotal', x0, y);
  doc.text(money(request.subtotal), W - M - 2, y, { align: 'right' });
  y += 6;
  doc.text('IVA 16 %', x0, y);
  doc.text(money(request.vat_amount), W - M - 2, y, { align: 'right' });
  y += 4;
  doc.setFillColor(249, 116, 21);
  doc.rect(x0 - 3, y, 81, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('TOTAL NETO', x0, y + 6);
  doc.text(money(request.total), W - M - 2, y + 6, { align: 'right' });
  y += 17;

  // Datos de referencia
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(75, 85, 99);
  const foot = [
    `Factura original asociada: ${request.invoice_number || '-'}`,
    `Referencia interna de la solicitud: ${request.request_number || '-'}`,
    request.shipping_mark ? `Shipping Mark: ${request.shipping_mark}` : null,
    request.issued_number ? `N.o fiscal referencial: ${request.issued_number}` : null,
    s.footer_note,
  ].filter(Boolean);
  foot.forEach((t) => {
    const parts = doc.splitTextToSize(String(t), W - 2 * M);
    if (y + parts.length * 4.2 > 280) {
      doc.addPage();
      y = 18;
    }
    doc.text(parts, M, y);
    y += parts.length * 4.2 + 1;
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(`${issuerName} - Documento preliminar, sin validez fiscal`, M, 289);
    doc.text(`Página ${p} de ${pages}`, W - M, 289, { align: 'right' });
  }

  return doc.output('blob');
}